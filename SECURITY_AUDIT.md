# L&Q Mercatone v2 安全审计报告

> 审计角色：资深 Web 安全红队工程师 + 电商后端审计专家
> 审计范围：OWASP Top10 + 支付安全 + 并发竞态 + GDPR
> 审计日期：2026-10-30
> 代码版本：commit 17ef02d (v2-branch)

---

# 第 1 轮：OWASP Top10 基础全量扫描

## 漏洞 #1.1 — 严重 — 买家手机号登录无需验证码校验

**位置：** `auth.service.ts:20-48` `loginWithPhone()`

**攻击利用方式：**
攻击者调用 `POST /api/v1/auth/phone-login` 传入任意意大利手机号（如 `+393331234567`），后端**直接查找或创建用户并返回 JWT Token**。代码注释写着"验证码验证由 Twilio 处理，这里假设验证码已通过"——但没有任何实际校验逻辑。

**业务影响：**
- 任何人可以用任意手机号登录，无需验证码
- 可以冒充任何买家账户
- 可以查看他人订单、地址、优惠券
- **直接导致整个认证体系失效**

**修复方案：**
```typescript
// 在 loginWithPhone 中强制校验验证码
async loginWithPhone(phone: string, code: string) {
  // 1. 从 Redis/DB 查找最近的验证码记录
  const record = await this.prisma.verificationCode.findFirst({
    where: { phone, status: 'sent' },
    orderBy: { createdAt: 'desc' },
  });
  // 2. 验证码必须在 5 分钟内
  if (!record || Date.now() - record.createdAt.getTime() > 5 * 60 * 1000) {
    throw new BadRequestException('验证码已过期');
  }
  // 3. 验证码必须匹配
  if (record.code !== code) {
    // 标记失败
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { status: 'failed' },
    });
    throw new BadRequestException('验证码错误');
  }
  // 4. 标记已验证
  await this.prisma.verificationCode.update({
    where: { id: record.id },
    data: { status: 'verified' },
  });
  // 5. 继续登录流程...
}
```

---

## 漏洞 #1.2 — 严重 — 短信验证码无频率限制（SMS Bombing）

**位置：** `auth.controller.ts:14-17`（当前无验证码发送端点，但规划中有）

**攻击利用方式：**
当接入 Twilio 发送验证码后，攻击者可以用脚本高频调用发送接口，对任意手机号轰炸短信，导致：
- Twilio 费用爆炸（€0.0075/条 × 数万次）
- 目标手机号被短信骚扰

**修复方案：**
- Redis 限流：同一手机号 60 秒内只能发 1 次，1 小时内最多 5 次
- IP 限流：同一 IP 24 小时内最多请求 20 次验证码
- 接入图形验证码（reCAPTCHA）防止自动化

---

## 漏洞 #1.3 — 高危 — JWT Secret 硬编码在 .env 文件中并推送到 GitHub

**位置：** `.env` 文件内容包含真实的 `sk_test_` Stripe 密钥

**攻击利用方式：**
1. `.env` 文件虽然被 `.gitignore` 排除，但之前已被提交到 git history 中
2. 任何有仓库读取权限的人都能从 git log 中恢复密钥
3. Stripe 测试密钥泄露 → 攻击者可以创建任意金额的 PaymentIntent

**修复方案：**
```bash
# 1. 立即在 Stripe Dashboard 滚动（revoke）所有已泄露的密钥
# 2. 生成新的 sk_test_ 和 pk_test_
# 3. 使用 BFG Repo Cleaner 清除 git history 中的密钥
# 4. .env 绝对不要提交，使用 Render Dashboard 的环境变量界面
```

---

## 漏洞 #1.4 — 高危 — Webhook 端点无签名校验时可被伪造

**位置：** `stripe.controller.ts:35-42` `handleWebhook()`

**攻击利用方式：**
当 `STRIPE_WEBHOOK_SECRET` 为空字符串时（当前状态），`stripe.webhooks.constructEvent()` 会**抛出异常**，但代码中捕获后返回 `{ received: true }`（看 `stripe.service.ts:75-88`）。

