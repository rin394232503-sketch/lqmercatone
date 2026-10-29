/**
 * Stripe 支付模块自测（支持模拟模式）
 */

const { createPaymentIntent, getPaymentIntentStatus, handleWebhook, mockConfirmPayment } = require('./stripe-payment');
const { USE_MOCK } = require('./stripe-config');
const Database = require('better-sqlite3');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  OK ' + testName);
    passed++;
  } else {
    console.log('  FAIL ' + testName);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log(' Stripe Payment Module Test (' + (USE_MOCK ? 'Mock Mode' : 'Real Stripe API') + ')');
  console.log('========================================\n');

  const testDb = new Database(path.join(__dirname, 'data', 'shop.db'));

  // ========== Test 1: Config ==========
  console.log('Test 1: Config Loading');
  assert(typeof USE_MOCK === 'boolean', 'USE_MOK is boolean');
  console.log('  Mode: ' + (USE_MOCK ? 'Mock' : 'Real Stripe API'));
  console.log('');

  // ========== Test 2: Create PaymentIntent ==========
  console.log('Test 2: Create PaymentIntent');

  const testOrder = {
    orderNo: 'TEST-' + Date.now(),
    orderId: 'test-' + Date.now(),
    totalAmount: 9.99,
    buyerPhone: '+393331234567',
    email: 'test@test.com',
  };

  const result = await createPaymentIntent(testOrder);
  assert(result.success === true, 'createPaymentIntent success');
  assert(typeof result.clientSecret === 'string', 'returns clientSecret');
  assert(typeof result.paymentIntentId === 'string', 'returns paymentIntentId');

  console.log('  PaymentIntent ID: ' + result.paymentIntentId);
  console.log('');

  // ========== Test 3: Get Payment Status ==========
  console.log('Test 3: Get Payment Status');

  const statusResult = await getPaymentIntentStatus(result.paymentIntentId);
  assert(statusResult.success === true, 'getStatus success');
  assert(typeof statusResult.status === 'string', 'status field exists');
  console.log('');

  // ========== Test 4: Mock Payment Confirm ==========
  console.log('Test 4: Mock Payment Confirm');

  // Create a real test order in DB first
  const testOrderNo = 'MOCK-' + Date.now();
  testDb.prepare(
    'INSERT INTO orders (order_no, customer_name, customer_phone, customer_address, items_json, total_amount, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(testOrderNo, 'Test User', '+393331234567', 'Via Test 1', '[]', 9.99, 'pending_payment', 'pending');

  // Create payment intent linked to this order
  const payResult = await createPaymentIntent({ orderNo: testOrderNo, totalAmount: 9.99 });

  const confirmResult = mockConfirmPayment(payResult.paymentIntentId);
  assert(confirmResult.success === true, 'mockConfirmPayment success');
  assert(confirmResult.status === 'succeeded', 'status is succeeded');

  // Verify DB updated
  const updated = testDb.prepare('SELECT status, payment_status FROM orders WHERE order_no = ?').get(testOrderNo);
  assert(updated && updated.status === 'pending_ship', 'order status -> pending_ship');
  assert(updated && updated.payment_status === 'paid', 'payment_status -> paid');

  // Cleanup
  testDb.prepare('DELETE FROM orders WHERE order_no = ?').run(testOrderNo);
  console.log('');

  // ========== Test 5: Webhook ==========
  console.log('Test 5: Webhook Handling');

  const webhookResult = handleWebhook('{}', 'test-sig');
  assert(webhookResult.success === true, 'webhook handled (mock mode)');
  console.log('');

  // ========== Test 6: Edge amounts ==========
  console.log('Test 6: Edge Amounts');

  const minR = await createPaymentIntent({ ...testOrder, orderNo: 'MIN-' + Date.now(), totalAmount: 0.50 });
  assert(minR.success === true, 'min amount EUR 0.50 OK');

  const maxR = await createPaymentIntent({ ...testOrder, orderNo: 'MAX-' + Date.now(), totalAmount: 9999.99 });
  assert(maxR.success === true, 'max amount EUR 9999.99 OK');
  console.log('');

  // ========== Summary ==========
  console.log('========================================');
  console.log(' Results: ' + passed + ' passed, ' + failed + ' failed');
  console.log('========================================\n');

  if (failed > 0) {
    console.log(' FAIL - some tests failed\n');
    process.exit(1);
  } else {
    console.log(' ALL PASSED! Payment module ready.\n');
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
