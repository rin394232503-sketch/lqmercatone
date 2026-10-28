/**
 * 测试超时关单功能
 * 
 * 创建一个测试订单（创建时间设为 25 小时前），然后运行关单脚本
 */

const SUPABASE_URL = 'https://yiyydikfpgbmtdypiggc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yk7pSAVz4iQ_oFaF0ybUEQ_xd92I2LM';

async function createTestOrder() {
  console.log('🧪 创建测试订单...\n');
  
  const orderData = {
    order_no: 'TEST-' + Date.now(),
    customer_name: '测试客户 Test Customer',
    customer_phone: '+39 000 000 0000',
    customer_address: 'Via Test 123, Milano',
    payment_method: 'sisal',
    note: '测试订单，可安全删除',
    items: JSON.stringify([{
      id: 30,
      name: 'Felpa Verde Oliva (测试)',
      emoji: '',
      qty: 1,
      price: 9.90,
      category: 'Abbigliamento'
    }]),
    total_amount: 9.90,
    item_count: 1,
    status: 'pending',
    // 设置为 25 小时前
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  };
  
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/orders`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderData)
    }
  );
  
  if (response.ok) {
    const order = await response.json();
    console.log('✅ 测试订单创建成功:');
    console.log(`   订单号: ${order.order_no}`);
    console.log(`   创建时间: ${order.created_at}`);
    console.log(`   状态: ${order.status}`);
    console.log(`   超时: 25 小时（应被自动关闭）\n`);
    console.log('👉 现在运行: node auto-cancel-timeout.js');
  } else {
    console.error('❌ 创建测试订单失败:', response.statusText);
  }
}

createTestOrder();
