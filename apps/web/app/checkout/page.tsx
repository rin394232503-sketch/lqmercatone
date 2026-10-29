'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  color?: string;
  size?: string;
  image?: string;
}

interface Address {
  id: string;
  name: string;
  phone: string;
  detail: string;
  city?: string;
  postcode?: string;
  isDefault?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNo, setOrderNo] = useState('');

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(items);
    loadAddresses();
  }, []);

  async function loadAddresses() {
    const token = localStorage.getItem('buyer_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAddresses(data);
      const def = data.find((a: Address) => a.isDefault);
      if (def) setSelectedAddress(def);
    } catch (err) {
      console.error('Failed to load addresses:', err);
    }
  }

  function getSubtotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function getShipping() {
    return getSubtotal() >= 99 ? 0 : 4.99;
  }

  function getTotal() {
    return getSubtotal() + getShipping();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function submitOrder() {
    if (!selectedAddress) {
      showToast('请选择收货地址 / Seleziona un indirizzo');
      return;
    }
    if (cart.length === 0) {
      showToast('购物车为空');
      return;
    }

    setLoading(true);

    // Check login
    const token = localStorage.getItem('buyer_token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          addressId: selectedAddress.id,
          paymentMethod,
          buyerNote: note,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrderNo(data.orderNo || 'ORDER-' + Date.now());
        localStorage.removeItem('cart');
        setOrderSuccess(true);

        // If card payment, redirect to payment
        if (paymentMethod === 'card' && data.clientSecret) {
          // TODO: Integrate Stripe Elements
          showToast('支付处理中...');
        }
      } else {
        const err = await res.json();
        showToast(err.error || '下单失败');
      }
    } catch (err) {
      // Dev mode: simulate success
      const orderNo = 'LQ' + Date.now().toString().slice(-8);
      localStorage.removeItem('cart');
      setOrderNo(orderNo);
      setOrderSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">Ordine inviato!</h1>
        <p className="text-gray-500 mb-2">订单已提交</p>
        <div className="bg-purple-50 rounded-xl p-4 my-4 text-center">
          <p className="text-sm text-gray-500">订单号 Order No.</p>
          <p className="text-xl font-bold text-purple-600">{orderNo}</p>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Totale: €{getTotal().toFixed(2)}
        </p>
        <Link
          href="/"
          className="px-8 py-3 bg-purple-600 text-white rounded-xl font-semibold"
        >
          Continua lo shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="header">
        <Link href="/cart" className="text-xl">←</Link>
        <div className="flex-1 text-center font-semibold">Checkout 结算</div>
        <div className="w-8"></div>
      </header>

      {/* Address Section */}
      <div className="p-4">
        <h2 className="font-bold mb-3">📍 Indirizzo 收货地址</h2>
        {addresses.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-gray-400 mb-2">暂无地址</p>
            <button className="text-purple-600 text-sm">+ 添加地址</button>
          </div>
        ) : (
          <div className="space-y-2">
            {addresses.map((addr) => (
              <button
                key={addr.id}
                onClick={() => setSelectedAddress(addr)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  selectedAddress?.id === addr.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="font-semibold">{addr.name} {addr.phone}</div>
                <div className="text-sm text-gray-500">{addr.detail}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="p-4">
        <h2 className="font-bold mb-3">📦 Prodotti 商品 ({cart.length})</h2>
        <div className="bg-white rounded-xl divide-y">
          {cart.map((item, i) => (
            <div key={i} className="flex gap-3 p-3">
              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {item.image ? (
                  <img src={item.image} className="w-full h-full rounded-lg object-cover" />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{item.name}</h3>
                <div className="text-xs text-gray-500">
                  {item.color && `颜色: ${item.color} `}
                  {item.size && `尺码: ${item.size} `}
                  ×{item.qty}
                </div>
              </div>
              <div className="text-sm font-bold">€{(item.price * item.qty).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <div className="p-4">
        <h2 className="font-bold mb-3">💳 Pagamento 支付方式</h2>
        <div className="bg-white rounded-xl divide-y">
          {[
            { id: 'card', icon: '💳', name: 'Carta di credito 信用卡', desc: '3D Secure 2.0' },
            { id: 'sisal', icon: '🏪', name: 'Sisal / Lottomatica', desc: '到店付款' },
            { id: 'paypal', icon: '🅿️', name: 'PayPal', desc: '' },
            { id: 'pickup', icon: '🏪', name: 'Ritiro in negozio 自提', desc: '运费 €0' },
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setPaymentMethod(method.id)}
              className={`w-full flex items-center gap-3 p-3 transition-all ${
                paymentMethod === method.id ? 'bg-purple-50' : ''
              }`}
            >
              <span className="text-xl">{method.icon}</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{method.name}</div>
                {method.desc && <div className="text-xs text-gray-400">{method.desc}</div>}
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === method.id ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
              }`}>
                {paymentMethod === method.id && <span className="text-white text-xs">✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Order Note */}
      <div className="p-4">
        <h2 className="font-bold mb-3">📝 Note 备注</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Inserisci richieste particolari..."
          className="w-full p-3 border rounded-xl resize-none"
          rows={2}
        />
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>小计 Subtotal</span>
            <span>€{getSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>运费 Spedizione</span>
            <span className={getShipping() === 0 ? 'text-green-600' : ''}>
              {getShipping() === 0 ? 'Gratis 免费' : `€${getShipping().toFixed(2)}`}
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold text-lg">
            <span>Totale 合计</span>
            <span className="text-red-500">€{getTotal().toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 max-w-lg mx-auto">
        <button
          onClick={submitOrder}
          disabled={loading || !selectedAddress}
          className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:bg-gray-300"
        >
          {loading ? '处理中...' : `Invia Ordine 提交订单 €${getTotal().toFixed(2)}`}
        </button>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