攻击者可以：
1. 向 `/api/v1/payment/webhook` 发送伪造的 `payment_intent.succeeded` 事件
2. 传入任意 `orderId`
3. 后端将订单标记为已付款，但实际没有收到钱
4. **直接导致资金损失**

**修复方案：**
```typescript
// stripe.service.ts
async handleWebhook(payload: Buffer, signature: string) {
  const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
  
  // 必须校验：密钥不能为空
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET 未配置，拒绝所有 Webhook');
  }

  let event: Stripe.Event;
  try {
    event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    // 记录攻击日志
    this.logger.error(`Webhook 签名验证失败: ${err.message}`);
    throw new BadRequestException('Invalid signature');
  }
  // ...
}
```

---

## 漏洞 #1.5 — 高危 — createPaymentIntent 无鉴权，任意用户可为任意订单创建支付

**位置：** `stripe.controller.ts:25-28` `createPaymentIntent()`

**攻击利用方式：**
`POST /api/v1/payment/create-intent` 没有 `@UseGuards(AuthGuard('jwt'))`。攻击者可以：
1. 不登录，直接调用接口
2. 传入任意 `orderId`（通过枚举或猜测）
3. 为他人订单创建 PaymentIntent
4. 获取 clientSecret 后用测试卡完成支付
5. **将他人订单标记为已付款**

**修复方案：**
```typescript
@Post('create-intent')
@UseGuards(AuthGuard('jwt'))
async createPaymentIntent(
  @Req() req: { user: any },
  @Body() body: { orderId: string }
) {
  // 验证订单属于当前用户
  return this.stripeService.createPaymentIntent(body.orderId, req.user.id);
}
```
并在 service 中加：
```typescript
if (order.userId !== userId) {
  throw new ForbiddenException('订单不属于当前用户');
}
```

---

## 漏洞 #1.6 — 中危 — 管理员注册接口权限校验不足

**位置：** `auth.controller.ts:32-36` `registerAdmin()`

**攻击利用方式：**
`registerAdmin` 只要求 JWT 认证（`@UseGuards(AuthGuard('jwt'))`），但**不校验角色**。任何已登录的买家（role: BUYER）都可以调用此接口创建管理员账号：
```bash
POST /api/v1/auth/register-admin
Authorization: Bearer <buyer_token>
{ "phone": "+39333999999", "password": "hacked", "role": "ADMIN" }
```
买家直接提升为管理员。

**修复方案：**
```typescript
// 添加角色守卫
@Post('register-admin')
@UseGuards(AuthGuard('jwt'), AdminRoleGuard)  // 新增角色守卫
async registerAdmin(@Req() req: { user: any }, @Body() dto: RegisterAdminDto) {
  // 只允许 ADMIN 角色创建新管理员，不允许 WAREHOUSE
  if (req.user.role !== 'ADMIN') {
    throw new ForbiddenException('仅超级管理员可创建账号');
  }
  // 强制角色为 WAREHOUSE，不允许前端指定 ADMIN
  dto.role = 'WAREHOUSE';
  return this.authService.registerAdmin(dto);
}
```

---

## 漏洞 #1.7 — 中危 — 评价接口无鉴权

**位置：** `reviews.controller.ts:29-40` `createReview()`

**攻击利用方式：**
`POST /api/v1/reviews` 有 `@UseGuards(AuthGuard('jwt'))`，但 `GET /api/v1/reviews/product/:productId` 和 `GET /api/v1/reviews` 没有。这本身是合理的（评价列表公开可读），但 `adminReplyReview` 端点（第 3 个路由）需要确认是否也有鉴权。

查看代码发现 `adminReplyReview` 在 controller 第 3 个路由有 `@UseGuards`，但 `getAllReviews` 没有角色校验——任何登录用户都能查看所有评价（含管理员视角）。

**修复方案：**
`getAllReviews` 应添加 `@UseGuards(AuthGuard('jwt'))` 和角色守卫，确保只有 ADMIN/WAREHOUSE 可调用。

