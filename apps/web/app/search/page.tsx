'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface Product {
  id: string;
  nameIt: string;
  nameZh: string;
  brand: string;
  priceCent: number;
  oldPriceCent: number | null;
  images: string[];
  tags: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<'it' | 'zh'>('it');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'zh' || saved === 'it') setLang(saved as 'it' | 'zh');

    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      doSearch(q);
    }
  }, [searchParams]);

  const t = (it: string, zh: string) => lang === 'it' ? it : zh;

  async function doSearch(term: string) {
    if (term.length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${API_BASE}/products?search=${encodeURIComponent(term)}&limit=50`);
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      doSearch(query);
    }
  }

  function formatPrice(cents: number) {
    return `€${(cents / 100).toFixed(2)}`;
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header with search */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 p-3">
          <Link href="/" className="text-xl">←</Link>
          <form onSubmit={handleSubmit} className="flex-1 flex">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Cerca prodotti...', '搜索商品...')}
              className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-purple-400"
              autoFocus
            />
          </form>
          <button className="lang-btn text-xs" onClick={() => {
            const next = lang === 'it' ? 'zh' : 'it';
            setLang(next);
            localStorage.setItem('lang', next);
          }}>
            {lang === 'it' ? '中文' : 'IT'}
          </button>
        </div>
      </header>

      {/* Results */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            {t('Ricerca in corso...', '搜索中...')}
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-gray-500">
              {t('Nessun risultato per', '未找到与')} &quot;{query}&quot; {t('dei risultati', '相关的商品')}
            </div>
            <div className="text-gray-400 text-sm mt-2">
              {t('Prova con parole diverse', '请尝试其他关键词')}
            </div>
          </div>
        ) : searched ? (
          <>
            <div className="text-sm text-gray-500 mb-3">
              {t('Trovati', '找到')} {results.length} {t('risultati', '个结果')}
            </div>
            <div className="product-grid">
              {results.map((product) => (
                <Link key={product.id} href={`/shop/products/${product.id}`}>
                  <div className="product-card">
                    <div className="product-img">
                      {product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.nameIt} loading="lazy" />
                      ) : (
                        <span>📦</span>
                      )}
                    </div>
                    <div className="product-info">
                      <div className="product-name">
                        {lang === 'it' ? product.nameIt : (product.nameZh || product.nameIt)}
                      </div>
                      <div className="product-price-row">
                        <span className="product-price">{formatPrice(product.priceCent)}</span>
                        {product.oldPriceCent && (
                          <span className="product-old-price">{formatPrice(product.oldPriceCent)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-gray-500">
              {t('Inserisci almeno 2 caratteri per cercare', '请输入至少 2 个字符搜索')}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <Link href="/" className="nav-item">
          <span className="nav-icon">🏠</span>
          <span>{t('Home', '首页')}</span>
        </Link>
        <Link href="/categories" className="nav-item">
          <span className="nav-icon">📂</span>
          <span>{t('Categorie', '分类')}</span>
        </Link>
        <div className="nav-item active">
          <span className="nav-icon">🔍</span>
          <span>{t('Cerca', '搜索')}</span>
        </div>
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
