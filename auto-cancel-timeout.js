/**
 * L&Qmercatone 超时自动关单脚本
 * 
 * 功能:
 * 1. 检测超过 24 小时未支付的订单 (status='pending')
 * 2. 自动关闭订单 (status → 'cancelled')
 * 3. 释放锁定的库存 (stock + N)
 * 4. 推送通知给买家
 * 
 * 运行方式:
 * - 手动: node auto-cancel-timeout.js
 * - 定时: cron job (建议每小时运行一次)
 * - 集成: 每日巡检时调用
 */

const SUPABASE_URL = 'https://yiyydikfpgbmtdypiggc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yk7pSAVz4iQ_oFaF0ybUEQ_xd92I2LM';

// 获取所有超时订单
async function getTimeoutOrders() {
  const now = new Date();
  const timeoutHours = 24;
  const cutoffTime = new Date(now.getTime() - timeoutHours * 60 * 60 * 1000).toISOString();
  
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?select=*&status=eq.pending&created_at=lt.${cutoffTime}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  
  if (!response.ok) {
    console.error('❌ 查询超时订单失败:', response.statusText);
    return [];
  }
  
  const orders = await response.json();
  console.log(`🔍 找到 ${orders.length} 个超时订单`);
  return orders;
}

// 关闭订单 + 释放库存
async function cancelOrderAndReleaseStock(order) {
  console.log(`\n📋 处理订单: ${order.order_no}`);
  console.log(`   客户: ${order.customer_name}`);
  console.log(`   创建时间: ${order.created_at}`);
  console.log(`   超时: ${Math.floor((Date.now() - new Date(order.created_at).getTime()) / 3600000)} 小时`);
  
  // 1. 更新订单状态为 cancelled
  const updateResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: 'timeout_unpaid'
      })
    }
  );
  
  if (!updateResponse.ok) {
    console.error(`   ❌ 更新订单状态失败`);
    return false;
  }
  
  console.log(`   ✅ 订单状态已更新: pending → cancelled`);
  
  // 2. 释放库存 (从 items JSON 解析商品和数量)
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  
  for (const item of items) {
    if (!item.id) continue;
    
    // 获取当前库存
    const productResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=eq.${item.id}&select=stock`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    
    if (!productResponse.ok) {
      console.error(`   ❌ 查询商品 ${item.id} 库存失败`);
      continue;
    }
    
    const products = await productResponse.json();
    if (products.length === 0) {
      console.error(`   ❌ 商品 ${item.id} 不存在`);
      continue;
    }
    
    const currentStock = products[0].stock;
    const qty = item.qty || 1;
    const newStock = currentStock + qty;
    
    // 更新库存
    const stockUpdateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=eq.${item.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stock: newStock })
      }
    );
    
    if (stockUpdateResponse.ok) {
      console.log(`   ✅ 库存已释放: ${item.name} ${currentStock} → ${newStock} (+${qty})`);
    } else {
      console.error(`   ❌ 更新库存失败: ${item.name}`);
    }
  }
  
  // 3. 记录操作日志
  const logResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/operation_logs`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        account: 'system',
        role: 'auto',
        action: 'auto_cancel_timeout',
        target_type: 'order',
        target_id: order.order_no,
        before_value: { status: 'pending', stock_locked: items.reduce((sum, i) => sum + (i.qty || 1), 0) },
        after_value: { status: 'cancelled', stock_released: items.reduce((sum, i) => sum + (i.qty || 1), 0) },
        device_info: 'auto-cancel-script',
        created_at: new Date().toISOString()
      })
    }
  );
  
  if (logResponse.ok) {
    console.log(`   ✅ 操作日志已记录`);
  }
  
  return true;
}

// 推送通知给买家 (预留接口)
async function notifyBuyer(order) {
  console.log(`   📧 推送通知给买家: ${order.customer_name}`);
  console.log(`      内容: 订单 ${order.order_no} 已超时自动关闭`);
  
  // TODO: 集成邮件/短信推送服务
  // 示例:
  // await sendEmail({
  //   to: order.customer_email,
  //   subject: '订单超时关闭通知 / Ordine scaduto',
  //   body: `
  //     尊敬的 ${order.customer_name},
  //     
  //     您的订单 ${order.order_no} 已超过 24 小时未支付，已自动关闭。
  //     如有需要，请重新下单。
  //     
  //     Gentile ${order.customer_name},
  //     
  //     Il tuo ordine ${order.order_no} è stato chiuso automaticamente 
  //     dopo 24 ore senza pagamento.
  //     
  //     L&Qmercatone
  //   `
  // });
  
  console.log(`   ⚠️  通知功能待集成 (邮件/短信服务)`);
}

// 主函数
async function main() {
  console.log('🚀 开始执行超时订单自动关单...\n');
  console.log(`⏰ 当前时间: ${new Date().toISOString()}`);
  console.log(`⏱️  超时阈值：24 小时\n`);
  
  const orders = await getTimeoutOrders();
  
  if (orders.length === 0) {
    console.log('\n✅ 没有超时订单，任务完成');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const order of orders) {
    try {
      const success = await cancelOrderAndReleaseStock(order);
      if (success) {
        await notifyBuyer(order);
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`❌ 处理订单 ${order.order_no} 失败:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 执行结果:`);
  console.log(`   总计: ${orders.length} 个订单`);
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`    失败: ${failCount}`);
  console.log(`${'='.repeat(50)}\n`);
}

// 执行
main().catch(error => {
  console.error('💥 脚本执行失败:', error);
  process.exit(1);
});
