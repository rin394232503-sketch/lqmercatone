# L&Q Mercatone 技术架构规范

> v2.0 | 2026-10-30 | 生产级重构规格

---

## 项目信息

- **项目名称**：L&Q Mercatone 自营电商商城
- **业务**：意大利本地百货（仿真花、家居、节日装饰、小家电、日用杂货）
- **客户**：意大利本地居民 + 海外华人
- **模式**：纯自营 B2C，无商家入驻
- **货币**：欧元（EUR），保留 2 位小数
- **域名**：.it 域名，Cloudflare 套 CDN

---

## 三端

| 端 | 说明 |
|---|---|
| A. 买家端 | 移动端 H5（主）+ 套壳 APP（WebView / React Native） |
| B. PC 管理后台 | 电脑浏览器 |
| C. 管理员手机 APP | React Native（iOS + Android） |

---

## 语言

- 中文（zh-CN）+ 意大利语（it-IT）
- **暂不加英文**

---

## 技术栈（固定）

| 层级 | 技术 |
|---|---|
| **前端买家端** | Next.js 14（App Router）+ TailwindCSS + TypeScript |
| **PC 后台** | React + Vite + Ant Design 5 |
| **管理 APP** | React Native + Expo |
| **后端** | Node.js + NestJS + TypeScript |
| **数据库** | PostgreSQL（Supabase） |
| **ORM** | Prisma |
| **缓存/会话** | Redis（购物车、库存锁、验证码限流） |
| **文件存储** | Supabase Storage（欧洲区域 eu-west） |
| **鉴权** | JWT（access token 15min + refresh token 7d） |
| **短信** | Twilio（意大利号段） |
| **邮件** | Resend 或 SendGrid |
| **支付** | SisalPay API + Stripe（信用卡 3DS2.0） |
| **前端部署** | Vercel / Cloudflare Pages |
| **后端部署** | Railway / Fly.io（欧洲节点） |
| **DB** | Supabase |
| **日志** | Sentry（错误监控）+ 自建访问日志 |

---

## 强制要求

1. **所有 API 走 `/api/v1` 前缀**
2. **所有金额用整数分（cent）存储**，前端格式化为欧元
3. **所有时间戳 UTC 存储**，前端按 `Europe/Rome` 时区显示
4. **Git 分支**：`main`（生产）/ `develop`（开发）/ `feature/*`（功能）
5. **提交前跑 lint + typecheck + test**

---

## 现有已完成功能（v1 简易版）

以下功能已在 v1 版本实现，v2 重构时需要保留/升级：

- [x] 买家首页（商品列表、分类、搜索）
- [x] 商品详情页
- [x] 购物车（localStorage → 需改为 Redis）
- [x] 结算页（Stripe 支付已集成）
- [x] 个人中心（订单列表、收藏、足迹）
- [x] 登录/注册（手机号验证码 → 需接 Twilio）
- [x] PC 管理后台（仪表盘、商品管理、订单管理）
- [x] 手机管理 APP（深色主题、商品管理、订单处理）
- [x] JWT 鉴权（3 种角色：buyer/admin/warehouse）
- [x] 运费计算（意大利分区）
- [x] 24h 超时关单
- [x] GDPR 合规（Cookie 同意、隐私政策）
- [x] 操作日志
- [x] 验证码日志
- [x] Logo 和图标设计

---

## v2 重构优先级

### P0 - 核心架构
1. Next.js 14 项目初始化（App Router + TypeScript）
2. NestJS 后端项目初始化
3. Prisma Schema 设计（基于 Supabase PostgreSQL）
4. Redis 集成（购物车、会话、限流）
5. JWT 鉴权重构（access + refresh token）

### P1 - 支付和订单
6. Stripe 3DS 2.0 完整集成
7. SisalPay API 对接
8. 订单流程（创建→支付→发货→完成）
9. 24h 超时关单（Redis + Cron）

### P2 - 买家端功能
10. 商品浏览/搜索/分类
11. 购物车（Redis）
12. 结算页
13. 个人中心
14. 评价系统
15. 优惠券系统

### P3 - 管理端
16. PC 后台（Ant Design 5）
17. 管理 APP（React Native + Expo）
18. 库存管理
19. 数据报表

### P4 - 基础设施
20. Twilio 短信集成
21. 邮件通知（SendGrid）
22. Sentry 错误监控
23. 部署配置（Vercel + Railway）
24. Cloudflare CDN + .it 域名

---

## 数据库设计要点

### 核心表
- `users` - 买家/管理员统一用户表
- `products` - 商品（金额用 cent 存储）
- `orders` - 订单（金额用 cent 存储）
- `order_items` - 订单明细
- `carts` - 购物车（Redis 缓存 + DB 持久化）
- `reviews` - 评价
- `coupons` - 优惠券
- `addresses` - 收货地址
- `verification_codes` - 验证码（Redis）
- `operation_logs` - 操作日志

### 金额存储规则
```
数据库：整数分（cent）
例：€9.99 → 存储 999
前端显示：formatCents(999) → "€9.99"
```

### 时间存储规则
```
数据库：UTC 时间戳
前端显示：toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
```
