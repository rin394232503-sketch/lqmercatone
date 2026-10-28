# L&Qmercatone Supabase Storage 配置指南

> **日期**: 2026-10-29  
> **状态**:  待配置

---

## 一、为什么选择 Supabase Storage？

### 优势 ✅

| 特性 | 说明 |
|---|---|
| **性价比高** | 免费额度：1GB 存储 + 2GB 流量/月 |
| **欧洲节点** | 海外访问速度快（意大利客户友好） |
| **原生集成** | 与 Supabase 数据库无缝对接 |
| **安全可靠** | 自动 HTTPS + CDN |
| **易于管理** | Web 控制台 + API 双操作 |

### 免费额度

```
存储: 1GB (约 1000 张 1MB 图片)
流量: 2GB/月 (约 2000 次图片访问)
CDN:  包含在内
```

### 付费方案（如需扩展）

| 方案 | 价格 | 存储 | 流量 |
|---|---|---|---|
| Pro | $25/月 | 100GB | 100GB/月 |
| Team | $599/月 | 1TB | 1TB/月 |

**建议**: 初期用免费额度，月销 500 单内足够。

---

## 二、配置步骤

### 步骤 1: 创建 Storage Bucket

1. 登录 [Supabase Dashboard](https://supabase.com)
2. 选择项目: `yiyydikfpgbmtdypiggc`
3. 左侧菜单 → **Storage**
4. 点击 **New Bucket**
5. 配置:
   ```
   Name: product-images
   Public: ✅ (公开访问)
   File size limit: 5MB (单张图片)
   Allowed MIME types: image/jpeg, image/png, image/webp
   ```

### 步骤 2: 配置 RLS 策略

在 Storage 页面 → **Policies** → 添加以下策略:

**策略 1: 公开读取**
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

**策略 2: 认证用户上传**
```sql
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);
```

**策略 3: 用户上传者可修改**
```sql
CREATE POLICY "Owner Update"
ON storage.objects FOR UPDATE
USING (auth.uid() = owner);
```

**策略 4: 用户上传者可删除**
```sql
CREATE POLICY "Owner Delete"
ON storage.objects FOR DELETE
USING (auth.uid() = owner);
```

### 步骤 3: 获取 API Keys

在 Supabase Dashboard → **Settings** → **API**

```
Project URL: https://yiyydikfpgbmtdypiggc.supabase.co
Anon Key: sb_publishable_yk7pSAVz4iQ_oFaF0ybUEQ_xd92I2LM
Service Role Key: [需要生成 - 仅后端使用]
```

️ **重要**: Service Role Key 不能暴露在前端！

---

## 三、代码集成

### 前端上传（使用 Anon Key）

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yiyydikfpgbmtdypiggc.supabase.co',
  'sb_publishable_yk7pSAVz4iQ_oFaF0ybUEQ_xd92I2LM'
);

// 上传图片
async function uploadImage(file, productId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) {
    console.error('上传失败:', error);
    return null;
  }
  
  // 获取公开 URL
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);
  
  return publicUrl;
}

// 使用示例
const file = document.getElementById('imageInput').files[0];
const imageUrl = await uploadImage(file, 30);
console.log('图片 URL:', imageUrl);
// https://yiyydikfpgbmtdypiggc.supabase.co/storage/v1/object/public/product-images/30/1730217600000.jpg
```

### 后端上传（使用 Service Role Key）

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  'https://yiyydikfpgbmtdypiggc.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ⚠️ 仅后端
);

// 管理员上传（无限制）
async function adminUploadImage(file, productId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabaseAdmin.storage
    .from('product-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true  // 管理员可覆盖
    });
  
  if (error) throw error;
  
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('product-images')
    .getPublicUrl(fileName);
  
  return publicUrl;
}
```

---

## 四、数据库更新

### products 表新增字段

```sql
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

-- images 字段格式:
-- ["https://...image1.jpg", "https://...image2.jpg"]
```

### 更新商品图片

```sql
UPDATE products 
SET images = '["https://...image1.jpg", "https://...image2.jpg"]',
    image_url = 'https://...image1.jpg'  -- 主图（兼容旧代码）
WHERE id = 30;
```

---

## 五、CDN 优化

### 图片压缩参数

Supabase Storage 支持 URL 参数压缩:

```
原图:   https://.../image.jpg?width=1000
缩略图: https://.../image.jpg?width=200
WebP:   https://.../image.jpg?format=webp
```

### 前端使用示例

```html
<!-- 商品列表缩略图 -->
<img src="${imageUrl}?width=200&format=webp" />

<!-- 详情页大图 -->
<img src="${imageUrl}?width=800&format=webp" />

<!-- 原图（下载） -->
<a href="${imageUrl}" download>下载原图</a>
```

