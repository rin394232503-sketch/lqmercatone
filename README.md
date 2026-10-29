# L&Q Mercatone v2

> 意大利本地百货电商平台
> 基于 Next.js 14 + NestJS + Prisma + Supabase

---

##  项目结构

```
lqmercatone-v2/
├── apps/
│   ├── web/              # Next.js 买家前端
│   │   ├── app/          # 页面路由
│   │   ├── components/   # React 组件
│   │   ├── lib/          # 工具函数
│   │   └── public/       # 静态资源
│   ├── admin/            # React PC 管理后台（待建）
│   └── api/              # NestJS 后端 API
│       ├── src/
│       │   ├── products/ # 商品模块 ✅
│       │   ├── auth/     # 认证模块（基础版）
│       │   ├── prisma/   # 数据库连接
│       │   └── main.ts   # 入口文件
│       └── prisma/
│           └── schema.prisma  # 数据库模型
└── packages/
    ├── db/               # Prisma 共享包
    └── shared/           # 共享类型/工具
```

---

##  已完成功能

### 后端 API

| 模块 | 状态 | API 端点 |
|---|---|---|
| **商品管理** | ✅ 完成 | `GET /api/v1/products` |
| | | `GET /api/v1/products/:id` |
| | | `POST /api/v1/products` |
| | | `PUT /api/v1/products/:id` |
| | | `DELETE /api/v1/products/:id` |
| | | `GET /api/v1/products/categories` |
| **用户认证** | 基础版 | `POST /api/v1/auth/login` |
| | | `POST /api/v1/auth/register` |

---

##  数据库模型

### 核心表

- **users** - 用户（买家/管理员）
- **products** - 商品（金额用欧分存储）
- **orders** - 订单
- **order_items** - 订单明细
- **cart_items** - 购物车
- **addresses** - 收货地址
- **reviews** - 评价
- **coupons** - 优惠券
- **favorites** - 收藏

---

##  下一步

### Week 1 剩余任务

- [ ] 完善 Auth 模块（JWT + Twilio 短信）
- [ ] 创建 Cart 模块（购物车）
- [ ] 创建 Order 模块（订单）
- [ ] 搭建 Next.js 前端
- [ ] 连接前后端测试

---

##  开发命令

```bash
# 启动后端 API（开发模式）
cd apps/api
npm install
npm run prisma:generate
npm run start:dev

# 启动前端（开发模式）
cd apps/web
npm install
npm run dev
```

---

##  环境变量

复制 `.env.example` 为 `.env`，填入：

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
STRIPE_SECRET_KEY=sk_test_...
```

---

**文档版本**: v0.1.0
**最后更新**: 2026-10-30
