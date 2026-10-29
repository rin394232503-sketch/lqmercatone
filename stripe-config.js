/**
 * Stripe 支付配置
 * 开发模式：模拟支付（无需真实 Stripe API）
 * 正式模式：填入有效密钥后自动切换
 */

const Stripe = require('stripe');

// 真实 Stripe 测试密钥（通过环境变量配置）
// 部署时在 Vercel 后台设置环境变量：
//   STRIPE_SECRET_KEY = sk_test_xxxxx
//   STRIPE_PUBLISHABLE_KEY = pk_test_xxxxx
//   STRIPE_WEBHOOK_SECRET = whsec_xxxxx
const USE_MOCK = !process.env.STRIPE_SECRET_KEY; // 没有密钥时自动用模拟模式

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// 货币代码
const CURRENCY = 'eur'; // 欧元

// 3DS 2.0 配置（PSD2 合规）
const PAYMENT_METHOD_OPTIONS = {
  card: {
    request_three_d_secure: 'automatic', // 自动触发 3DS 2.0（符合 PSD2）
  },
};

// Stripe 客户端（仅在密钥有效时初始化）
let stripe = null;
if (STRIPE_SECRET_KEY && !USE_MOCK) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
  });
}

module.exports = {
  stripe,
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
  CURRENCY,
  PAYMENT_METHOD_OPTIONS,
  USE_MOCK,
};