---

## 漏洞 #1.8 — 低危 — CORS 配置暴露开发环境

**位置：** `main.ts:18-25`

**问题：** 生产环境 CORS 白名单包含 `http://localhost:3000`。虽然不会直接被利用，但如果攻击者能控制用户的本地环境（通过 XSS），可以利用这个宽松配置。

**修复方案：**
```typescript
app.enableCors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://lqmercatone.com', 'https://lqmercatone.vercel.app']
    : ['http://localhost:3000'],
  credentials: true,
});
```

---

# 第 2 轮：核心攻击链路审计

## 漏洞 #2.1 — 严重 — 库存扣减无事务保护，并发超卖

**位置：** `orders.service.ts:107-113`

**攻击利用方式：**
攻击者用两个客户端**同时**对同一商品（stock=1）下单：

```
时间线：
T1: 客户端A 检查库存 stock=1 >= qty=1 ✅
T2: 客户端B 检查库存 stock=1 >= qty=1 ✅  
T3: 客户端A 创建订单
T4: 客户端B 创建订单
T5: 客户端A 扣库存 stock: 1-1=0
T6: 客户端B 扣库存 stock: 0-1=-1 ❌ 超卖！
```

`createOrder` 中步骤 3（检查库存）和步骤 7（扣减库存）**不是原子操作**。两个并发请求可以同时通过检查，然后都扣库存导致负数。

**修复方案（Prisma 交互式事务 + 乐观锁）：**
```typescript
async createOrder(userId: string, data: {...}) {
  // 使用 Prisma 交互式事务
  return this.prisma.$transaction(async (tx) => {
    const cart = await tx.cartItem.findMany({ where: { userId }, include: { product: true } });
    
    const orderItems: any[] = [];
    let subtotalCent = 0;

    for (const cartItem of cart) {
      // 在事务内用 SELECT ... FOR UPDATE 锁行（PostgreSQL）
      const product = await tx.product.findUnique({
        where: { id: cartItem.productId },
      });

      if (!product || product.stock < cartItem.quantity) {
        throw new BadRequestException(`商品 ${product?.nameIt} 库存不足`);
      }

      // 在事务内立即扣减库存（乐观锁）
      await tx.product.update({
        where: { id: cartItem.productId },
        data: { stock: { decrement: cartItem.quantity } },
      });

      orderItems.push({...});
      subtotalCent += product.priceCent * cartItem.quantity;
    }

    // 创建订单
    const order = await tx.order.create({...});
    
    // 清空购物车
    await tx.cartItem.deleteMany({ where: { userId } });

    return order;
  }, {
    maxWait: 5000,
    timeout: 10000,
  });
}
```

---

## 漏洞 #2.2 — 严重 — 订单金额完全由后端计算，但前端可绕过

**位置：** `orders.service.ts:62-65`

**攻击利用方式：**
虽然金额由后端计算（这是对的），但**运费硬编码为 499 欧分（€4.99）**，没有根据收货区域动态计算。攻击者可以：
1. 修改前端请求，将 `shippingRegion` 改为西西里岛/撒丁岛（应付更高运费）
2. 后端仍按 €4.99 收费
3. **运费损失**

更严重的是：`discountCent` 硬编码为 0，但代码结构允许未来接入优惠券时如果没有校验，攻击者可以通过修改请求参数篡改折扣金额。

**修复方案：**
- 运费必须通过独立的运费计算服务/函数获取，不允许前端传入
- 折扣金额必须从数据库中的优惠券记录获取，不允许前端传入
- 所有金额字段（subtotalCent, shippingCent, discountCent, totalCent）必须由后端 100% 计算

---

## 漏洞 #2.3 — 高危 — 优惠券可重复使用（无原子性检查）

**位置：** `coupons.service.ts:137-181` `useCoupon()`

**攻击利用方式：**
`useCoupon` 分两步操作：
1. 查询优惠券是否未使用（`usedAt: null`）
2. 更新为已使用

