'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const CATEGORIES = [
  { key: 'CASA', icon: '🏠', it: 'Casa & Giardino', zh: '家居园艺' },
  { key: 'ELETTRONICA', icon: '📱', it: 'Elettronica', zh: '电器数码' },
  { key: 'ABBIGLIAMENTO', icon: '👗', it: 'Abbigliamento', zh: '服装鞋包' },
  { key: 'COSMETICA', icon: '💄', it: 'Cosmetica & Bellezza', zh: '美妆护肤' },
  { key: 'DECORAZIONI', icon: '🎄', it: 'Decorazioni', zh: '装饰摆件' },
  { key: 'SPORT', icon: '🏃', it: 'Sport & Tempo Libero', zh: '运动休闲' },
  { key: 'GIOCHI', icon: '🎮', it: 'Giochi & Giocattoli', zh: '玩具礼品' },
  { key: 'CANCHELLERIA', icon: '📝', it: 'Cancelleria', zh: '文具办公' },
];

export default function CategoriesPage() {
  const [lang, setLang] = useState<'it' | 'zh'>('it');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'zh' || saved === 'it') setLang(saved as 'it' | 'zh');

    // 获取每个分类的商品数量
    CATEGORIES.forEach(async (cat) => {
      try {
        const res = await fetch(`${API_BASE}/products?category=${cat.key}&limit=1`);
        const data = await res.json();
        setCounts(prev => ({ ...prev, [cat.key]: data.pagination?.total || 0 }));
      } catch { /* ignore */ }
    });
  }, []);

  const t = (it: string, zh: string) => lang === 'it' ? it : zh;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <header className="header">
        <Link href="/" className="text-xl font-bold">← </Link>
        <h1 className="text-lg font-bold">{t('Categorie', '商品分类')}</h1>
        <button className="lang-btn" onClick={() => {
          const next = lang === 'it' ? 'zh' : 'it';
          setLang(next);
          localStorage.setItem('lang', next);
        }}>
          {lang === 'it' ? '中文' : 'IT'}
        </button>
      </header>

      {/* Categories Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={`/?category=${cat.key}`}
              className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-3xl">{cat.icon}</span>
              <div>
                <div className="font-semibold text-sm">
                  {lang === 'it' ? cat.it : cat.zh}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {counts[cat.key] !== undefined
                    ? `${counts[cat.key]} ${t('prodotti', '件商品')}`
                    : t('Caricamento...', '加载中...')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <Link href="/" className="nav-item">
          <span className="nav-icon">🏠</span>
          <span>{t('Home', '首页')}</span>
        </Link>
        <div className="nav-item active">
          <span className="nav-icon">📂</span>
          <span>{t('Categorie', '分类')}</span>
        </div>
        <Link href="/search" className="nav-item">
          <span className="nav-icon">🔍</span>
          <span>{t('Cerca', '搜索')}</span>
        </Link>
        <Link href="/cart" className="nav-item">
          <span className="nav-icon">🛒</span>
          <span>{t('Carrello', '购物车')}</span>
        </Link>
        <Link href="/profile" className="nav-item">
          <span className="nav-icon">👤</span>
          <span>{t('Profilo', '我的')}</span>
        </Link>
      </nav>
    </div>
  );
}
