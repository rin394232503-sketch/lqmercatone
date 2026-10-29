// L&Q Mercatone API Client
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'API 请求失败');
  }
  return res.json();
}

// ===== Products =====
export const productsAPI = {
  list: (params?: { page?: number; limit?: number; category?: string; search?: string; onSale?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.onSale !== undefined) query.set('onSale', params.onSale.toString());
    return fetchAPI(`/products?${query}`);
  },
  getById: (id: string) => fetchAPI(`/products/${id}`),
  getCategories: () => fetchAPI('/products/categories'),
};

// ===== Auth =====
export const authAPI = {
  phoneLogin: (phone: string) => fetchAPI('/auth/phone-login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),
  login: (username: string, password: string) => fetchAPI('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  me: (token: string) => fetchAPI('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }),
};

// ===== Cart =====
export const cartAPI = {
  get: (token: string) => fetchAPI('/cart', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  addItem: (token: string, data: { productId: string; quantity: number; color?: string; size?: string }) =>
    fetchAPI('/cart/items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  updateQuantity: (token: string, itemId: string, quantity: number) =>
    fetchAPI(`/cart/items/${itemId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quantity }),
    }),
  removeItem: (token: string, itemId: string) =>
    fetchAPI(`/cart/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
  clear: (token: string) =>
    fetchAPI('/cart', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ===== Orders =====
export const ordersAPI = {
  create: (token: string, data: { addressId: string; paymentMethod: string; buyerNote?: string }) =>
    fetchAPI('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  list: (token: string, params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    return fetchAPI(`/orders?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  getById: (token: string, id: string) =>
    fetchAPI(`/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  cancel: (token: string, id: string, reason?: string) =>
    fetchAPI(`/orders/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    }),
};

// ===== Addresses =====
export const addressesAPI = {
  list: (token: string) =>
    fetchAPI('/addresses', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  getDefault: (token: string) =>
    fetchAPI('/addresses/default', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  create: (token: string, data: { name: string; phone: string; detail: string; city?: string; postcode?: string; region?: string; isDefault?: boolean }) =>
    fetchAPI('/addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  update: (token: string, id: string, data: any) =>
    fetchAPI(`/addresses/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  delete: (token: string, id: string) =>
    fetchAPI(`/addresses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ===== Payment =====
export const paymentAPI = {
  getConfig: () => fetchAPI('/payment/config'),
  createIntent: (orderId: string) =>
    fetchAPI('/payment/create-intent', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),
};
