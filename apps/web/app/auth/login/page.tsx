'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [agreed, setAgreed] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function sendCode() {
    if (!phone.startsWith('+39') || phone.length < 13) {
      showToast('请输入有效的意大利手机号 / Inserisci un numero italiano valido (+39...)');
      return;
    }
    if (!agreed) {
      showToast('请先同意隐私政策 / Accetta la privacy policy');
      return;
    }

    setLoading(true);
    try {
      // TODO: 集成 Twilio 发送验证码
      // 开发阶段：固定验证码 123456
      showToast(`验证码已发送到 ${phone}（测试码: 123456）`);
      setStep('code');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      showToast('发送失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      showToast('请输入 6 位验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/phone-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (data.accessToken) {
        localStorage.setItem('buyer_token', data.accessToken);
        localStorage.setItem('buyer_user', JSON.stringify(data.user));
        showToast('登录成功！');
        router.push('/');
      } else {
        showToast(data.error || '登录失败');
      }
    } catch (err) {
      // 开发模式：直接登录
      const user = { id: 'dev-user', phone, name: phone, role: 'BUYER' };
      localStorage.setItem('buyer_token', 'dev-token');
      localStorage.setItem('buyer_user', JSON.stringify(user));
      showToast('登录成功（开发模式）');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-indigo-800 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🛍️</span>
        </div>
        <h1 className="text-2xl font-bold text-white">L&Q Mercatone</h1>
        <p className="text-white/70 mt-1">Accedi al tuo account</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        {step === 'phone' ? (
          <>
            <h2 className="text-lg font-bold mb-4">手机号登录</h2>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+39 手机号"
              className="w-full p-3 border rounded-xl mb-4 text-lg"
            />

            {/* GDPR */}
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 accent-purple-600"
              />
              <span className="text-xs text-gray-500">
                我同意 <a className="text-purple-600 underline">隐私政策</a> 和{' '}
                <a className="text-purple-600 underline">服务条款</a>
              </span>
            </label>

            <button
              onClick={sendCode}
              disabled={loading || !agreed}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:bg-gray-300"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2">输入验证码</h2>
            <p className="text-sm text-gray-500 mb-4">
              验证码已发送至 {phone}
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 位验证码"
              className="w-full p-3 border rounded-xl mb-2 text-lg text-center tracking-widest"
              maxLength={6}
            />

            {countdown > 0 ? (
              <p className="text-sm text-gray-400 mb-4">{countdown} 秒后可重新发送</p>
            ) : (
              <button
                onClick={sendCode}
                className="text-sm text-purple-600 mb-4"
              >
                重新发送验证码
              </button>
            )}

            <button
              onClick={verifyCode}
              disabled={loading}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:bg-gray-300 mb-3"
            >
              {loading ? '验证中...' : '登录'}
            </button>

            <button
              onClick={() => { setStep('phone'); setCode(''); }}
              className="w-full text-sm text-gray-500"
            >
              ← 返回修改手机号
            </button>
          </>
        )}
      </div>

      {/* Admin Login Link */}
      <div className="mt-6 text-center">
        <a href="/admin" className="text-white/50 text-sm">
          管理员登录 →
        </a>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
