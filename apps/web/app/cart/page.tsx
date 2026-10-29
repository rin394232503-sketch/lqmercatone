'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  color?: string;
  size?: string;
  image?: string;
  emoji?: string;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadCart();
  }, []);

  function loadCart() {
    const items = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(items);
    // Select all by default
    setSelectedItems(new Set(items.map((i: CartItem) => i.productId + (i.color || '') + (i.size || ''))));
  }

  function toggleSelect(key: string) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) newSelected.delete(key);
    else newSelected.add(key);
    setSelectedItems(newSelected);
  }

  function toggleSelectAll() {
    if (selectedItems.size === cart.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cart.map(i => i.productId + (i.color || '') + (i.size || ''))));
    }
  }

  function updateQty(index: number, delta: number) {
    const newCart = [...cart];
    newCart[index].qty = Math.max(1, newCart[index].qty + delta);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  }

  function removeItem(index: number) {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    showToast('已删除');
  }

  function getSelectedItems() {
    return cart.filter(item =>
      selectedItems.has(item.productId + (item.color || '') + (item.size || ''))
    );
  }

  function getSubtotal() {
    return getSelectedItems().reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function getShipping() {
    const subtotal = getSubtotal();
    return subtotal >= 99 ? 0 : 4.99;
  }

  function getTotal() {
    return getSubtotal() + getShipping();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <header className="header">
        <Link href="/" className="text-xl">←</Link>
        <div className="flex-1 text-center font-semibold">
          Carrello 购物车 ({cart.length})
        </div>
        <button
          className="text-sm text-purple-600"
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? '完成' : '编辑'}
        </button>
      </header>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="text-6xl mb-4">🛒</span>
          <p>Il carrello è vuoto</p>
          <p className="text-sm">购物车是空的</p>
          <Link href="/" className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-full">
            去购物
          </Link>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="p-4 space-y-3">
            {cart.map((item, index) => {
              const key = item.productId + (item.color || '') + (item.size || '');
              const isSelected = selectedItems.has(key);
              return (
                <div key={index} className="bg-white rounded-xl p-3 flex gap-3">
                  {editMode && (
                    <button
                      onClick={() => toggleSelect(key)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </button>
                  )}
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{item.emoji || '📦'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.color && <span>颜色: {item.color}</span>}
                      {item.size && <span className="ml-2">尺码: {item.size}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-red-500 font-bold">€{item.price.toFixed(2)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(index, -1)}
                          className="w-6 h-6 rounded border flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-4 text-center">{item.qty}</span>
                        <button
                          onClick={() => updateQty(index, 1)}
                          className="w-6 h-6 rounded border flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  {editMode && (
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 self-start"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Free shipping bar */}
          <div className="mx-4 p-3 bg-purple-50 rounded-xl">
            <div className="flex items-center gap-2">
              <span>🚚</span>
              <div className="flex-1">
                <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (getSubtotal() / 99) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <p className="text-xs text-purple-600 mt-2 text-center">
              {getSubtotal() >= 99
                ? '🎉 已满足免运费条件！'
                : `再买 €${(99 - getSubtotal()).toFixed(2)} 免运费`}
            </p>
          </div>
        </>
      )}

      {/* Bottom Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedItems.size === cart.length ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                }`}
              >
                {selectedItems.size === cart.length && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-sm">全选</span>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">合计: </span>
              <span className="text-xl font-bold text-red-500">€{getTotal().toFixed(2)}</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="block w-full py-3 bg-purple-600 text-white text-center rounded-xl font-semibold"
          >
            结算 ({getSelectedItems().length}件) €{getTotal().toFixed(2)}
          </Link>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
