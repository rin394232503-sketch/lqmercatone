/**
 * Stripe 支付模块
 * 支持两种模式：
 * - 模拟模式 (USE_MOCK=true)：本地模拟支付流程，无需 Stripe API
 * - 真实模式 (USE_MOCK=false)：调用 Stripe API，需要有效密钥
 */

const { stripe, CURRENCY, STRIPE_WEBHOOK_SECRET, USE_MOCK } = require('./stripe-config');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// 连接数据库
const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// =============================================
// 模拟模式：本地模拟 Stripe 支付流程
// =============================================

/**
 * 模拟创建支付意图
 */
function mockCreatePaymentIntent(order) {
  const paymentIntentId = 'pi_mock_' + crypto.randomBytes(16).toString('hex');
  const clientSecret = paymentIntentId + '_secret_' + crypto.randomBytes(16).toString('hex');
  const amountInCents = Math.round(order.totalAmount * 100);

  // 记录到数据库
  try {
    db.prepare(`
      UPDATE orders
      SET transaction_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_no = ?
    `).run(paymentIntentId, order.orderNo);
  } catch (e) {
    console.error('更新订单 transaction_id 失败:', e.message);
  }

  console.log(`💳 [模拟] 创建支付意图: ${paymentIntentId} | 金额: €${order.totalAmount}`);

  return {
    success: true,
    clientSecret,
    paymentIntentId,
    mock: true,
  };
}

/**
 * 模拟支付成功（用于测试）
 */
function mockConfirmPayment(paymentIntentId) {
  try {
    const order = db.prepare(`
      SELECT order_no FROM orders WHERE transaction_id = ?
    `).get(paymentIntentId);

    if (order) {
      db.prepare(`
        UPDATE orders
        SET status = 'pending_ship',
            payment_status = 'paid',
            paid_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_no = ? AND status = 'pending_payment'
      `).run(order.order_no);

      console.log(`✅ [模拟] 订单 ${order.order_no} 支付成功 → 待发货`);

      // 记录操作日志
      try {
        db.prepare(`
          INSERT INTO operation_logs (action, target_type, target_id, details, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          'payment_success_mock',
          'order',
          order.order_no,
          JSON.stringify({ mock: true, payment_intent: paymentIntentId })
        );
      } catch (e) { /* ignore */ }
    }

    return { success: true, status: 'succeeded' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// 真实模式：Stripe API
// =============================================

/**
 * 真实创建支付意图
 */
async function realCreatePaymentIntent(order) {
  try {
    const amountInCents = Math.round(order.totalAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: CURRENCY,
      automatic_payment_methods: {
        enabled: true,
      },
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
      metadata: {
        order_id: order.orderId,
        order_no: order.orderNo,
        buyer_phone: order.buyerPhone || '',
      },
      receipt_email: order.email || undefined,
      description: `L&Qmercatone 订单 ${order.orderNo}`,
    });

    db.prepare(`
      UPDATE orders
      SET transaction_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_no = ?
    `).run(paymentIntent.id, order.orderNo);

    console.log(`💳 创建支付意图: ${paymentIntent.id} | 金额: €${order.totalAmount}`);

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      mock: false,
    };

  } catch (error) {
    console.error('创建支付意图失败:', error.message);
    return { success: false, error: error.message };
  }
}

// =============================================
// 统一入口（自动选择模式）
// =============================================

/**
 * 创建支付意图（统一入口）
 */
async function createPaymentIntent(order) {
  if (USE_MOCK || !stripe) {
    return mockCreatePaymentIntent(order);
  }
  return realCreatePaymentIntent(order);
}

/**
 * 获取支付状态
 */
async function getPaymentIntentStatus(paymentIntentId) {
  if (USE_MOCK || !stripe) {
    return { success: true, status: 'succeeded', mock: true };
  }
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return { success: true, status: intent.status, paymentMethod: intent.payment_method };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// Webhook 处理
// =============================================

function handleWebhook(body, signature) {
  if (USE_MOCK || !STRIPE_WEBHOOK_SECRET) {
    return { success: true, event: { type: 'mock.webhook' } };
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    console.log(` Webhook 事件: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        handlePaymentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        handlePaymentCanceled(event.data.object);
        break;
      default:
        console.log(`未处理的事件类型: ${event.type}`);
    }

    return { success: true, event };
  } catch (error) {
    console.error('Webhook 验证失败:', error.message);
    return { success: false, error: error.message };
  }
}

function handlePaymentSucceeded(paymentIntent) {
  const orderNo = paymentIntent.metadata?.order_no;
  if (!orderNo) return;

  const result = db.prepare(`
    UPDATE orders
    SET status = 'pending_ship',
        payment_status = 'paid',
        paid_at = CURRENT_TIMESTAMP,
        transaction_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE order_no = ? AND status = 'pending_payment'
  `).run(paymentIntent.id, orderNo);

  if (result.changes > 0) {
    console.log(`✅ 订单 ${orderNo} 支付成功 → 待发货`);
  }
}

function handlePaymentFailed(paymentIntent) {
  const orderNo = paymentIntent.metadata?.order_no;
  if (!orderNo) return;
  const errorMsg = paymentIntent.last_payment_error?.message || '未知错误';
  console.log(`❌ 订单 ${orderNo} 支付失败: ${errorMsg}`);
}

function handlePaymentCanceled(paymentIntent) {
  const orderNo = paymentIntent.metadata?.order_no;
  if (!orderNo) return;
  console.log(`⚠️ 订单 ${orderNo} 支付已取消`);
}

function verifyWebhookSignature(req, res, next) {
  if (USE_MOCK) {
    res.json({ received: true, mock: true });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: '缺少 Stripe 签名' });
  }

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const result = handleWebhook(body, signature);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ received: true });
}

module.exports = {
  createPaymentIntent,
  getPaymentIntentStatus,
  handleWebhook,
  verifyWebhookSignature,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handlePaymentCanceled,
  mockConfirmPayment,
};
