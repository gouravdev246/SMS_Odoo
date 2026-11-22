/**
 * Centralized API Client for Adelux Sports Club Management System
 * Connects frontend to all backend service endpoints:
 * - Auth & Identity
 * - Front Desk Operations (Walk-ins, Call Logs, Schedules, Daily Activities)
 * - Court & Slot Bookings (Hold, Confirm, Cancel)
 * - Member 360 Recognition & Check-in
 * - CRM Inquiries & Leads Pipeline
 * - Staff Leave Management & HR Approvals
 * - Virtual Card & Club Wallet
 * - Executive Consolidated Financials
 * - Pro Shop Orders, Low-stock Alerts & Racket Stringing Services
 */

const API_BASE = '';

function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(
    ([, val]) => val !== undefined && val !== null && val !== ''
  );
  if (entries.length === 0) return '';
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { success: false, message: response.statusText };
  }

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.errors = data.errors || [];
    throw error;
  }

  return data;
}

export const api = {
  // 1. Authentication API
  auth: {
    login: async (credentials) => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (res.token) {
        localStorage.setItem('token', res.token);
      }
      if (res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('champions_user', JSON.stringify(res.user));
      }
      return res;
    },
    register: async (userData) => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      if (res.token) {
        localStorage.setItem('token', res.token);
      }
      if (res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('champions_user', JSON.stringify(res.user));
      }
      return res;
    },
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('champions_user');
      return request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    },
    getUser: () => {
      const user = localStorage.getItem('user') || localStorage.getItem('champions_user');
      try {
        return user ? JSON.parse(user) : null;
      } catch {
        return null;
      }
    },
    updateUser: (updatedData) => {
      const current = api.auth.getUser() || {};
      const merged = { ...current, ...updatedData };
      localStorage.setItem('user', JSON.stringify(merged));
      localStorage.setItem('champions_user', JSON.stringify(merged));
      return merged;
    },
  },

  // 2. Front Desk Walk-ins Module
  walkins: {
    register: (data) =>
      request('/walkins/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAll: (params = {}) => request(`/walkins${buildQueryString(params)}`),
    getByPhone: (phone) => request(`/walkins/${encodeURIComponent(phone)}`),
    getStats: () => request('/walkins/stats'),
  },

  // 3. Front Desk Call Logs Module
  callLogs: {
    create: (data) =>
      request('/call-logs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAll: (params = {}) => request(`/call-logs${buildQueryString(params)}`),
    getById: (id) => request(`/call-logs/${encodeURIComponent(id)}`),
  },

  // 4. Staff Shift Schedule Module
  schedules: {
    create: (data) =>
      request('/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAll: (params = {}) => request(`/schedules${buildQueryString(params)}`),
    getById: (id) => request(`/schedules/${encodeURIComponent(id)}`),
    update: (id, data) =>
      request(`/schedules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      request(`/schedules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },

  // 5. Daily Activities Module
  dailyActivities: {
    get: (date) => request(`/daily-activities${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  },

  // 6. Sports & Court Slots
  sports: {
    getSports: () => request('/api/sports'),
    getSlots: (params = {}) => request(`/api/sports/slots${buildQueryString(params)}`),
    getPricing: () => request('/api/sports/pricing'),
  },

  // 7. Court Bookings (Hold, Confirm, Cancel)
  bookings: {
    createHold: (data) =>
      request('/api/bookings/hold', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    confirmHold: (data) =>
      request('/api/bookings/confirm', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    releaseHold: (id) =>
      request(`/api/bookings/hold/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    getMyBookings: () => request('/api/bookings/my-bookings'),
    getBooking: (id) => request(`/api/bookings/${encodeURIComponent(id)}`),
    cancelBooking: (id, reason) =>
      request(`/api/bookings/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  // 8. Front Desk Member 360 Recognition & History
  member360: {
    search: (query) =>
      request(`/api/front-desk/members/search?query=${encodeURIComponent(query)}`),
    getByPhone: (phone) =>
      request(`/api/front-desk/members/phone/${encodeURIComponent(phone)}`),
    getHistory: (memberId) =>
      request(`/api/front-desk/members/${encodeURIComponent(memberId)}/history`),
    checkin: (memberId, notes = '') =>
      request(`/api/front-desk/members/${encodeURIComponent(memberId)}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
  },

  // 9. CRM Enquiries & Leads Pipeline
  crm: {
    submitEnquiry: (data) =>
      request('/api/enquiries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getEnquiries: (params = {}) =>
      request(`/api/enquiries${buildQueryString(params)}`),
    getOverview: () => request('/api/enquiries/overview'),
    getById: (id) => request(`/api/enquiries/${encodeURIComponent(id)}`),
    updateStatus: (id, data) =>
      request(`/api/enquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    sendQuote: (id, data) =>
      request(`/api/enquiries/${encodeURIComponent(id)}/quote`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    bookTrial: (id, data) =>
      request(`/api/enquiries/${encodeURIComponent(id)}/trial`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    convertLead: (id, data) =>
      request(`/api/enquiries/${encodeURIComponent(id)}/convert`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // 10. Staff Leave Management & HR Approvals
  leaves: {
    submit: (data) =>
      request('/api/staff/leaves', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAll: (params = {}) =>
      request(`/api/staff/leaves${buildQueryString(params)}`),
    getById: (id) => request(`/api/staff/leaves/${encodeURIComponent(id)}`),
    getBalance: (staffId, year = '') =>
      request(`/api/staff/leaves/balance/${encodeURIComponent(staffId)}${year ? `?year=${encodeURIComponent(year)}` : ''}`),
    getCoverage: (params = {}) => {
      const q = typeof params === 'string' ? (params ? `?date=${encodeURIComponent(params)}` : '') : buildQueryString(params);
      return request(`/api/staff/leaves/coverage${q}`);
    },
    approve: (id, payload = {}) => {
      const body = typeof payload === 'string' ? { reviewNotes: payload, remarks: payload } : payload;
      return request(`/api/staff/leaves/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    reject: (id, reason = '') => {
      const body = typeof reason === 'object' ? reason : { rejectionReason: reason, remarks: reason };
      return request(`/api/staff/leaves/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    cancel: (id, reason = '') =>
      request(`/api/staff/leaves/${encodeURIComponent(id)}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),
    getStaffList: () => request('/api/staff'),
  },

  // 11. Virtual Card & Club Wallet
  wallet: {
    getDetails: () => request('/api/wallet/details'),
    getByPhone: (phone) => request(`/api/wallet/${encodeURIComponent(phone)}`),
    getTransactions: (params = {}) =>
      request(`/api/wallet/transactions${buildQueryString(params)}`),
    topup: (data) =>
      request('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    requestOtp: (phone, amount, moduleOrPurpose = 'SHOP') =>
      request('/api/wallet/request-payment-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, amount, module: moduleOrPurpose }),
      }),
    pay: (data) =>
      request('/api/wallet/pay', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // 12. Executive Consolidated Financials
  financials: {
    getConsolidated: (period = 'this_month') =>
      request(`/api/financials?period=${encodeURIComponent(period)}`),
  },

  // 13. Sports Shop, Click & Collect PIN, Low-stock & Stringing Service
  shop: {
    getProducts: (params = {}) =>
      request(`/api/shop/products${buildQueryString(params)}`),
    getProduct: (id) => request(`/api/shop/products/${encodeURIComponent(id)}`),
    getLowStockAlerts: () => request('/api/shop/inventory/low-stock'),
    restock: (productId, quantity, notes = '') =>
      request(`/api/shop/products/${encodeURIComponent(productId)}/restock`, {
        method: 'POST',
        body: JSON.stringify({ quantity, notes }),
      }),
    checkout: (data) =>
      request('/api/shop/checkout', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getOrders: (params = {}) =>
      request(`/api/shop/orders${buildQueryString(params)}`),
    getUserOrders: (userId) =>
      request(`/api/shop/orders/user/${encodeURIComponent(userId)}`),
    updateOrderStatus: (id, status, notes = '') =>
      request(`/api/shop/orders/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    cancelOrder: (id, reason = '') =>
      request(`/api/shop/orders/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    createStringing: (data) =>
      request('/api/shop/stringing', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getStringingList: (params = {}) =>
      request(`/api/shop/stringing${buildQueryString(params)}`),
    getStringingById: (id) =>
      request(`/api/shop/stringing/${encodeURIComponent(id)}`),
    updateStringingStatus: (id, data) =>
      request(`/api/shop/stringing/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // 14. Super Admin System Management & Overview
  superAdmin: {
    getOverview: () => request('/api/super-admin/overview'),
    getSubAdmins: () => request('/api/super-admin/sub-admins'),
    createSubAdmin: (data) =>
      request('/api/super-admin/sub-admins', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateSubAdminModule: (id, moduleName) =>
      request(`/api/super-admin/sub-admins/${encodeURIComponent(id)}/module`, {
        method: 'PUT',
        body: JSON.stringify({ module: moduleName }),
      }),
    updateUserRole: (id, role) =>
      request(`/api/super-admin/users/${encodeURIComponent(id)}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    getSportsPricing: () => request('/api/super-admin/sports/pricing'),
    updateSportsPricing: (data) =>
      request('/api/super-admin/sports/pricing', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getModelData: (model, params = {}) =>
      request(`/api/super-admin/data/${encodeURIComponent(model)}${buildQueryString(params)}`),
  },

  // 15. Membership Plans, Status, Renewal & Upgrades
  membership: {
    getPlans: () => request('/api/membership/plans'),
    getStatus: () => request('/api/membership/status'),
    renew: (data = {}) =>
      request('/api/membership/renew', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    upgrade: (data) =>
      request('/api/membership/upgrade', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getExpiring: (params = {}) =>
      request(`/api/membership/expiring${buildQueryString(params)}`),
    triggerExpiryCheck: (data = {}) =>
      request('/api/membership/trigger-expiry-check', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // 16. Court-Side Bar & Cafeteria (FastAPI Parity)
  cafe: {
    getMenu: (params = {}) =>
      request(`/api/cafe/menu${buildQueryString(params)}`),
    getMenuItem: (id) =>
      request(`/api/cafe/menu/${encodeURIComponent(id)}`),
    createMenuItem: (data) =>
      request('/api/cafe/menu', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateMenuItem: (id, data) =>
      request(`/api/cafe/menu/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteMenuItem: (id) =>
      request(`/api/cafe/menu/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    toggleAvailability: (id) =>
      request(`/api/cafe/menu/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
      }),
    createOrder: (data) =>
      request('/api/cafe/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getOrder: (id) =>
      request(`/api/cafe/orders/${encodeURIComponent(id)}`),
    getMyOrders: () => request('/api/cafe/orders/mine'),
    getOrders: (params = {}) =>
      request(`/api/cafe/orders${buildQueryString(params)}`),
    updateOrderStatus: (id, status, notes = null) =>
      request(`/api/cafe/orders/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    getReceipt: (id) =>
      request(`/api/cafe/orders/${encodeURIComponent(id)}/receipt`),
    downloadReceiptPdf: async (id, filename = null) => {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/cafe/orders/${encodeURIComponent(id)}/receipt/pdf`, { headers });
      if (!res.ok) throw new Error('Failed to download PDF receipt.');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || `receipt-${id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    },
    getOrderSummary: (params = {}) =>
      request(`/api/cafe/orders/summary${buildQueryString(params)}`),
    getStats: () => request('/api/cafe/stats'),
    getCustomer: (id) =>
      request(`/api/cafe/customers/${encodeURIComponent(id)}`),
  },

  // 17. System Health
  health: () => request('/api/health'),
};

api.bar = api.cafe;

export default api;
