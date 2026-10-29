/**
 * 购物车合并自测脚本
 * Phase 2 自测：验证合并逻辑、库存冲突处理
 */

const { initCartTable, mergeCart, getServerCart, clearCart } = require('./cart-merge');
const Database = require('better-sqlite3');
const path = require('path');

// 连接数据库
const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new Database(dbPath);

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

function setupTestData() {
  // 清空测试数据
  db.exec('DELETE FROM carts');

  // 确保有测试商品
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;

  if (productCount === 0) {
    console.log('⚠️ 数据库没有商品，插入测试商品...');
    db.exec(`
      INSERT INTO products (id, name, price, stock) VALUES
      (1001, '测试商品 A', 99.99, 10),
      (1002, '测试商品 B', 199.99, 5),
      (1003, '测试商品 C（低库存）', 29.99, 2)
    `);
  } else {
    // 使用现有商品 ID
    const products = db.prepare('SELECT id FROM products LIMIT 3').all();
    console.log(`使用现有商品 ID: ${products.map(p => p.id).join(', ')}`);
  }
}

function runTests() {
  console.log('\n========================================');
  console.log('🧪 购物车合并自测');
  console.log('========================================\n');

  // 初始化
  initCartTable();
  setupTestData();

  const testBuyer = '+393331234567';
  const products = db.prepare('SELECT id, stock FROM products LIMIT 3').all();

  if (products.length < 3) {
    console.log('❌ 测试失败：商品不足 3 个');
    return;
  }

  const [p1, p2, p3] = products;

  // ========== 测试 1: 本地购物车为空 ==========
  console.log('📋 测试 1: 本地购物车为空');

  clearCart(testBuyer);
  const result1 = mergeCart(testBuyer, []);
  assert(result1.success === true, '合并成功');
  assert(result1.merged === 0, '合并数量 0');
  assert(result1.message.includes('无需合并'), '提示信息正确');

  console.log('');

  // ========== 测试 2: 纯本地购物车（服务端为空）==========
  console.log('📋 测试 2: 纯本地购物车（服务端为空）');

  clearCart(testBuyer);
  const localCart2 = [
    { productId: p1.id, quantity: 2 },
    { productId: p2.id, quantity: 1 }
  ];

  const result2 = mergeCart(testBuyer, localCart2);
  assert(result2.success === true, '合并成功');
  assert(result2.merged === 2, '合并 2 个商品');
  assert(result2.conflicts === 0, '无冲突');

  const serverCart2 = getServerCart(testBuyer);
  assert(serverCart2.length === 2, '服务端购物车有 2 个商品');

  const item1 = serverCart2.find(i => i.product_id === p1.id);
  assert(item1 && item1.quantity === 2, '商品 1 数量正确 (2)');

  console.log('');

  // ========== 测试 3: 同 SKU 数量相加 ==========
  console.log('📋 测试 3: 同 SKU 数量相加');

  // 服务端已有商品 1 数量 3
  clearCart(testBuyer);
  db.prepare('INSERT INTO carts (buyer_id, product_id, quantity) VALUES (?, ?, ?)')
    .run(testBuyer, p1.id, 3);

  // 本地购物车商品 1 数量 2
  const localCart3 = [
    { productId: p1.id, quantity: 2 }
  ];

  const result3 = mergeCart(testBuyer, localCart3);
  assert(result3.success === true, '合并成功');
  assert(result3.merged === 1, '合并 1 个商品');

  const serverCart3 = getServerCart(testBuyer);
  const item3 = serverCart3.find(i => i.product_id === p1.id);
  assert(item3 && item3.quantity === 5, '数量相加正确 (3+2=5)');

  console.log('');

  // ========== 测试 4: 库存冲突（数量超过库存）==========
  console.log('📋 测试 4: 库存冲突（数量超过库存）');

  // 临时将商品 3 库存设为 2
  const originalStock = db.prepare('SELECT stock FROM products WHERE id = ?').get(p3.id).stock;
  db.prepare('UPDATE products SET stock = 2 WHERE id = ?').run(p3.id);

  clearCart(testBuyer);
  // 商品 3 库存只有 2，但本地要 5
  const localCart4 = [
    { productId: p3.id, quantity: 5 }
  ];

  const result4 = mergeCart(testBuyer, localCart4);
  assert(result4.success === true, '合并成功');
  assert(result4.conflicts === 1, '有 1 个冲突');
  assert(result4.conflictDetails[0].originalQty === 5, '原始数量 5');
  assert(result4.conflictDetails[0].adjustedQty === 2, '调整为库存 2');

  const serverCart4 = getServerCart(testBuyer);
  const item4 = serverCart4.find(i => i.product_id === p3.id);
  assert(item4 && item4.quantity === 2, '服务端数量为库存 2');

  // 恢复原始库存
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(originalStock, p3.id);

  console.log('');

  // ========== 测试 5: 混合场景（相加 + 冲突）==========
  console.log('📋 测试 5: 混合场景（相加 + 冲突）');

  // 临时将商品 2 库存设为 10
  const originalStock2 = db.prepare('SELECT stock FROM products WHERE id = ?').get(p2.id).stock;
  db.prepare('UPDATE products SET stock = 10 WHERE id = ?').run(p2.id);

  clearCart(testBuyer);
  // 服务端：商品 1 数量 10
  db.prepare('INSERT INTO carts (buyer_id, product_id, quantity) VALUES (?, ?, ?)')
    .run(testBuyer, p1.id, 10);

  // 本地：商品 1 数量 5，商品 2 数量 100（超过库存 10）
  const localCart5 = [
    { productId: p1.id, quantity: 5 },
    { productId: p2.id, quantity: 100 }
  ];

  const result5 = mergeCart(testBuyer, localCart5);
  assert(result5.success === true, '合并成功');
  assert(result5.merged === 2, '合并 2 个商品');
  assert(result5.conflicts === 1, '1 个冲突（商品 2）');

  const serverCart5 = getServerCart(testBuyer);
  const item5a = serverCart5.find(i => i.product_id === p1.id);
  const item5b = serverCart5.find(i => i.product_id === p2.id);

  assert(item5a && item5a.quantity === 15, '商品 1 数量相加 (10+5=15)');
  assert(item5b && item5b.quantity === 10, '商品 2 调整为库存 10');

  // 恢复原始库存
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(originalStock2, p2.id);

  console.log('');

  // ========== 测试 6: 商品不存在 ==========
  console.log('📋 测试 6: 商品不存在');

  clearCart(testBuyer);
  const localCart6 = [
    { productId: 99999, quantity: 1 } // 不存在的商品
  ];

  const result6 = mergeCart(testBuyer, localCart6);
  assert(result6.success === true, '合并成功（不报错）');
  assert(result6.conflicts === 1, '1 个冲突');
  assert(result6.conflictDetails[0].reason === '商品不存在', '冲突原因：商品不存在');

  const serverCart6 = getServerCart(testBuyer);
  assert(serverCart6.length === 0, '服务端购物车为空（商品不存在被跳过）');

  console.log('');

  // ========== 测试 7: 清空购物车 ==========
  console.log('📋 测试 7: 清空购物车');

  clearCart(testBuyer);
  const serverCart7 = getServerCart(testBuyer);
  assert(serverCart7.length === 0, '清空后购物车为空');

  console.log('');

  // ========== 汇总 ==========
  console.log('========================================');
  console.log(`📊 测试结果：${passed} 通过, ${failed} 失败`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('❌ 自测未通过，请检查代码\n');
    process.exit(1);
  } else {
    console.log('✅ 全部通过！Phase 2 自测完成\n');
  }
}

runTests();