并发攻击：
```
T1: 攻击者线程A 查询 userCoupon: usedAt=null ✅
T2: 攻击者线程B 查询 userCoupon: usedAt=null ✅
T3: 线程A 标记 usedAt=now
T4: 线程B 标记 usedAt=now（覆盖，但优惠券已用两次）
```

两张订单使用了同一张优惠券。

**修复方案：**
```typescript
// 使用 Prisma 原子更新 + 条件
const result = await this.prisma.userCoupon.updateMany({
  where: {
    id: couponId,
    userId,
    usedAt: null,  // 只有未使用时才能更新
  },
  data: {
    usedAt: new Date(),
    usedOrderId: orderId,
  },
});

if (result.count === 0) {
  throw new BadRequestException('优惠券不可用（已使用或不属于你）');
}
```

---

## 漏洞 #2.4 — 高危 — 优惠券叠加开关未实际执行

**位置：** `coupons.service.ts` + `orders.service.ts`

**攻击利用方式：**
Coupon 模型有 `stackable` 字段，但 `orders.service.ts` 中 `discountCent` 硬编码为 0。当未来接入优惠券核销时：
- 攻击者在结算时同时传入多个优惠券 ID
- 如果后端不检查 `stackable` 字段，多张优惠券可叠加使用
- **直接资金损失**

**修复方案：**
在订单创建流程中，如果使用了优惠券：
```typescript
// 检查优惠券是否可叠加
if (coupon && !coupon.stackable) {
  const existingDiscount = await this.prisma.order.findFirst({
    where: { userId, couponId: { not: null }, status: { not: 'CANCELLED' } },
  });
  if (existingDiscount) {
    throw new BadRequestException('该优惠券不可与其他优惠叠加');
  }
}
```

---

## 漏洞 #2.5 — 高危 — 取消订单恢复库存无并发保护

**位置：** `orders.service.ts:250-281` `cancelOrder()`

**攻击利用方式：**
攻击者并发调用取消接口：
```
T1: 线程A 查询订单 status=PENDING_PAYMENT ✅
T2: 线程B 查询订单 status=PENDING_PAYMENT ✅
T3: 线程A 恢复库存 stock: +1
T4: 线程B 恢复库存 stock: +1（多恢复了！）
T5: 线程A 更新状态为 CANCELLED
T6: 线程B 更新状态为 CANCELLED
```

库存被多恢复，攻击者可以用同一订单多次获取库存。

**修复方案：**
```typescript
// 使用原子更新 + 条件
const result = await this.prisma.order.updateMany({
  where: {
    id: orderId,
    userId,
    status: 'PENDING_PAYMENT',
  },
  data: {
    status: 'CANCELLED',
    cancelReason: reason,
    cancelledAt: new Date(),
  },
});

if (result.count === 0) {
  throw new BadRequestException('订单不可取消');
}

// 只有 updateMany 成功时才恢复库存
// 但仍有并发问题，需要使用事务
await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.findFirst({
    where: { id: orderId, userId, status: 'PENDING_PAYMENT' },
    include: { items: true },
  });
  if (!order) throw new BadRequestException('订单不可取消');

  await tx.order.update({
    where: { id: orderId },
    data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() },
  });

  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
});
```

---

## 漏洞 #2.6 — 中危 — 24h 超时关单可被绕过

**位置：** `orders.service.ts:87` `paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)`

**攻击利用方式：**
`paymentDeadline` 在创建订单时由后端设置，这部分是安全的。但**超时关单的定时任务**（如果实现了的话）依赖前端或定时脚本扫描。如果：
1. 定时任务未正确实现
2. 或者攻击者在第 23 小时 59 分发起支付
3. 支付回调在第 24 小时 01 分到达
4. 超时任务可能已经取消了订单，但支付已经成功

导致**订单状态不一致**：钱扣了但订单被取消。

**修复方案：**
- 超时关单必须使用数据库级别的原子操作
- 支付回调必须检查订单当前状态，如果已取消则自动退款
- 使用 Redis TTL + 延迟队列（Bull/BullMQ）实现精确超时

