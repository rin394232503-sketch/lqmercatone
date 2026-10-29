/**
 * 购物车合并模块
 * 游客本地购物车 → 登录后合并到服务端
 * 规则：同 SKU 自动合并数量，冲突以服务端库存为准
 */

const Database = require('better-sqlite3');
const path = require('path');

// 连接 SQLite
const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * 初始化购物车表
 */
function initCartTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(buyer_id, product_id)
    );

    CREATE INDEX IF NOT EXISTS idx_carts_buyer ON carts(buyer_id);
  `);
}

/**
 * 合并购物车
 * @param {string} buyerId - 买家 ID（手机号或 UUID）
 * @param {Array} localCart - 本地购物车 [{ productId, quantity, ... }]
 * @returns {Object} { success, merged, conflicts, message }
 */
function mergeCart(buyerId, localCart) {
  try {
    if (!buyerId) {
      return { success: false, error: '缺少 buyerId' };
    }

    if (!localCart || localCart.length === 0) {
      return { success: true, merged: 0, conflicts: 0, message: '本地购物车为空，无需合并' };
    }

    // 1. 获取服务端购物车
    const serverCart = db.prepare(`
      SELECT product_id, quantity FROM carts WHERE buyer_id = ?
    `).all(buyerId);

    // 2. 构建合并映射 { productId: quantity }
    const merged = {};

    // 先加入服务端购物车
    serverCart.forEach(item => {
      merged[item.product_id] = item.quantity;
    });

    // 再加入本地购物车（同 SKU 数量相加）
    localCart.forEach(item => {
      const productId = item.productId || item.product_id;
      const quantity = parseInt(item.quantity) || 1;

      if (merged[productId]) {
        merged[productId] += quantity; // 数量相加
      } else {
        merged[productId] = quantity;
      }
    });

    // 3. 检查库存冲突
    const conflicts = [];
    const finalCart = [];

    for (const [productId, quantity] of Object.entries(merged)) {
      // 查询商品库存
      const product = db.prepare(`
        SELECT id, stock, name FROM products WHERE id = ?
      `).get(productId);

      if (!product) {
        // 商品不存在，跳过
        conflicts.push({
          productId,
          reason: '商品不存在',
          originalQty: quantity,
          adjustedQty: 0
        });
        continue;
      }

      if (quantity > product.stock) {
        // 数量超过库存，以库存为准
        conflicts.push({
          productId,
          productName: product.name,
          reason: '数量超过库存',
          originalQty: quantity,
          stock: product.stock,
          adjustedQty: product.stock
        });
        finalCart.push({
          productId: parseInt(productId),
          quantity: product.stock
        });
      } else {
        finalCart.push({
          productId: parseInt(productId),
          quantity: quantity
        });
      }
    }

    // 4. 清空服务端购物车
    db.prepare('DELETE FROM carts WHERE buyer_id = ?').run(buyerId);

    // 5. 写入合并后的购物车
    const insertStmt = db.prepare(`
      INSERT INTO carts (buyer_id, product_id, quantity) VALUES (?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (const item of finalCart) {
        insertStmt.run(buyerId, item.productId, item.quantity);
      }
    });

    tx();

    // 6. 返回结果
    return {
      success: true,
      merged: finalCart.length,
      conflicts: conflicts.length,
      conflictDetails: conflicts,
      message: conflicts.length > 0
        ? `合并完成，${conflicts.length} 个商品数量已调整（以库存为准）`
        : '合并完成'
    };

  } catch (error) {
    console.error('购物车合并失败:', error);
    return {
      success: false,
      error: error.message,
      merged: 0,
      conflicts: 0
    };
  }
}

/**
 * 获取服务端购物车
 * @param {string} buyerId
 * @returns {Array}
 */
function getServerCart(buyerId) {
  return db.prepare(`
    SELECT c.product_id, c.quantity, p.name, p.price, p.image
    FROM carts c
    JOIN products p ON c.product_id = p.id
    WHERE c.buyer_id = ?
  `).all(buyerId);
}

/**
 * 清空购物车
 * @param {string} buyerId
 */
function clearCart(buyerId) {
  db.prepare('DELETE FROM carts WHERE buyer_id = ?').run(buyerId);
}

/**
 * 更新购物车数量
 * @param {string} buyerId
 * @param {number} productId
 * @param {number} quantity
 */
function updateCartQuantity(buyerId, productId, quantity) {
  if (quantity <= 0) {
    // 删除
    db.prepare('DELETE FROM carts WHERE buyer_id = ? AND product_id = ?')
      .run(buyerId, productId);
  } else {
    // 更新或插入
    db.prepare(`
      INSERT INTO carts (buyer_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(buyer_id, product_id)
      DO UPDATE SET quantity = ?
    `).run(buyerId, productId, quantity, quantity);
  }
}

module.exports = {
  initCartTable,
  mergeCart,
  getServerCart,
  clearCart,
  updateCartQuantity
};
