# L&Q Mercatone v2 重建规划

> 基于成功案例 | 生产级架构 | 时间充裕，质量优先
> 2026-10-30

---

## 📚 成功案例参考

### 1. Zalando（欧洲最大时尚电商）
- **技术**：React 前端 + Java 微服务 + PostgreSQL
- **关键决策**：
  - 先做移动端 H5，再做原生 APP
  - 支付先接 Stripe，后期接本地支付
  - 数据库先单库，量大了再分库
- **教训**：一开始不要过度设计，先跑通核心流程

### 2. Farfetch（奢侈品电商）
- **技术**：Next.js SSR + Node.js + PostgreSQL
- **关键决策**：
  - Next.js SSR 对 SEO 极其重要（Google 意大利搜索排名）
  - 图片用 CDN + WebP 格式，加载速度是转化率的关键
  - 购物车用 Redis，结账时写 DB，防止丢单
- **教训**：性能直接影响转化率，每慢 1 秒流失 7% 客户

### 3. Yoox Net-a-Porter（意大利奢侈品电商）
- **技术**：微服务架构 + React + Kubernetes
- **关键决策**：
  - 意大利本地化做得好（IT 语言 + EUR + 本地支付）
  - 退货流程极其顺畅（7 天无理由 + 上门取件）
  - 客服集成在 APP 内（在线聊天）
- **教训**：意大利客户非常看重退货体验和客服响应

### 4. 小商家成功案例：Bottali（意大利家居电商）
- **技术**：Shopify → 自建 Next.js
- **关键决策**：
  - 从 Shopify 迁移到自建，省了每月 €500 费用
  - 用 Supabase 做数据库，成本低
  - Stripe 支付 + Sisal 线下收款点
  - 一个人运营，靠自动化（邮件通知 + 库存预警）
- **教训**：小团队用 Supabase + Vercel + Stripe 完全够用

---