---

## 漏洞 #2.7 — 中危 — 购物车合并逻辑可被滥用

**位置：** `cart.service.ts:188-207` `mergeCart()`

**攻击利用方式：**
`mergeCart` 接收前端传入的 `guestItems` 数组。攻击者可以：
1. 传入 1000 个商品项，每个数量 999
2. 虽然每项都会检查库存，但大量无效请求消耗服务器资源
3. **DoS 攻击**

**修复方案：**
- 限制合并请求中最多 50 个商品项
- 限制单项最大数量为 99
- 对合并接口添加 rate limiting

---

# 第 3 轮：后台权限专项审计

## 漏洞 #3.1 — 严重 — 优惠券创建接口无角色校验

**位置：** `coupons.controller.ts:67-80` `createCoupon()`

**攻击利用方式：**
`POST /api/v1/coupons/admin/create` 只有 `@UseGuards(AuthGuard('jwt'))`，**任何登录用户**（包括普通买家）都可以调用创建优惠券：
```bash
POST /api/v1/coupons/admin/create
Authorization: Bearer <buyer_token>
{
  "code": "FREE100",
  "type": "NO_THRESHOLD",
  "valueCent": 10000,
  "minOrderCent": 0,
  "startsAt": "2026-01-01",
  "endsAt": "2030-12-31"
}
```
买家创建了一张 €100 无门槛优惠券，然后自己领取并使用。

**修复方案：**
```typescript
@Post('admin/create')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')  // 自定义角色装饰器
async createCoupon(@Req() req: { user: any }, @Body() body: {...}) {
  if (req.user.role !== 'ADMIN') {
    throw new ForbiddenException('仅管理员可创建优惠券');
  }
  // ...
}
```

---

## 漏洞 #3.2 — 严重 — 优惠券 getAll 接口无角色校验

**位置：** `coupons.controller.ts:84-93` `getAllCoupons()`

**攻击利用方式：**
`GET /api/v1/coupons/admin/all` 只有 JWT 认证，任何登录用户都可以查看所有优惠券的完整信息（包括未公开的优惠券代码、面额、有效期）。攻击者可以：
1. 获取所有优惠券代码
2. 批量领取
3. **薅羊毛**

**修复方案：** 添加 `@Roles('ADMIN')` 守卫。

---

## 漏洞 #3.3 — 高危 — 评价 adminReply 接口无角色校验

**位置：** `reviews.controller.ts` — `adminReplyReview` 路由

**攻击利用方式：**
管理员回复评价的接口如果只有 JWT 认证（没有角色校验），任何登录买家都可以调用：
```bash
POST /api/v1/reviews/{reviewId}/reply
Authorization: Bearer <buyer_token>
{ "reply": "这是恶意回复" }
```
买家可以冒充管理员回复评价，**损害商家信誉**。

**修复方案：** 添加角色守卫，仅 ADMIN 角色可调用。

---

## 漏洞 #3.4 — 高危 — 订单详情接口无归属校验

**位置：** `orders.controller.ts:42-47` `getOrder()`

**攻击利用方式：**
```typescript
async getOrder(@Param('id') id: string) {
  return this.ordersService.getOrderById(id);
}
```
没有传入 `userId`，service 中 `getOrderById` 也不校验订单归属。攻击者可以：
1. 枚举订单 ID（cuid 虽然随机但可通过其他方式获取）
2. 查看他人订单详情（收货地址、电话、购买商品）
3. **泄露客户隐私（GDPR 违规）**

**修复方案：**
```typescript
async getOrder(@Req() req: { user: any }, @Param('id') id: string) {
  // 管理员可以查看所有订单
  if (req.user.role === 'ADMIN' || req.user.role === 'WAREHOUSE') {
    return this.ordersService.getOrderById(id);
  }
  // 买家只能查看自己的订单
  return this.ordersService.getOrderById(id, req.user.id);
}

// service 中
async getOrderById(orderId: string, userId?: string) {
  const where: any = { id: orderId };
  if (userId) where.userId = userId;  // 强制归属校验
  
  const order = await this.prisma.order.findUnique({ where, ... });
  if (!order) throw new NotFoundException('订单不存在');
  return order;
}
```

