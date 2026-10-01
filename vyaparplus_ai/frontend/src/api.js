// Update BASE_URL for your setup:
//   Android emulator -> host machine: http://10.0.2.2:8000
//   Physical device  -> your machine's LAN IP, e.g. http://192.168.1.5:8000
//   iOS simulator    -> http://localhost:8000
const BASE_URL = 'http://10.0.2.2:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  createTransaction: (data) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  listTransactions: () => request('/transactions'),
  listPendingTransactions: () => request('/transactions/pending'),

  createPaymentMessage: (data) =>
    request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  listPaymentMessages: () => request('/payments'),
  runMatching: () => request('/payments/match', { method: 'POST' }),
  loadMockPayments: () => request('/payments/mock/load', { method: 'POST' }),

  todaySummary: () => request('/summary/today'),
};