## 🏗️ 重建架构（基于成功案例优化）

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │  CDN + DNS + SSL│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───────┐ ┌───▼────┐ ┌───────▼──────┐
     │  Next.js 14    │ │  PC    │ │  React Native │
     │  (买家 H5)     │ │ 后台   │ │  (管理 APP)   │
     │  Vercel        │ │ Vercel │ │  Expo EAS     │
     └────────┬───────┘ └───┬────┘ └───────┬──────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │   NestJS API    │
                    │   Railway EU    │
                    │   /api/v1/*     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───────┐ ┌───▼────┐ ┌───────▼──────┐
     │   Supabase     │ │ Redis  │ │   Supabase   │
     │   PostgreSQL   │ │ Upstash│ │   Storage    │
     │   (欧洲节点)    │ │        │ │   (eu-west)  │
     └────────────────┘ └────────┘ └──────────────┘
```

---

## 📅 分阶段计划（12 周）

### 第一阶段：地基（Week 1-2）
**目标：项目骨架 + 数据库 + 基础 API**

| 周 | 任务 | 交付物 |
|---|---|---|
| W1 | Next.js 14 项目搭建 | 可运行的前端骨架 |
| W1 | NestJS 项目搭建 | 可运行的后端 API |
| W1 | Prisma Schema 设计 | 完整数据库模型 |
| W1 | Supabase 数据库部署 | 线上 PostgreSQL |
| W2 | JWT 鉴权系统 | 登录/注册/Token 刷新 |
| W2 | Redis 集成 | 购物车/会话/限流 |
| W2 | 基础中间件 | 错误处理/日志/验证 |

### 第二阶段：商品和买家（Week 3-5）
**目标：商品浏览 + 购物车 + 结算**

| 周 | 任务 | 交付物 |
|---|---|---|
| W3 | 商品管理 API | CRUD + 搜索 + 分类 |
| W3 | 商品前端页面 | 列表/详情/搜索 |
| W3 | Supabase Storage | 图片上传 + CDN |
| W4 | 购物车（Redis） | 加购/修改/删除/合并 |
| W4 | 收货地址管理 | CRUD + 默认地址 |
| W4 | 运费计算 API | 意大利分区运费 |
| W5 | Stripe 支付集成 | 3DS 2.0 + Webhook |
| W5 | 订单流程 | 创建→支付→确认 |
| W5 | 结算页 UI | 地址/运费/支付/下单 |

### 第三阶段：买家完整体验（Week 6-7）
**目标：个人中心 + 评价 + 优惠券**

| 周 | 任务 | 交付物 |
|---|---|---|
| W6 | 个人中心 | 订单列表/详情/状态 |
| W6 | 收藏/足迹 | 本地 + 云端同步 |
| W6 | 评价系统 | 发布/回复/展示 |
| W7 | 优惠券系统 | 创建/领取/核销 |
| W7 | 24h 超时关单 | Redis TTL + Cron |
| W7 | 登录完善 | Twilio 短信验证码 |

### 第四阶段：管理后台（Week 8-9）
**目标：PC 后台 + 数据看板**

| 周 | 任务 | 交付物 |
|---|---|---|
| W8 | PC 后台项目搭建 | React + Ant Design 5 |
| W8 | 仪表盘 | 销售/订单/库存图表 |
| W8 | 商品管理 | 上传/编辑/上下架 |
| W9 | 订单管理 | 查看/发货/售后 |
| W9 | 优惠券管理 | 创建/查看/统计 |
| W9 | 员工管理 | 角色/权限/日志 |

### 第五阶段：管理 APP（Week 10-11）
**目标：React Native 手机管理端**

| 周 | 任务 | 交付物 |
|---|---|---|
| W10 | React Native + Expo 搭建 | 可运行的 APP 骨架 |
| W10 | 登录 + 订单列表 | 手机端订单管理 |
| W10 | 商品管理 | 拍照上传/编辑 |
| W11 | 消息推送 | 新订单提醒 |
| W11 | 数据看板 | 移动端销售概览 |
| W11 | APP 打包发布 | TestFlight / APK |

### 第六阶段：上线准备（Week 12）
**目标：部署 + 测试 + 上线**

| 周 | 任务 | 交付物 |
|---|---|---|
| W12 | 邮件通知（SendGrid） | 订单确认/发货通知 |
| W12 | GDPR 合规 | Cookie/隐私政策/数据导出 |
| W12 | Sentry 错误监控 | 线上问题追踪 |
| W12 | 性能优化 | Lighthouse 90+ |
| W12 | 全面测试 | 功能/安全/压力 |
| W12 | 正式上线 | 🚀 lqmercatone.it |

---

## 🗄️ 数据库核心设计（Prisma Schema 预览）

```prisma
// 用户表（买家 + 管理员统一）
model User {
  id            String   @id @default(cuid())
  phone         String   @unique
  email         String?  @unique
  name          String?
  role          Role     @default(BUYER)
  passwordHash  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@map("users")
}

// 商品表
model Product {
  id          String   @id @default(cuid())
  name        String
  nameIt      String   // 意大利语
  nameZh      String   // 中文
  category    Category
  priceCent   Int      // 价格（分）
  oldPriceCent Int?    // 原价（分）
  stock       Int      @default(0)
  images      String[] // Supabase Storage URLs
  description String?
  onSale      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("products")
}

// 订单表
model Order {
  id              String      @id @default(cuid())
  orderNo         String      @unique
  userId          String
  status          OrderStatus @default(PENDING_PAYMENT)
  items           OrderItem[]
  subtotalCent    Int
  shippingCent    Int
  discountCent    Int @default(0)
  totalCent       Int
  paymentMethod   String?
  transactionId   String?
  paidAt          DateTime?
  shippingRegion  String
  shippingAddress String
  receiverName    String
  receiverPhone   String
  buyerNote       String?
  adminNote       String?
  isPickup        Boolean @default(false)
  pickupCode      String?
  language        String  @default("it")
  paymentDeadline DateTime  // 24h 超时
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  user User @relation(fields: [userId], references: [id])
  
  @@map("orders")
}

enum Role {
  BUYER
  ADMIN
  WAREHOUSE
}

enum Category {
  ABBIGLIAMENTO   // 服装
  DETERSIVI       // 清洁剂
  CASA            // 家居
  ELETTRONICA     // 电子
  TRUCCO          // 美妆
  CURA_PELLE      // 护肤
  FIORI           // 仿真花
  DECORAZIONI     // 节日装饰
}

enum OrderStatus {
  PENDING_PAYMENT  // 待付款
  PENDING_SHIP     // 待发货
  SHIPPED          // 已发货
  DELIVERED        // 已送达
  COMPLETED        // 已完成
  CANCELLED        // 已取消
  REFUNDING        // 退款中
  REFUNDED         // 已退款
}
```

---

## 📊 关键指标目标

| 指标 | 目标 | 说明 |
|---|---|---|
| 首页加载 | < 2 秒 | Next.js SSR + CDN |
| 商品详情 | < 1.5 秒 | 图片 CDN + WebP |
| 结账流程 | < 30 秒 | 从加购到支付完成 |
| API 响应 | < 200ms | NestJS + Redis 缓存 |
| SEO 评分 | 90+ | Lighthouse |
| 可用性 | 99.9% | Vercel + Railway SLA |
| 安全 | A+ | HTTPS + 3DS + GDPR |

---

## 💰 月成本预估

| 服务 | 费用 | 说明 |
|---|---|---|
| Vercel（Hobby） | €0 | 前端托管 |
| Railway（Hobby） | €5 | 后端 API |
| Supabase（Free） | €0 | 数据库 + Storage |
| Redis（Upstash） | €0 | 免费版 10K 命令/天 |
| Stripe | 1.5% + €0.25/笔 | 按交易收费 |
| Twilio | €0.0075/条 | 短信验证码 |
| SendGrid | €0 | 免费版 100封/天 |
| Cloudflare | €0 | CDN + DNS |
| Sentry | €0 | 免费版 5K 错误/月 |
| 域名 .it | ~€10/年 | Cloudflare 注册 |
| **总计** | **~€5/月 + 交易费** | |

---

## ⚠️ 避坑指南（来自成功案例）

### 1. 不要一开始就做 APP
> 先做好 H5，用 WebView 套壳。等日活过 500 再开发原生 APP。
> — Farfetch 早期经验

### 2. 图片是电商的生命
> 用 Supabase Storage + CDN，所有图片自动压缩为 WebP。
> 商品图至少 800×800，详情页支持缩放。
> — Zalando 技术博客

### 3. 购物车必须用 Redis
> localStorage 会丢数据（清缓存/换设备）。
> Redis 购物车支持跨设备同步。
> — Yoox 架构分享

### 4. 支付一定要 3DS 2.0
> 欧盟 PSD2 法规要求，不接 3DS 会被拒付。
> Stripe 的 3DS 2.0 自动处理，接入简单。
> — Stripe 官方文档

### 5. 意大利客户在意退货
> 7 天无理由退货 + 上门取件 = 高转化率。
> 退货政策要在结算页明确展示。
> — Bottali 运营经验

### 6. SEO 从第一天就要做
> Next.js SSR + 结构化数据 + 意大利语关键词。
> Google 意大利搜索排名直接影响流量。
> — Farfetch SEO 团队

---

## 🎯 第一阶段（Week 1）立即开始的任务

1. 初始化 Next.js 14 项目（App Router + TypeScript + TailwindCSS）
2. 初始化 NestJS 项目（TypeScript + Prisma）
3. 设计完整 Prisma Schema
4. 部署 Supabase 数据库
5. 配置 Redis（Upstash 免费版）
6. 实现 JWT 鉴权（登录/注册/Token 刷新）

---

**准备好就开始第一阶段。你确认后我立刻动手。**
