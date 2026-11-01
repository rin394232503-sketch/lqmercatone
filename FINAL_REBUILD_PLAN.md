# L&Q Mercatone v2 重建方案（融合现有资产）

> 基于 v1 已有资产 + 最佳实践研究
> 2026-10-30

---

## 📦 已有资产清单（全部保留复用）

| 资产 | 详情 | 复用方式 |
|---|---|---|
| **域名** | lqmercatone.com（GoDaddy） | 继续用，以后可加 .it |
| **GitHub** | rin394232503-sketch/lqmercatone | 开 v2 分支或新仓库 |
| **Vercel** | 已连接 GitHub，自动部署 | 继续用，免费 |
| **Supabase** | yiyydikfpgbmtdypiggc.supabase.co | 继续用，免费 500MB |
| **Supabase Storage** | product-images bucket | 继续用，欧洲节点 |
| **Stripe** | 测试密钥已验证有效 | 继续用，密钥放环境变量 |
| **Twilio** | 账户已创建（验证中） | 以后接短信 |
| **Logo** | logo.svg / logo-icon.svg / logo-light.svg | 直接复用 |
| **商品数据** | Supabase 数据库中的商品 | 迁移到新 Schema |
| **订单数据** | SQLite + Supabase 中的订单 | 导出备份 |

---

## 🏗️ 新架构（在现有基础上升级）

```
保留不变：                          新搭建：
├── 域名 lqmercatone.com         ├── Next.js 14 买家前端
├── Vercel 部署                   ├── NestJS 后端 API
├── Supabase 数据库               ├── Prisma ORM
├── Stripe 支付                   ├── Redis (Upstash)
├── Logo / 图标                   ├── PC 后台 (React + Ant Design)
└── Twilio 账户                   └── Sentry 错误监控
```

---

## 📅 重建时间线（基于现有资产加速）

### Week 1：项目骨架（2-3 天）

**Day 1**
- [ ] 创建 `lqmercatone-v2` GitHub 仓库
- [ ] 初始化 Next.js 14 项目（App Router + TypeScript + TailwindCSS）
- [ ] 初始化 NestJS 项目（TypeScript）
- [ ] 配置 Vercel 连接新仓库

**Day 2**
- [ ] 设计 Prisma Schema（基于 v1 数据 + 新需求）
- [ ] 在 Supabase 运行 migration
- [ ] 配置 Redis（Upstash 免费版）
- [ ] 设置环境变量（Stripe 密钥等）

**Day 3**
- [ ] JWT 鉴权系统（access + refresh token）
- [ ] 基础中间件（错误处理、日志、验证）
- [ ] API 路由规范（/api/v1/*）

### Week 2：核心功能（3-4 天）

**Day 4-5**
- [ ] 商品管理 API（CRUD + 搜索 + 分类）
- [ ] 商品前端页面（列表 + 详情 + 搜索）
- [ ] 图片上传（Supabase Storage）

**Day 6-7**
- [ ] 购物车（Redis + DB 持久化）
- [ ] 收货地址管理
- [ ] 运费计算 API

### Week 3：支付和订单（2-3 天）

**Day 8-9**
- [ ] Stripe 支付集成（3DS 2.0）
- [ ] 订单流程（创建→支付→确认）
- [ ] 结算页 UI

**Day 10**
- [ ] 24h 超时关单（Redis TTL）
- [ ] Webhook 回调处理
- [ ] 订单状态管理

### Week 4：买家完整体验（3-4 天）

**Day 11-12**
- [ ] 个人中心（订单列表/详情）
- [ ] 收藏/足迹
- [ ] 登录/注册（Twilio 短信）

**Day 13-14**
- [ ] 评价系统
- [ ] 优惠券系统
- [ ] 邮件通知（SendGrid）

### Week 5：管理后台（3-4 天）

**Day 15-17**
- [ ] PC 后台项目（React + Ant Design 5）
- [ ] 仪表盘（销售/订单图表）
- [ ] 商品管理页面

**Day 18-19**
- [ ] 订单管理（查看/发货/售后）
- [ ] 优惠券管理
- [ ] 员工/权限管理

### Week 6：收尾上线（3-4 天）

**Day 20-21**
- [ ] GDPR 合规（Cookie/隐私政策）
- [ ] SEO 优化（Next.js SSR + 结构化数据）
- [ ] 性能优化（Lighthouse 90+）

**Day 22-23**
- [ ] 全面测试（功能/安全/压力）
- [ ] 数据迁移（v1 商品/订单导入）
- [ ] 正式上线 🚀

---

## 🗄️ Prisma Schema（基于 v1 数据升级）

核心变化：
1. 金额从 REAL 改为 Int（cent 存储）
2. 新增多语言字段（nameIt / nameZh）
3. 新增 images 数组（Supabase Storage URLs）
4. 新增角色系统（BUYER / ADMIN / WAREHOUSE）
5. 时间戳统一 UTC

---

## 🔄 v1 数据迁移计划

| v1 数据 | v2 目标 | 方式 |
|---|---|---|
| SQLite products | Supabase products | 导出 CSV → 导入新表 |
| SQLite orders | Supabase orders | 导出 CSV → 导入新表 |
| Supabase buyers | v2 users | 直接复用 |
| 商品图片（base64） | Supabase Storage | 逐个上传转换 |
| 操作日志 | v2 operation_logs | 导出备份 |

---

## 💰 成本对比

| 项目 | v1 | v2 |
|---|---|---|
| 前端托管 | Vercel Free | Vercel Free |
| 后端 | 自建服务器 | Railway €5/月 |
| 数据库 | Supabase Free | Supabase Free（复用） |
| Redis | 无 | Upstash Free |
| 存储 | Supabase Free | Supabase Free（复用） |
| 支付 | Stripe | Stripe（复用密钥） |
| **总计** | ~€0 | **~€5/月** |

---

**总结：在现有资产基础上重建，大部分基础设施不用重新申请，只需搭建新代码。**