---

## 六、迁移方案

### 从 Base64 迁移到 Storage

**步骤 1: 批量导出 Base64 图片**
```javascript
// 从数据库读取所有 base64 图片
const products = await supabase
  .from('products')
  .select('id, image_url')
  .eq('image_url', 'data:image/%');

// 上传到 Storage
for (const product of products) {
  const base64Data = product.image_url.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const fileName = `${product.id}/migrated_${Date.now()}.jpg`;
  await supabaseAdmin.storage
    .from('product-images')
    .upload(fileName, buffer, {
      contentType: 'image/jpeg',
      upsert: false
    });
  
  // 更新数据库
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('product-images')
    .getPublicUrl(fileName);
  
  await supabase
    .from('products')
    .update({ image_url: publicUrl })
    .eq('id', product.id);
}
```

**步骤 2: 验证迁移**
```sql
-- 检查还有多少 base64 图片
SELECT COUNT(*) 
FROM products 
WHERE image_url LIKE 'data:image/%';

-- 应该返回 0
```

**步骤 3: 清理旧数据**
```sql
-- 备份后删除 base64 数据（可选）
UPDATE products 
SET image_url = NULL 
WHERE image_url LIKE 'data:image/%';
```

---

## 七、监控与维护

### 查看存储使用量

Supabase Dashboard → **Storage** → 查看:
- 总存储量
- 本月流量
- Bucket 大小

### 设置告警

**免费额度告警**:
- 存储使用 > 800MB → 邮件通知
- 流量使用 > 1.6GB → 邮件通知

**方法**: Supabase Dashboard → **Settings** → **Billing** → 设置使用量告警

### 定期清理

```bash
# 每月清理未使用的图片
# 1. 导出所有商品引用的图片 URL
# 2. 对比 Storage 中的文件
# 3. 删除未被引用的文件
```

---

## 八、成本估算

### 场景 1: 小型店铺（当前）

```
商品数: 50 件
图片数: 200 张（每件 4 张）
单张大小: 500KB
总存储: 100MB

月流量: 2000 次访问 × 500KB = 1GB

✅ 免费额度内
```

### 场景 2: 中型店铺

```
商品数: 200 件
图片数: 800 张
总存储: 400MB

月流量: 5000 次访问 × 500KB = 2.5GB

⚠️ 流量超出免费额度
💰 需升级 Pro 方案 ($25/月)
```

### 场景 3: 大型店铺

```
商品数: 1000 件
图片数: 4000 张
总存储: 2GB

月流量: 20000 次访问 × 500KB = 10GB

 需升级 Team 方案 ($599/月)
或考虑自建 CDN
```

---

## 九、最佳实践

### ✅ 推荐做法

1. **图片压缩后再上传**
   - 最大宽度: 1600px
   - 质量: 80-90%
   - 格式: WebP (优先) / JPEG (兼容)

2. **使用 CDN 参数**
   - 列表页: `?width=200&format=webp`
   - 详情页: `?width=800&format=webp`
   - 原图下载: 无参数

3. **命名规范**
   ```
   {productId}/{timestamp}_{random}.{ext}
   示例: 30/1730217600000_a1b2c3.jpg
   ```

4. **缓存策略**
   - 商品图片: `cacheControl: '3600'` (1 小时)
   - Banner 图片: `cacheControl: '86400'` (24 小时)

### ❌ 避免做法

1. **不要上传原图（>5MB）**
   - 先压缩再上传
   - 限制单文件 5MB

2. **不要在前端暴露 Service Role Key**
   - 仅后端使用
   - 前端用 Anon Key

3. **不要存储过多版本**
   - 每个商品最多 9 张图片
   - 定期清理旧图

---

## 十、故障排查

### 问题 1: 上传失败 403

**原因**: RLS 策略未配置

**解决**:
```sql
-- 检查策略
SELECT * FROM storage.policies WHERE bucket_id = 'product-images';

-- 添加公开读取策略
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

### 问题 2: 图片访问慢

**原因**: 未使用 CDN

**解决**:
```javascript
// 使用 getPublicUrl 而不是直接拼接
const { data: { publicUrl } } = supabase.storage
  .from('product-images')
  .getPublicUrl(fileName);

// publicUrl 已包含 CDN 加速
```

### 问题 3: 存储超限

**原因**: 图片过多/过大

**解决**:
1. 清理未使用图片
2. 压缩现有图片
3. 升级付费方案

---

**文档版本**: v1.0  
**最后更新**: 2026-10-29  
**维护人**: L&Qmercatone 技术团队
