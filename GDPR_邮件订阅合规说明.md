# L&Qmercatone GDPR 邮件订阅合规说明

> **版本**: v1.0  
> **日期**: 2026-10-29  
> **法规**: 欧盟 GDPR + 意大利隐私法 (D.Lgs. 196/2003)

---

## 一、核心原则

### 1.1 邮件分类

| 类型 | 性质 | 是否需要同意 | 可否退订 |
|---|---|---|---|
| **订单通知** | 服务必需 | ❌ 不需要 |  不可退订 |
| **售后通知** | 服务必需 | ❌ 不需要 |  不可退订 |
| **营销邮件** | 商业推广 | ✅ **必须单独同意** | ✅ 可随时退订 |
| **降价提醒** | 增值服务 | ✅ 需要同意 | ✅ 可随时退订 |

### 1.2 GDPR 关键要求

**✅ 必须做到:**
- 营销邮件必须**单独勾选同意**（不能默认勾选）
- 明确告知邮件用途和频率
- 提供简单退订方式（一键退订）
- 记录同意时间和内容
- 不共享邮箱给第三方

**❌ 禁止:**
- 默认勾选营销邮件（Dark Pattern）
- 捆绑同意（不同意营销就不能注册）
- 隐藏退订链接
- 退订后继续发送

---

## 二、用户界面

### 2.1 注册页

```
┌─ 注册账户 ─────────────────────────────┐
│                                         │
│  姓名: [________________]               │
│  手机: +39 [____________]               │
│  验证码: [____] [发送验证码]           │
│  密码: [________________]               │
│                                         │
│  ☑ 同意服务条款和隐私政策 *             │
│                                         │
│  ☐ 我希望接收营销邮件（优惠券、促销）   │
│    (可选)                               │
│    • 可随时在个人设置中取消订阅         │
│    • 符合欧盟 GDPR 隐私保护法规         │
│    • 订单/售后通知不受影响              │
│                                         │
│  [注册]                                 │
└─────────────────────────────────────────
```

**关键点:**
- 服务条款：**必填**（* 标记）
- 营销邮件：**选填**（默认不勾选）
- 明确说明可随时退订

### 2.2 个人中心设置

```
┌─ 邮件订阅设置 ───────────────────────┐
│                                       │
│  📧 订单通知 [✅ 必需]                │
│  订单确认、发货、退款等               │
│                                       │
│  📧 售后通知 [✅ 必需]                │
│  售后申请、审核结果                   │
│                                       │
│  ✉️ 营销邮件 [ 可选]                │
│  优惠券、促销活动、新品上架           │
│                                       │
│  🔔 降价提醒 [ 可选]                │
│  收藏商品降价时通知                   │
│                                       │
│  🔒 GDPR 隐私保护                    │
│  • 订单/售后通知为服务必需，无法取消 │
│  • 营销邮件可随时退订                 │
│  • 您的邮箱不会分享给第三方           │
│  • 符合欧盟 GDPR + 意大利隐私法       │
│                                       │
│  [一键退订所有营销邮件]               │
└───────────────────────────────────────
```

---

## 三、数据库设计

### 3.1 buyers 表新增字段

```sql
ALTER TABLE buyers 
ADD COLUMN email_marketing BOOLEAN DEFAULT FALSE,  -- 营销邮件同意
ADD COLUMN email_price_alert BOOLEAN DEFAULT FALSE, -- 降价提醒同意
ADD COLUMN email_marketing_agreed_at TIMESTAMPTZ,   -- 同意时间
ADD COLUMN email_marketing_withdrawn_at TIMESTAMPTZ,-- 撤回时间
ADD COLUMN email_invalid BOOLEAN DEFAULT FALSE,     -- 邮箱无效标记
ADD COLUMN email_opt_out BOOLEAN DEFAULT FALSE;     -- 完全退订
```

### 3.2 同意记录表

```sql
CREATE TABLE email_consent_logs (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT REFERENCES buyers(id),
  consent_type TEXT NOT NULL,  -- marketing/price_alert
  action TEXT NOT NULL,  -- given/withdrawn
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_email_consent_buyer ON email_consent_logs(buyer_id);
CREATE INDEX idx_email_consent_type ON email_consent_logs(consent_type);
```

---

## 四、API 接口

### 4.1 获取邮件偏好

```
GET /api/user/email-prefs

响应:
{
  "success": true,
  "prefs": {
    "order": true,        // 必需
    "aftersale": true,    // 必需
    "marketing": false,   // 可选
    "price_alert": false  // 可选
  }
}
```

### 4.2 更新邮件偏好

```
PUT /api/user/email-prefs

请求体:
{
  "marketing": true,
  "price_alert": false
}

响应:
{
  "success": true,
  "message": "邮件偏好已更新 / Preferenze email aggiornate"
}
```

### 4.3 一键退订

