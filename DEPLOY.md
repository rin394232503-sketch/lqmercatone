# L&Q Mercatone v2 部署指南

## 🚀 部署后端到 Railway

### 步骤 1：创建 Railway 项目

1. 打开 https://railway.app
2. 用 GitHub 账号登录
3. 点 **New Project** → **Deploy from GitHub repo**
4. 选择 `rin394232503-sketch/lqmercatone`
5. 选择分支 `v2-branch`

### 步骤 2：配置 Root Directory

Railway 会问项目根目录。设置为：
```
lqmercatone-v2
```

### 步骤 3：添加环境变量

在 Railway 项目 → Variables 中添加：

```
NODE_ENV=production
PORT=3001

DATABASE_URL=postgresql://postgres:Lin3344521@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:Lin3344521@db.yiyydikfpgbmtdypiggc.supabase.co:5432/postgres

JWT_SECRET=随便一个随机长字符串_至少32个字符
JWT_REFRESH_SECRET=另一个随机长字符串

STRIPE_SECRET_KEY=sk_test_你的密钥
STRIPE_PUBLISHABLE_KEY=pk_test_你的密钥
```

### 步骤 4：部署

Railway 会自动检测 Dockerfile 并构建。等待 3-5 分钟。

### 步骤 5：获取 API 地址

部署成功后，Railway 会给你一个 URL，类似：
```
https://lqmercatone-api.up.railway.app
```

---

## 🌐 部署前端到 Vercel

### 步骤 1：添加环境变量

在 Vercel 项目 → Settings → Environment Variables 中添加：

```
NEXT_PUBLIC_API_URL=https://你的Railway地址/api/v1
```

### 步骤 2：修改 next.config.js

确保 API 代理指向 Railway：

```js
async rewrites() {
  return [{
    source: '/api/v1/:path*',
    destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
  }];
}
```

### 步骤 3：部署

Vercel 会自动从 GitHub 拉取代码并部署。

---

## ✅ 验证部署

1. 访问 Railway API 地址：`https://xxx/api/v1/products`
2. 应该返回商品列表 JSON
3. 访问 Vercel 前端：`https://lqmercatone.vercel.app`
4. 应该能看到首页

---

## 💰 费用

| 服务 | 费用 |
|---|---|
| Railway（Hobby） | $5/月（约€4.60） |
| Vercel（Hobby） | 免费 |
| Supabase（Free） | 免费 |
| **总计** | **~€5/月** |
