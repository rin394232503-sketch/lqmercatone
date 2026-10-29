'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (params.id) loadProduct(params.id as string);
  }, [params.id]);

  async function loadProduct(id: string) {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`);
      const data = await res.json();
      setProduct(data);
      if (data.colors?.length > 0) setSelectedColor(data.colors[0]);
      if (data.sizes?.length > 0) setSelectedSize(data.sizes[0]);
    } catch (err) {
      console.error('Failed to load product:', err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  function addToCart() {
    if (!product) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((item: any) =>
      item.productId === product.id && item.color === selectedColor && item.size === selectedSize
    );
    if (existing) {
      existing.qty += quantity;
    } else {
      cart.push({
        productId: product.id,
        name: product.nameIt,
        price: product.priceCent / 100,
        qty: quantity,
        color: selectedColor,
        size: selectedSize,
        image: product.images?.[selectedImage] || '',
      });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    showToast(`✅ ${product.nameIt} 已加入购物车`);
  }

  function buyNow() {
    addToCart();
    router.push('/cart');
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">商品未找到</p>
          <Link href="/" className="text-blue-500">返回首页</Link>
        </div>
      </div>
    );
  }

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen pb-24">
      {/* Top Nav */}
      <div className="header">
        <Link href="/" className="text-xl">←</Link>
        <div className="flex-1 text-center font-semibold">{product.nameIt}</div>
        <button className="icon-btn">🔗</button>
      </div>

      {/* Image Gallery */}
      <div className="relative">
        <div className="w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
          {product.images?.length > 0 ? (
            <img
              src={product.images[selectedImage]}
              alt={product.nameIt}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl">📦</span>
          )}
        </div>
        {product.images?.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {product.images.map((_: string, i: number) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === selectedImage ? 'bg-white w-6' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">{product.nameIt}</h1>
        {product.nameZh && <p className="text-sm text-gray-500 mb-2">{product.nameZh}</p>}

        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-bold text-red-500">{formatPrice(product.priceCent)}</span>
          {product.oldPriceCent && (
            <span className="text-sm text-gray-400 line-through">{formatPrice(product.oldPriceCent)}</span>
          )}
        </div>

        {product.avgRating > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-500">⭐⭐⭐⭐⭐</span>
            <span className="text-sm text-gray-500">{product.avgRating} ({product.reviewCount} 条评价)</span>
          </div>
        )}

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex gap-2 mb-4">
            {product.tags.map((tag: string) => (
              <span key={tag} className="px-2 py-1 bg-purple-100 text-purple-600 rounded text-xs font-semibold">
                {tag === 'hot' ? '🔥 热卖' : tag === 'new' ? '✨ 新品' : '💰 特价'}
              </span>
            ))}
          </div>
        )}

        {/* Color Selection */}
        {product.colors?.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Colore 颜色</h3>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color: string) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedColor === color
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Size Selection */}
        {product.sizes?.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Taglia 尺码</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size: string) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all min-w-[48px] ${
                    selectedSize === size
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Quantità 数量</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
            >
              -
            </button>
            <span className="font-semibold w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
            >
              +
            </button>
            <span className="text-sm text-gray-500 ml-2">
              库存: {product.stock}
            </span>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Descrizione 描述</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</p>
          </div>
        )}

        {/* Shipping Info */}
        <div className="border-t pt-4 mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>🚚</span>
            <span>运费计算失败，使用默认运费</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>🔄</span>
            <span>7 天无理由退货 / Reso gratuito 7 giorni</span>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex gap-3 max-w-lg mx-auto">
        <button
          onClick={addToCart}
          className="flex-1 py-3 bg-purple-100 text-purple-600 rounded-xl font-semibold"
        >
          🛒 {product.stock > 0 ? 'Aggiungi' : '非卖品'}
        </button>
        <button
          onClick={buyNow}
          disabled={product.stock <= 0}
          className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:bg-gray-300"
        >
          ⚡ Acquista Ora
        </button>
      </div>

      {/* Toast */}
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