---

## 漏洞 #3.5 — 中危 — 订单取消接口 IDOR（不安全的直接对象引用）

**位置：** `orders.service.ts:250-281` `cancelOrder()`

**攻击利用方式：**
虽然 `cancelOrder` 校验了 `userId`，但攻击者可以：
1. 创建订单 A（自己的）
2. 创建订单 B（别人的，通过 IDOR 获取 ID）
3. 调用 cancelOrder 取消订单 B
4. 由于 where 条件同时检查 `userId` 和 `orderId`，如果 orderId 不属于该用户，查询返回 null，抛 NotFoundException——这部分**实际上是安全的**。

但 `updateOrderStatus`（管理员接口）没有校验角色：
```typescript
async updateOrderStatus(orderId: string, status: string, adminNote?: string) {
  // 没有校验调用者是否为管理员！
  const order = await this.prisma.order.findUnique({ where: { id: orderId } });
  // 任何登录用户都可以修改任何订单状态！
}
```

**修复方案：** 在 controller 层添加角色守卫，service 层添加管理员身份校验。

---

## 漏洞 #3.6 — 中危 — 地址管理 IDOR

**位置：** `addresses.service.ts` — 所有方法都校验了 `userId`

**分析：** 地址的 CRUD 操作都在 service 中通过 `userId` 过滤，这部分**相对安全**。但需要确认 controller 是否正确传递了 `req.user.id`。

检查 controller 代码确认所有地址操作都使用了 `req.user.id`，这部分**通过**。

---

# 第 4 轮：二次反向找茬（修复绕过分析）

## 漏洞 #4.1 — 严重 — 修复方案中的事务仍然有死锁风险

**位置：** 第 2 轮修复建议中的 `$transaction`

**绕过方式：**
即使使用了 Prisma 交互式事务，在 PostgreSQL 中如果两个事务同时锁定同一行（同一商品的库存行），会产生**死锁**。PostgreSQL 会自动回滚其中一个事务，但：
1. 被回滚的事务不会自动重试
2. 用户收到 500 错误
3. **可用性攻击**：攻击者故意制造大量并发请求，让正常用户的订单全部因死锁失败

**修复方案：**
- 事务内按固定的顺序（如 productId 升序）锁定行，避免死锁
- 添加自动重试机制（最多 3 次）
- 使用 Redis 分布式锁作为第一层防护

---

## 漏洞 #4.2 — 高危 — Stripe Webhook 幂等性缺失

**位置：** `stripe.service.ts:111-127` `handlePaymentSuccess()`

**绕过方式：**
Stripe 的 Webhook **可能重复推送**同一个事件（网络抖动、重试）。当前代码：
```typescript
await this.prisma.order.update({
  where: { id: orderId },
  data: { status: 'PENDING_SHIP', paymentStatus: 'paid', paidAt: new Date() },
});
```

如果同一个 `payment_intent.succeeded` 事件被推送两次：
1. 第一次：订单状态 PENDING_PAYMENT → PENDING_SHIP ✅
2. 第二次：订单状态 PENDING_SHIP → PENDING_SHIP（无害，但...）

更严重的是，如果攻击者伪造 webhook 事件（在密钥泄露的情况下），可以反复触发状态变更。

**修复方案：**
```typescript
private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  
  // 使用 Prisma 的 updateMany + where 条件实现幂等
  const result = await this.prisma.order.updateMany({
    where: {
      id: orderId,
      status: 'PENDING_PAYMENT',  // 只有待付款状态才能转为已付款
      paymentStatus: 'pending',
    },
    data: {
      status: 'PENDING_SHIP',
      paymentStatus: 'paid',
      paidAt: new Date(),
      transactionId: paymentIntent.id,
    },
  });

  if (result.count === 0) {
    // 订单已被处理过，忽略重复推送
    this.logger.warn(`订单 ${orderId} 已处理，忽略重复 Webhook`);
    return;
  }
}
```

