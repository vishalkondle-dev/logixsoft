const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://payment-api.logixsoft.in';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Network request failed' }));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const pgApi = {
  // Public / Checkout endpoints
  createOrder: (data: {
    amountInRupees?: number;
    amountInPaise?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    description?: string;
  }) => apiFetch<any>('/api/v1/orders/create', { method: 'POST', body: JSON.stringify(data) }),

  getOrderStatus: (orderId: string) =>
    apiFetch<any>(`/api/v1/orders/${orderId}/status`, { method: 'GET' }),

  simulateMockPayment: (orderId: string, action: 'SUCCESS' | 'FAILED') =>
    apiFetch<any>(`/api/v1/orders/${orderId}/mock-pay`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  confirmPayment: (orderId: string, utr?: string) =>
    apiFetch<any>(`/api/v1/orders/${orderId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ utr }),
    }),

  // Mandate / UPI AutoPay endpoints
  getMandateStatus: (mandateId: string) =>
    apiFetch<any>(`/api/v1/mandates/${mandateId}`, { method: 'GET' }),

  simulateMandateAuthorize: (mandateId: string, customerVpa?: string) =>
    apiFetch<any>(`/api/v1/mandates/${mandateId}/simulate-authorize`, {
      method: 'POST',
      body: JSON.stringify({ customerVpa }),
    }),

  // Merchant Portal endpoints
  getStats: () => apiFetch<any>('/api/v1/merchant/stats'),

  getTransactions: (status?: string) =>
    apiFetch<{ transactions: any[] }>(
      `/api/v1/merchant/transactions${status && status !== 'ALL' ? `?status=${status}` : ''}`
    ),

  getCredentials: () => apiFetch<any>('/api/v1/merchant/credentials'),

  updateCredentials: (data: any) =>
    apiFetch<any>('/api/v1/merchant/credentials', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getApiKeys: () => apiFetch<{ keys: any[] }>('/api/v1/merchant/api-keys'),

  createApiKey: (name: string) =>
    apiFetch<any>('/api/v1/merchant/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteApiKey: (id: string) =>
    apiFetch<any>(`/api/v1/merchant/api-keys/${id}`, {
      method: 'DELETE',
    }),

  getWebhook: () => apiFetch<{ success: boolean; webhook: any }>('/api/v1/merchant/webhook'),

  saveWebhook: (data: { url: string; regenerateSecret?: boolean; isActive?: boolean }) =>
    apiFetch<any>('/api/v1/merchant/webhook', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  testWebhook: (data?: { url?: string; secret?: string }) =>
    apiFetch<any>('/api/v1/merchant/webhook/test', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
};

