'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface User {
  id: string;
  phone: string;
  name: string;
  role: string;
  preferredLang: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [lang, setLang] = useState<'it' | 'zh'>('it');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'zh' || saved === 'it') setLang(saved as 'it' | 'zh');

    // 检查登录状态
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser(token: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Token 无效，清除
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    } catch {
      // 网络错误，保留 token
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }

  const t = (it: string, zh: string) => lang === 'it' ? it : zh;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">{t('Il mio profilo', '个人中心')}</h1>
          <button className="lang-btn text-white text-xs" onClick={() => {
            const next = lang === 'it' ? 'zh' : 'it';
            setLang(next);
            localStorage.setItem('lang', next);
          }}>
            {lang === 'it' ? '中文' : 'IT'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">{t('Caricamento...', '加载中...')}</div>
        ) : user ? (
          /* 已登录 */
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <div className="font-bold">{user.name || user.phone}</div>
              <div className="text-sm text-white/70">{user.phone}</div>
            </div>
          </div>
        ) : (
          /* 未登录 */
          <div className="text-center py-4">
            <div className="text-4xl mb-2">👤</div>
            <Link
              href="/auth/login"
              className="bg-white text-purple-600 px-6 py-2 rounded-full font-bold inline-block"
            >
              {t('Accedi / Registrati', '登录 / 注册')}
            </Link>
          </div>
        )}
      </header>

      {/* Menu */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {/* 我的订单 */}
          <Link href={user ? '/orders' : '/auth/login'} className="flex items-center gap-3 p-4">
            <span className="text-xl">📦</span>
            <span className="flex-1">{t('I miei ordini', '我的订单')}</span>
            <span className="text-gray-400">→</span>
          </Link>

          {/* 收货地址 */}
          <Link href={user ? '/addresses' : '/auth/login'} className="flex items-center gap-3 p-4">
            <span className="text-xl">📍</span>
            <span className="flex-1">{t('Indirizzi', '收货地址')}</span>
            <span className="text-gray-400">→</span>
          </Link>

          {/* 优惠券 */}
          <Link href={user ? '/coupons' : '/auth/login'} className="flex items-center gap-3 p-4">
            <span className="text-xl">🎫</span>
            <span className="flex-1">{t('Coupon', '优惠券')}</span>
            <span className="text-gray-400">→</span>
          </Link>

          {/* 收藏 */}
          <Link href={user ? '/favorites' : '/auth/login'} className="flex items-center gap-3 p-4">
            <span className="text-xl">❤️</span>
            <span className="flex-1">{t('Preferiti', '我的收藏')}</span>
            <span className="text-gray-400">→</span>
          </Link>

          {/* 购物车 */}
          <Link href="/cart" className="flex items-center gap-3 p-4">
            <span className="text-xl">🛒</span>
            <span className="flex-1">{t('Carrello', '购物车')}</span>
            <span className="text-gray-400">→</span>
          </Link>
        </div>

        {/* 管理员入口 - 仅管理员可见 */}
        {user && (user.role === 'ADMIN' || user.role === 'WAREHOUSE') && (
          <div className="mt-4">
            <div className="bg-white rounded-xl shadow-sm">
              <Link href="/admin" className="flex items-center gap-3 p-4">
                <span className="text-xl">⚙️</span>
                <span className="flex-1">{t('Pannello Admin', '管理面板')}</span>
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                  {user.role === 'ADMIN' ? 'Admin' : 'Warehouse'}
                </span>
                <span className="text-gray-400">→</span>
              </Link>
            </div>
          </div>
        )}

        {/* 其他 */}
        <div className="mt-4 bg-white rounded-xl shadow-sm divide-y">
          <div className="flex items-center gap-3 p-4">
            <span className="text-xl">🌐</span>
            <span className="flex-1">{t('Lingua', '语言')}</span>
            <span className="text-gray-500 text-sm">{lang === 'it' ? 'Italiano' : '中文'}</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="text-xl">📞</span>
            <span className="flex-1">{t('Assistenza clienti', '联系客服')}</span>
            <span className="text-gray-400">→</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="text-xl">ℹ️</span>
            <span className="flex-1">{t('Informazioni', '关于我们')}</span>
            <span className="text-gray-400">→</span>
          </div>
        </div>

        {/* 登出按钮 */}
        {user && (
          <div className="mt-4">
            <button
              onClick={handleLogout}
              className="w-full bg-white text-red-500 py-3 rounded-xl shadow-sm font-bold"
            >
              {t('Esci', '退出登录')}
            </button>
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
        <Link href="/search" className="nav-item">
          <span className="nav-icon">🔍</span>
          <span>{t('Cerca', '搜索')}</span>
        </Link>
        <Link href="/cart" className="nav-item">
          <span className="nav-icon">🛒</span>
          <span>{t('Carrello', '购物车')}</span>
        </Link>
        <div className="nav-item active">
          <span className="nav-icon">👤</span>
          <span>{t('Profilo', '我的')}</span>
        </div>
      </nav>
    </div>
  );
}