---

## 漏洞 #4.3 — 高危 — 支付回调中未校验金额

**位置：** `stripe.service.ts:111-127`

**绕过方式：**
Stripe Webhook 的 `payment_intent.succeeded` 事件包含 `amount_received` 字段。当前代码**没有校验**实际收到的金额是否等于订单金额。

攻击者可以（在测试模式下）：
1. 创建 €100 的订单
2. 通过 Stripe 只支付 €1
3. Stripe 返回 `payment_intent.succeeded`（因为确实支付成功了）
4. 后端不校验金额，直接将 €100 的订单标记为已付款
5. **资金损失 €99**

**修复方案：**
```typescript
private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  
  const order = await this.prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  // 校验实际收到金额是否等于订单金额
  if (paymentIntent.amount_received !== order.totalCent) {
    this.logger.error(`金额不匹配！订单 ${orderId}: 应收 ${order.totalCent}, 实收 ${paymentIntent.amount_received}`);
    // 标记为异常，人工审核
    await this.prisma.order.update({
      where: { id: orderId },
      data: { adminNote: `⚠️ 金额不匹配: 应收${order.totalCent} 实收${paymentIntent.amount_received}` },
    });
    return;
  }

  // 金额匹配，继续处理...
}
```

---

## 漏洞 #4.4 — 中危 — Refresh Token 无吊销机制

**位置：** `auth.service.ts:141-148` `refreshToken()`

**绕过方式：**
1. 攻击者获取用户的 refresh token（通过 XSS、中间人、日志泄露）
2. 用户修改密码或登出
3. 攻击者的 refresh token **仍然有效**（7 天）
4. 攻击者用旧 refresh token 获取新的 access token
5. **持续控制用户账户**

**修复方案：**
- 在数据库中维护 refresh token 的黑名单/白名单
- 用户登出时将 refresh token 加入黑名单
- refresh token 使用旋转机制（每次刷新颁发新的，旧的立即失效）
- 修改密码时吊销所有 refresh token

---

## 漏洞 #4.5 — 中危 — JWT Payload 中 role 可被前端伪造

**位置：** `jwt.strategy.ts` + 所有使用 `req.user.role` 的地方

**绕过方式：**
JWT 的 payload 包含 `{ sub: userId, role }`。虽然 JWT 有签名保护，但如果 `JWT_SECRET` 泄露（已在漏洞 #1.3 中指出），攻击者可以：
1. 用泄露的 secret 伪造 JWT
2. 在 payload 中设置 `role: "ADMIN"`
3. 以管理员身份调用所有后台接口

**修复方案：**
- **永远不要信任 JWT payload 中的角色信息做权限判断**
- 每次请求都从数据库重新查询用户角色：
```typescript
// jwt.strategy.ts
async validate(payload: { sub: string }) {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, phone: true },
  });
  // 角色从数据库获取，不信任 JWT payload
  return user;
}
```

---

## 漏洞 #4.6 — 中危 — Supabase Storage 图片上传路径遍历

**位置：** `server.js`（v1 中的上传逻辑）

**绕过方式：**
如果图片上传使用用户提供的文件名构造存储路径：
```javascript
const fileName = `products/${req.file.originalname}`;
```
攻击者上传文件名为 `../../etc/passwd.jpg` 的文件，可能覆盖系统文件（取决于存储配置）。

**修复方案：**
- 永远不要用 `originalname` 构造存储路径
- 使用 UUID 作为文件名：`${uuid()}.${ext}`
- 校验文件 MIME type（不仅是扩展名）
- 限制文件大小
- 存储路径固定为 `/product-images/{uuid}.{ext}`

---

## 漏洞 #4.7 — 低危 — 错误信息泄露数据库结构

**位置：** `auth.service.ts:68` `throw new UnauthorizedException('账号不存在')`