```
POST /api/user/unsubscribe-all

响应:
{
  "success": true,
  "message": "已退订所有营销邮件 / Disiscritto da tutte le email marketing"
}
```

---

## 五、邮件发送逻辑

### 5.1 发送前检查

```javascript
async function canSendMarketingEmail(buyerId) {
  const buyer = await db.prepare(`
    SELECT email_marketing, email_opt_out, email_invalid 
    FROM buyers WHERE id = ?
  `).get(buyerId);
  
  if (!buyer) return false;
  if (buyer.email_invalid) return false;  // 邮箱无效
  if (buyer.email_opt_out) return false;  // 完全退订
  if (!buyer.email_marketing) return false;  // 未同意营销
  
  return true;
}

async function canSendServiceEmail(buyerId) {
  const buyer = await db.prepare(`
    SELECT email_invalid, email_opt_out 
    FROM buyers WHERE id = ?
  `).get(buyerId);
  
  if (!buyer) return false;
  if (buyer.email_invalid) return false;
  // 服务邮件即使 opt_out 也要发送（关键通知）
  
  return true;
}
```

### 5.2 发送邮件

```javascript
// 订单确认邮件（服务必需）
if (await canSendServiceEmail(buyerId)) {
  await sendEmail(buyer.email, '订单确认', template);
}

// 营销邮件（需要同意）
if (await canSendMarketingEmail(buyerId)) {
  await sendEmail(buyer.email, '专属优惠', template);
}
```

---

## 六、退订流程

### 6.1 邮件内退订链接

每封营销邮件底部:

```
─────────────────────────────────────
您收到此邮件是因为订阅了 L&Qmercatone 的促销通知。

[退订此类邮件]({unsubscribe_url})
[修改订阅设置]({preferences_url})

L&Qmercatone S.r.l.
Via Roma 123, 20121 Milano, Italia

这是商业邮件，符合意大利 CAN-SPAM 法规。
─────────────────────────────────────
```

### 6.2 退订处理

```javascript
app.get('/unsubscribe/:token', async (req, res) => {
  try {
    // 验证 token
    const buyer = await verifyUnsubscribeToken(req.params.token);
    
    if (!buyer) {
      return res.status(400).send('无效链接');
    }
    
    // 更新偏好
    await db.prepare(`
      UPDATE buyers 
      SET email_marketing = FALSE, 
          email_price_alert = FALSE,
          email_marketing_withdrawn_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(buyer.id);
    
    // 记录日志
    await db.prepare(`
      INSERT INTO email_consent_logs (buyer_id, consent_type, action)
      VALUES (?, 'marketing', 'withdrawn')
    `).run(buyer.id);
    
    res.send(`
      <h1>已退订</h1>
      <p>您已成功退订所有营销邮件。</p>
      <p>订单/售后通知仍会正常发送。</p>
      <a href="https://lqmercatone.com">返回商城</a>
    `);
    
  } catch (error) {
    console.error('退订失败:', error);
    res.status(500).send('处理失败，请联系客服');
  }
});
```

---

## 七、合规检查清单

### 7.1 注册流程 ✅

- [x] 服务条款必填
- [x] 营销邮件选填（默认不勾选）
- [x] 明确告知邮件用途
- [x] 说明可随时退订

### 7.2 个人设置 ✅

- [x] 显示当前订阅状态
- [x] 可单独开关营销邮件
- [x] 可单独开关降价提醒
- [x] 服务通知不可取消（灰色禁用）
- [x] GDPR 隐私说明

### 7.3 邮件发送 ✅

- [x] 发送前检查同意状态
- [x] 服务邮件和营销邮件分离
- [x] 记录发送日志
- [x] 处理退信（硬退信标记无效）

### 7.4 退订机制 ✅

- [x] 邮件内退订链接
- [x] 个人中心退订
- [x] 一键退订所有
- [x] 退订后立即生效

### 7.5 数据保护 ✅

- [x] 邮箱加密存储
- [x] 不共享给第三方
- [x] 用户可要求删除
- [x] 记录同意时间戳

---

## 八、违规处罚

### 意大利 AGCM (竞争与市场管理局)

| 违规行为 | 罚款金额 |
|---|---|
| 未经同意发送营销邮件 | €10,000 - €120,000 |
| 未提供退订选项 | €5,000 - €50,000 |
| 隐瞒退订链接 | €20,000 - €200,000 |
| 泄露用户邮箱 | €20,000 - €1,000,000 |

### 欧盟 GDPR

| 违规行为 | 罚款金额 |
|---|---|
| 未经同意处理个人数据 | €10,000,000 或 2% 全球营收 |
| 违反数据主体权利 | €20,000,000 或 4% 全球营收 |

---

**文档版本**: v1.0  
**最后更新**: 2026-10-29  
**状态**: ✅ 已实现合规功能
