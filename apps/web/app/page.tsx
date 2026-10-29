'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  nameIt: string;
  nameZh: string;
  brand: string;
  category: string;
  priceCent: number;
  oldPriceCent: number | null;
  images: string[];
  tags: string[];
  onSale: boolean;
  avgRating: number;
  reviewCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function Home() {
  const [lang, setLang] = useState<'it' | 'zh'>('it');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');

  const t = (it: string, zh: string) => lang === 'it' ? it : zh;

  // Load products
  useEffect(() => {
    loadProducts();
    // Load cart count from localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartCount(cart.reduce((sum: number, item: any) => sum + (item.qty || 1), 0));
  }, []);

  async function loadProducts(page = 1, search = '') {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        onSale: 'true',
      });
      if (search) query.set('search', search);

      const res = await fetch(`${API_BASE}/products?${query}`);
      const data = await res.json();

      setProducts(data.data || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(value: string) {
    setSearchTerm(value);
    if (value.length >= 2) {
      loadProducts(1, value);
    } else if (value.length === 0) {
      loadProducts();
    }
  }

  function toggleLang() {
    setLang(lang === 'it' ? 'zh' : 'it');
  }

  function addToCart(product: Product) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find((item: any) => item.productId === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.nameIt,
        price: product.priceCent / 100,
        qty: 1,
        image: product.images[0] || '',
        emoji: '',
      });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    setCartCount(cart.reduce((sum: number, item: any) => sum + item.qty, 0));
    showToast(`✅ ${product.nameIt} ${t('aggiunto al carrello', '已加入购物车')}`);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  function formatPrice(cents: number) {
    return `€${(cents / 100).toFixed(2)}`;
  }

  function getTagLabel(tag: string) {
    const labels: Record<string, [string, string]> = {
      hot: [' Hot', '🔥 热卖'],
      new: ['✨ Nuovo', '✨ 新品'],
      sale: ['💰 Offerta', '💰 特价'],
    };
    const l = labels[tag] || [tag, tag];
    return lang === 'it' ? l[0] : l[1];
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <img src="/logo-icon.svg" alt="L&Q" />
        </div>
        <div className="search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder={t('Cerca prodotti...', '搜索商品...')}
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <button className="lang-btn" onClick={toggleLang}>
          {lang === 'it' ? '中文' : 'IT'}
        </button>
      </header>

      {/* Banner */}
      <div className="banner">
        <div className="text-center">
          <div className="banner-emoji">🎄</div>
          <h3>{t('Offerte di Natale', '圣诞特惠')}</h3>
          <p>{t('Sconti fino al 50%', '最高五折优惠')}</p>
        </div>
        <div className="banner-dots">
          <div className="banner-dot active"></div>
          <div className="banner-dot"></div>
          <div className="banner-dot"></div>
        </div>
      </div>

      {/* Category Nav */}
      <div className="icon-nav">
        {[
          { icon: '👗', label: t('Abbigliamento', '服装') },
          { icon: '🧴', label: t('Detersivi', '清洁剂') },
          { icon: '🏠', label: t('Casa', '家居') },
          { icon: '📱', label: t('Elettronica', '电器') },
          { icon: '💄', label: t('Bellezza', '美妆') },
          { icon: '🌸', label: t('Fiori', '花艺') },
          { icon: '🎄', label: t('Natale', '圣诞') },
          { icon: '🧹', label: t('Pulizia', '清洁') },
          { icon: '🎮', label: t('Tempo Libero', '休闲') },
          { icon: '🔧', label: t('Fai da te', '工具') },
        ].map((cat, i) => (
          <div key={i} className="icon-nav-item">
            <div className="icon-nav-icon" style={{
              background: ['#fff0f0','#fff8e1','#e8f5e9','#e3f2fd','#f3e5f5','#fff0f5','#f0fff0','#f0f8ff','#fff8f0','#f5f0ff'][i]
            }}>
              {cat.icon}
            </div>
            <div className="icon-nav-label">{cat.label}</div>
          </div>
        ))}
      </div>

      {/* Flash Sale */}
      <div className="section-title">
        <h2>🔥 {t('Offerte Lampo', '限时特价')}</h2>
        <span className="more">{t('Vedi tutto', '查看全部')} →</span>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          {t('Caricamento...', '加载中...')}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t('Nessun prodotto trovato', '暂无商品')}
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <Link key={product.id} href={`/shop/products/${product.id}`}>
              <div className="product-card animate-fade-in">
                <div className="product-img">
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.nameIt}
                      loading="lazy"
                    />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className="product-info">
                  <div className="product-name">
                    {lang === 'it' ? product.nameIt : (product.nameZh || product.nameIt)}
                  </div>
                  <div className="product-price-row">
                    <span className="product-price">
                      {formatPrice(product.priceCent)}
                    </span>
                    {product.oldPriceCent && (
                      <span className="product-old-price">
                        {formatPrice(product.oldPriceCent)}
                      </span>
                    )}
                  </div>
                  {product.tags.length > 0 && (
                    <span className={`product-tag tag-${product.tags[0]}`}>
                      {getTagLabel(product.tags[0])}
                    </span>
                  )}
                  {product.avgRating > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      ⭐ {product.avgRating} ({product.reviewCount})
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <div className="nav-item active">
          <span className="nav-icon">🏠</span>
          <span>{t('Home', '首页')}</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">📂</span>
          <span>{t('Categorie', '分类')}</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">🔍</span>
          <span>{t('Cerca', '搜索')}</span>
        </div>
        <Link href="/cart" className="nav-item">
          <span className="nav-icon">🛒</span>
          <span>{t('Carrello', '购物车')}</span>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </Link>
        <div className="nav-item">
          <span className="nav-icon">👤</span>
          <span>{t('Profilo', '我的')}</span>
        </div>
      </nav>

      {/* Toast */}
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