**问题：** 错误信息"账号不存在"告诉攻击者该用户名/手机号是否已注册。

**修复方案：**
统一返回模糊错误信息："用户名或密码错误"，不区分是账号不存在还是密码错误。

---

# GDPR 合规检查

## 漏洞 #G.1 — 中危 — 用户数据导出功能缺失

**要求：** GDPR Art. 20 数据可携带权

**现状：** v1 中有 `/api/user/export-data` 端点，但 v2 中尚未实现。

## 漏洞 #G.2 — 中危 — 账号删除不彻底

**要求：** GDPR Art. 17 被遗忘权

**现状：** User 模型有 `deletedAt` 字段（软删除），但关联数据（订单、评价、地址）不会被级联删除。客户个人信息（手机号、地址）在订单表中永久保留。

**修复方案：**
- 账号注销时匿名化关联数据中的个人信息
- 订单保留（财务需要）但将 `receiverName`、`receiverPhone`、`shippingAddress` 替换为 "已注销用户"

## 漏洞 #G.3 — 低危 — 日志中记录敏感信息

**位置：** `stripe.service.ts:126` `console.log(订单 ${orderId} 支付成功)`

**问题：** 生产环境不应使用 `console.log`，应使用结构化日志（如 Winston/Pino），且不记录用户手机号、地址等敏感信息。

---

# 未解决风险汇总清单

| # | 风险 | 等级 | 状态 |
|---|---|---|---|
| 1 | 买家登录无验证码校验 | 🔴 严重 | ❌ 未修复 |
| 2 | 短信无频率限制 | 🔴 严重 | ❌ 未实现 |
| 3 | JWT Secret / Stripe 密钥在 git history 中 | 🔴 严重 | ⚠️ 部分修复 |
| 4 | Webhook 签名未强制校验 | 🔴 严重 | ❌ 未修复 |
| 5 | createPaymentIntent 无鉴权 | 🔴 严重 | ❌ 未修复 |
| 6 | 库存扣减无事务（并发超卖） | 🔴 严重 | ❌ 未修复 |
| 7 | 优惠券重复使用（非原子） | 🟠 高危 | ❌ 未修复 |
| 8 | 优惠券创建/查看无角色校验 | 🟠 高危 | ❌ 未修复 |
| 9 | 订单详情无归属校验（IDOR） | 🟠 高危 | ❌ 未修复 |
| 10 | 管理员注册无角色校验 | 🟠 高危 | ❌ 未修复 |
| 11 | Webhook 不校验金额 | 🟠 高危 | ❌ 未修复 |
| 12 | Webhook 不幂等 | 🟠 高危 | ❌ 未修复 |
| 13 | 取消订单无并发保护 | 🟠 高危 | ❌ 未修复 |
| 14 | Refresh Token 无吊销 | 🟡 中危 | ❌ 未修复 |
| 15 | JWT role 不查数据库 | 🟡 中危 | ❌ 未修复 |
| 16 | 运费硬编码 | 🟡 中危 | ❌ 未修复 |
| 17 | CORS 含 localhost | 🟡 中危 | ❌ 未修复 |
| 18 | GDPR 数据删除不彻底 | 🟡 中危 | ❌ 未修复 |
| 19 | 图片上传路径遍历 | 🟡 中危 | ❌ 未修复 |

---

# 可继续深挖的攻击面

1. **Redis 未部署** — 购物车、验证码限流、库存锁都依赖 Redis，当前全部缺失
2. **SisalPay 未集成** — 线下支付回调的安全校验未审计
3. **Twilio 未接入** — 短信验证码完整流程未审计
4. **Prisma Schema 与数据库不同步** — 枚举改 String 后，数据库中的 enum 类型可能不匹配
5. **Next.js 前端** — SSR 页面是否有敏感信息泄露、API routes 是否安全
6. **管理后台（PC/APP）** — 尚未开发，权限体系需要从零审计
7. **Docker/容器安全** — Render 运行环境的隔离性
8. **依赖供应链** — npm 依赖是否有已知 CVE（需要 `npm audit`）
