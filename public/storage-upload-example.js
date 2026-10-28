/**
 * L&Qmercatone Supabase Storage 上传示例
 * 
 * 使用场景:
 * - 买家端: 评价晒图
 * - 后台端: 商品图片上传
 * 
 * 注意: 此文件仅作为示例，实际使用需集成到现有代码
 */

// 初始化 Supabase Client
const SUPABASE_URL = 'https://yiyydikfpgbmtdypiggc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yk7pSAVz4iQ_oFaF0ybUEQ_xd92I2LM';

// 创建客户端（需要引入 @supabase/supabase-js）
// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 上传图片到 Supabase Storage
 * @param {File} file - 图片文件
 * @param {number} productId - 商品 ID
 * @param {string} bucket - Bucket 名称 (默认: product-images)
 * @returns {Promise<string|null>} 公开 URL 或 null
 */
async function uploadImageToStorage(file, productId, bucket = 'product-images') {
  try {
    // 1. 生成文件名
    const fileExt = file.name.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${productId}/${timestamp}_${randomStr}.${fileExt}`;
    
    // 2. 上传文件
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });
    
    if (error) {
      console.error(' 上传失败:', error.message);
      showToast('⚠️ 图片上传失败 / Caricamento immagine fallito');
      return null;
    }
    
    // 3. 获取公开 URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    console.log('✅ 上传成功:', publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error('💥 上传异常:', error);
    return null;
  }
}

/**
 * 删除 Storage 中的图片
 * @param {string} imageUrl - 图片 URL
 * @param {string} bucket - Bucket 名称
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteImageFromStorage(imageUrl, bucket = 'product-images') {
  try {
    // 从 URL 提取文件路径
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts.slice(pathParts.length - 2).join('/');
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);
    
    if (error) {
      console.error('❌ 删除失败:', error.message);
      return false;
    }
    
    console.log('✅ 删除成功:', fileName);
    return true;
    
  } catch (error) {
    console.error('💥 删除异常:', error);
    return false;
  }
}

/**
 * 批量上传图片
 * @param {FileList} files - 文件列表
 * @param {number} productId - 商品 ID
 * @returns {Promise<string[]>} URL 数组
 */
async function uploadMultipleImages(files, productId) {
  const urls = [];
  
  for (const file of Array.from(files)) {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      console.warn('️ 跳过非图片文件:', file.name);
      continue;
    }
    
    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.warn('️ 文件过大:', file.name);
      showToast('⚠️ 图片不能超过 5MB / Immagine max 5MB');
      continue;
    }
    
    const url = await uploadImageToStorage(file, productId);
    if (url) {
      urls.push(url);
    }
  }
  
  return urls;
}

/**
 * 生成 CDN 优化 URL
 * @param {string} imageUrl - 原始 URL
 * @param {Object} options - 选项
 * @param {number} options.width - 宽度
 * @param {string} options.format - 格式 (webp/jpeg)
 * @returns {string} 优化后的 URL
 */
function getOptimizedImageUrl(imageUrl, options = {}) {
  const { width = 800, format = 'webp' } = options;
  return `${imageUrl}?width=${width}&format=${format}`;
}

// ===== 使用示例 =====

// 示例 1: 单张图片上传
/*
document.getElementById('imageInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = await uploadImageToStorage(file, 30);
    if (url) {
      document.getElementById('preview').src = url;
      // 保存到数据库
      await supabase.from('products').update({ image_url: url }).eq('id', 30);
    }
  }
});
*/

// 示例 2: 多张图片上传
/*
document.getElementById('imagesInput').addEventListener('change', async (e) => {
  const files = e.target.files;
  const urls = await uploadMultipleImages(files, 30);
  
  if (urls.length > 0) {
    // 保存到数据库
    await supabase.from('products').update({ images: urls }).eq('id', 30);
    
    // 显示预览
    const container = document.getElementById('previewContainer');
    container.innerHTML = urls.map(url => 
      `<img src="${getOptimizedImageUrl(url, { width: 200 })}" />`
    ).join('');
  }
});
*/

// 示例 3: 删除图片
/*
async function removeImage(imageUrl, productId) {
  const success = await deleteImageFromStorage(imageUrl);
  
  if (success) {
    // 从数据库移除
    const product = await supabase.from('products').select('images').eq('id', productId).single();
    const newImages = product.images.filter(url => url !== imageUrl);
    await supabase.from('products').update({ images: newImages }).eq('id', productId);
  }
}
*/

// 导出函数（如果在模块中使用）
if (typeof module !== 'undefined') {
  module.exports = {
    uploadImageToStorage,
    deleteImageFromStorage,
    uploadMultipleImages,
    getOptimizedImageUrl
  };
}
