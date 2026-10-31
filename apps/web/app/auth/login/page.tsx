'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'it' | 'zh'>('it');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'zh' || saved === 'it') setLang(saved as 'it' | 'zh');
  }, []);

  const t = (it: string, zh: string) => lang === 'it' ? it : zh;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function sendCode() {
    if (!phone.startsWith('+39') || phone.length < 13) {
      showToast(t(
        'Inserisci un numero italiano valido (+39...)',
        '请输入有效的意大利手机号 (+39...)'
      ));
      return;
    }
    if (!agreed) {
      showToast(t(
        'Accetta la privacy policy',
        '请先同意隐私政策'
      ));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sms/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (res.ok) {
        showToast(t(
          `Codice inviato a ${phone}`,
          `验证码已发送到 ${phone}`
        ));
        setStep('code');
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        const data = await res.json();
        showToast(data.message || t('Invio fallito', '发送失败'));
      }
    } catch {
      showToast(t('Errore di rete, riprova', '网络错误，请重试'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      showToast(t('Inserisci il codice a 6 cifre', '请输入 6 位验证码'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/phone-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        showToast(t('Accesso effettuato!', '登录成功！'));
        router.push('/');
      } else {
        showToast(data.message || t('Accesso fallito', '登录失败'));
      }
    } catch {
      showToast(t('Errore di rete, riprova', '网络错误，请重试'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-indigo-800 flex flex-col items-center justify-center px-6">
      {/* Language switch */}
      <button
        className="absolute top-4 right-4 bg-white/20 text-white px-3 py-1 rounded-full text-sm"
        onClick={() => {
          const next = lang === 'it' ? 'zh' : 'it';
          setLang(next);
          localStorage.setItem('lang', next);
        }}
      >
        {lang === 'it' ? '中文' : 'IT'}
      </button>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🛍️</span>
        </div>
        <h1 className="text-2xl font-bold text-white">L&Q Mercatone</h1>
        <p className="text-white/70 mt-1">
          {t('Accedi al tuo account', '登录您的账户')}
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        {step === 'phone' ? (
          <>
            <h2 className="text-lg font-bold mb-4">
              {t('Accesso con telefono', '手机号登录')}
            </h2>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('+39 Numero di telefono', '+39 手机号')}
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
                {t('Accetto la', '我同意')}{' '}
                <a className="text-purple-600 underline">{t('Privacy Policy', '隐私政策')}</a>
                {' '}{t('e i', '和')}{' '}
                <a className="text-purple-600 underline">{t('Termini di servizio', '服务条款')}</a>
              </span>
            </label>

            <button
              onClick={sendCode}
              disabled={loading || !agreed}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:bg-gray-300"
            >
              {loading
                ? t('Invio in corso...', '发送中...')
                : t('Invia codice di verifica', '发送验证码')}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2">
              {t('Inserisci il codice', '输入验证码')}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('Codice inviato a', '验证码已发送至')} {phone}
            </p>

            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('Codice a 6 cifre', '6 位验证码')}
              className="w-full p-3 border rounded-xl mb-2 text-lg text-center tracking-widest"
              maxLength={6}
            />

            {countdown > 0 ? (
              <p className="text-sm text-gray-400 mb-4">
                {t('Puoi richiederlo di nuovo tra', '可重新发送，剩余')} {countdown}s
              </p>
            ) : (
              <button onClick={sendCode} className="text-sm text-purple-600 mb-4">
                {t('Invia di nuovo il codice', '重新发送验证码')}
              </button>
            )}

            <button
              onClick={verifyCode}
              disabled={loading}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:bg-gray-300 mb-3"
            >
              {loading ? t('Verifica...', '验证中...') : t('Accedi', '登录')}
            </button>

            <button
              onClick={() => { setStep('phone'); setCode(''); }}
              className="w-full text-sm text-gray-500"
            >
              ← {t('Modifica numero di telefono', '返回修改手机号')}
            </button>
          </>
        )}
      </div>

      {/* Admin Login Link - subtle */}
      <div className="mt-6 text-center">
        <Link href="/auth/admin-login" className="text-white/30 text-xs">
          {t('Accesso amministratore', '管理员登录')}
        </Link>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
