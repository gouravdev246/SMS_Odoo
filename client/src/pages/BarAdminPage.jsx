import { useState, useEffect, useCallback } from 'react';
import PageBanner from '../components/common/PageBanner';
import { api } from '../services/api';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Tickets', icon: 'fa-layer-group' },
  { id: 'RECEIVED', label: 'New Orders', icon: 'fa-bell', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { id: 'PREPARING', label: 'In Kitchen', icon: 'fa-fire-burner', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { id: 'READY', label: 'Ready for Runner', icon: 'fa-person-running', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse' },
  { id: 'SERVED', label: 'Served', icon: 'fa-check', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
];

const MENU_CATEGORIES = [
  'Hot Beverages',
  'Chilled Drinks',
  'Smoothies',
  'Fitness Snacks',
  'Artisanal Sandwiches',
  'Alcoholic Cocktails',
  'Craft Beers',
  'Wine & Spirits',
  'Court-Side Hydration',
];

export default function BarAdminPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [activeView, setActiveView] = useState('KDS'); // 'KDS' | 'MENU_MANAGER'

  // Order Summary with Date Filtering (FastAPI GET /admin/orders/summary)
  const [summaryRange, setSummaryRange] = useState('TODAY');
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Receipt Inspection & PDF Download (FastAPI GET /orders/{id}/receipt & /pdf)
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Menu Item CRUD Modals (FastAPI POST/PUT/DELETE /admin/menu)
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'Hot Beverages',
    price: '',
    description: '',
    preparationTime: '5',
    calories: '',
    isAvailable: true,
    isVegan: false,
    isGlutenFree: false,
  });
  const [submittingMenu, setSubmittingMenu] = useState(false);

  const formatINR = (amt) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [ordersRes, statsRes, menuRes] = await Promise.all([
          api.cafe.getOrders({ status: activeTab === 'ALL' ? undefined : activeTab, limit: 50 }).catch(() => ({ orders: [] })),
          api.cafe.getStats().catch(() => null),
          api.cafe.getMenu().catch(() => ({ menu: [] })),
        ]);

        if (isMounted) {
          if (ordersRes?.orders) setOrders(ordersRes.orders);
          if (statsRes?.stats) setStats(statsRes.stats);
          if (menuRes?.menu) setMenuItems(menuRes.menu);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load bar & lounge operations data.');
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [ordersRes, statsRes, menuRes] = await Promise.all([
        api.cafe.getOrders({ status: activeTab === 'ALL' ? undefined : activeTab, limit: 50 }).catch(() => ({ orders: [] })),
        api.cafe.getStats().catch(() => null),
        api.cafe.getMenu().catch(() => ({ menu: [] })),
      ]);
      if (ordersRes?.orders) setOrders(ordersRes.orders);
      if (statsRes?.stats) setStats(statsRes.stats);
      if (menuRes?.menu) setMenuItems(menuRes.menu);
      fetchSummary(summaryRange);
    } catch (err) {
      setError(err.message || 'Failed to load bar & lounge operations data.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Orders Sales Summary (FastAPI GET /admin/orders/summary)
  const fetchSummary = useCallback(async (range) => {
    setLoadingSummary(true);
    try {
      let start_date = undefined;
      let end_date = undefined;
      const now = new Date();
      if (range === 'TODAY') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start_date = start.toISOString();
      } else if (range === 'WEEK') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        start_date = start.toISOString();
      } else if (range === 'MONTH') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        start_date = start.toISOString();
      }
      const res = await api.cafe.getOrderSummary({ start_date, end_date });
      if (res?.success && res.summary) {
        setSummaryData(res.summary);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(summaryRange);
  }, [summaryRange, fetchSummary]);

  // View Detailed Order Receipt (FastAPI GET /orders/{id}/receipt)
  const handleViewReceipt = async (orderId) => {
    setLoadingReceipt(true);
    try {
      const res = await api.cafe.getReceipt(orderId);
      if (res?.success && res.receipt) {
        setSelectedReceipt(res.receipt);
      } else {
        setError('Could not retrieve order receipt.');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Error fetching receipt.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Download Official PDF Receipt (FastAPI GET /orders/{id}/receipt/pdf)
  const handleDownloadPdf = async (orderId, orderNumber = '') => {
    setDownloadingPdf(true);
    try {
      await api.cafe.downloadReceiptPdf(orderId, `receipt-${orderNumber || orderId.slice(0, 8)}.pdf`);
      setActionSuccess('Official PDF receipt downloaded successfully.');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to download receipt PDF.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Menu Item CRUD Handlers (FastAPI POST/PUT/DELETE /admin/menu)
  const handleOpenAddMenu = () => {
    setEditingItem(null);
    setMenuForm({
      name: '',
      category: 'Hot Beverages',
      price: '',
      description: '',
      preparationTime: '5',
      calories: '',
      isAvailable: true,
      isVegan: false,
      isGlutenFree: false,
    });
    setMenuModalOpen(true);
  };

  const handleOpenEditMenu = (item) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name || '',
      category: item.category || 'Hot Beverages',
      price: String(item.price || ''),
      description: item.description || '',
      preparationTime: String(item.preparationTime || '5'),
      calories: item.calories ? String(item.calories) : '',
      isAvailable: item.isAvailable ?? true,
      isVegan: Boolean(item.isVegan),
      isGlutenFree: Boolean(item.isGlutenFree),
    });
    setMenuModalOpen(true);
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price) {
      setError('Please provide item name and price.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    setSubmittingMenu(true);
    try {
      const payload = {
        name: menuForm.name,
        category: menuForm.category,
        price: parseFloat(menuForm.price),
        description: menuForm.description,
        preparationTime: parseInt(menuForm.preparationTime, 10) || 5,
        calories: menuForm.calories ? parseInt(menuForm.calories, 10) : null,
        isAvailable: menuForm.isAvailable,
        isVegan: menuForm.isVegan,
        isGlutenFree: menuForm.isGlutenFree,
      };

      if (editingItem) {
        const res = await api.cafe.updateMenuItem(editingItem.id, payload);
        if (res?.success) {
          setMenuItems((prev) =>
            prev.map((m) => (m.id === editingItem.id ? res.item : m))
          );
          setActionSuccess(`Updated '${res.item.name}' successfully.`);
          setMenuModalOpen(false);
        }
      } else {
        const res = await api.cafe.createMenuItem(payload);
        if (res?.success) {
          setMenuItems((prev) => [res.item, ...prev]);
          setActionSuccess(`Added '${res.item.name}' to the menu.`);
          setMenuModalOpen(false);
        }
      }
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save menu item.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSubmittingMenu(false);
    }
  };

  const handleDeleteMenuItem = async (itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to delete/archive '${itemName}'?`)) return;
    try {
      const res = await api.cafe.deleteMenuItem(itemId);
      if (res?.success) {
        setMenuItems((prev) => prev.filter((m) => m.id !== itemId));
        setActionSuccess(`Item '${itemName}' archived from menu.`);
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete menu item.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Advance Order Status in KDS
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await api.cafe.updateOrderStatus(orderId, newStatus);
      if (res?.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        setActionSuccess(`Order #${res.order?.orderNumber || orderId.slice(0, 8)} status marked as ${newStatus}.`);
        setTimeout(() => setActionSuccess(''), 4000);
        // refresh stats
        api.cafe.getStats().then((s) => s?.stats && setStats(s.stats)).catch(() => {});
      }
    } catch (err) {
      setError(err.message || 'Failed to update order status.');
      setTimeout(() => setError(''), 5000);
    }
  };

  // Toggle Menu Item Availability
  const handleToggleAvailability = async (itemId) => {
    try {
      const res = await api.cafe.toggleAvailability(itemId);
      if (res?.success) {
        setMenuItems((prev) =>
          prev.map((m) => (m.id === itemId ? { ...m, isAvailable: res.item.isAvailable } : m))
        );
        setActionSuccess(res.message);
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle availability.');
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <main className="bg-[#0e0f0f] text-gray-100 min-h-screen">
      <PageBanner
        title="Court-Side Bar & KDS Operations"
        current="Bar Admin Console"
        bannerClass="banner-inner-booking"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header & View Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C6EF2E] animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#C6EF2E]">
                Kitchen Display System (KDS) & Bar Management
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">Hospitality Operations Center</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#141516] border border-[#262829] rounded-2xl p-1 flex items-center">
              <button
                onClick={() => setActiveView('KDS')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeView === 'KDS'
                    ? 'bg-[#C6EF2E] text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-bell-concierge"></i>
                <span>Kitchen Tickets</span>
              </button>

              <button
                onClick={() => setActiveView('MENU_MANAGER')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeView === 'MENU_MANAGER'
                    ? 'bg-[#C6EF2E] text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-list-check"></i>
                <span>Menu Inventory</span>
              </button>
            </div>

            <button
              onClick={handleRefresh}
              className="px-3.5 py-2.5 rounded-2xl bg-[#1c1d1e] hover:bg-[#26282a] text-xs font-bold text-gray-200 transition-all border border-gray-700 flex items-center gap-2"
            >
              <i className={`fa-solid fa-arrows-rotate text-[#C6EF2E] ${loading ? 'fa-spin' : ''}`}></i>
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="p-3.5 mb-6 rounded-2xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-white">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3.5 mb-6 rounded-2xl bg-[#C6EF2E]/10 text-[#C6EF2E] border border-[#C6EF2E]/30 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-circle-check"></i>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-gray-400 hover:text-white">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* FastAPI Order Summary & Analytics Toolbar (GET /admin/orders/summary) */}
        <div className="bg-[#141516] border border-[#242627] rounded-3xl p-5 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#242627]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-sm">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Sales & Order Analytics</h4>
                <p className="text-[11px] text-gray-400">
                  Real-time sales summary and Average Order Value (AOV) from FastAPI backend
                </p>
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 bg-[#0e0f0f] p-1 rounded-xl border border-gray-800 text-xs font-bold">
              {[
                { id: 'TODAY', label: 'Today' },
                { id: 'WEEK', label: '7 Days' },
                { id: 'MONTH', label: '30 Days' },
                { id: 'ALL', label: 'All-Time' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSummaryRange(r.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    summaryRange === r.id
                      ? 'bg-[#C6EF2E] text-black shadow-sm font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Total Revenue
              </div>
              <div className="text-lg md:text-xl font-black text-[#C6EF2E] font-mono mt-0.5">
                {loadingSummary ? '...' : formatINR(summaryData?.total_sales_amount || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Orders Completed
              </div>
              <div className="text-lg md:text-xl font-black text-white font-mono mt-0.5">
                {loadingSummary ? '...' : summaryData?.total_orders || 0}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Avg Order Value (AOV)
              </div>
              <div className="text-lg md:text-xl font-black text-cyan-300 font-mono mt-0.5">
                {loadingSummary ? '...' : formatINR(summaryData?.average_order_value || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Analytics Window
              </div>
              <div className="text-xs font-semibold text-gray-300 mt-1">
                {summaryRange === 'TODAY'
                  ? "Today's Tab"
                  : summaryRange === 'WEEK'
                  ? 'Last 7 Days Rolling'
                  : summaryRange === 'MONTH'
                  ? 'Last 30 Days Rolling'
                  : 'All Historic Orders'}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-3xl bg-[#141516] border border-[#242627] shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Today's Bar Revenue
              </span>
              <span className="w-8 h-8 rounded-xl bg-[#C6EF2E]/10 text-[#C6EF2E] flex items-center justify-center text-sm">
                <i className="fa-solid fa-indian-rupee-sign"></i>
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-white font-mono">
              {formatINR(stats?.todayRevenue || 0)}
            </div>
            <div className="text-[10px] text-[#C6EF2E] mt-1">
              {stats?.todayOrders || 0} tabs processed today
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-[#141516] border border-[#242627] shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Active Kitchen Tickets
              </span>
              <span className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-300 flex items-center justify-center text-sm">
                <i className="fa-solid fa-fire-burner"></i>
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-amber-300 font-mono">
              {stats?.activeTickets || 0}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Received & preparing</div>
          </div>

          <div className="p-4 rounded-3xl bg-[#141516] border border-[#242627] shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Ready for Delivery
              </span>
              <span className="w-8 h-8 rounded-xl bg-blue-400/10 text-blue-300 flex items-center justify-center text-sm">
                <i className="fa-solid fa-person-running"></i>
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-blue-300 font-mono">
              {stats?.readyForDelivery || 0}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Awaiting runner / pickup</div>
          </div>

          <div className="p-4 rounded-3xl bg-[#141516] border border-[#242627] shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Served Completed
              </span>
              <span className="w-8 h-8 rounded-xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center text-sm">
                <i className="fa-solid fa-circle-check"></i>
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-emerald-300 font-mono">
              {stats?.servedTickets || 0}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Delivered to courts & lounge</div>
          </div>
        </div>

        {/* VIEW 1: KITCHEN DISPLAY SYSTEM TICKETS */}
        {activeView === 'KDS' && (
          <div>
            {/* Status Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-[#C6EF2E] text-black shadow-lg shadow-[#C6EF2E]/10'
                      : 'bg-[#141516] text-gray-400 border border-[#242627] hover:border-gray-600'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Ticket Cards Grid */}
            {loading ? (
              <div className="py-20 text-center text-gray-400">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#C6EF2E] mb-3"></i>
                <p className="text-xs">Updating Kitchen Display Tickets...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center bg-[#141516] border border-[#242627] rounded-3xl p-8">
                <div className="w-16 h-16 rounded-full bg-[#1c1d1e] flex items-center justify-center text-gray-500 text-2xl mx-auto mb-3">
                  <i className="fa-solid fa-mug-hot"></i>
                </div>
                <h4 className="text-base font-bold text-white mb-1">No Orders in this Queue</h4>
                <p className="text-xs text-gray-400">
                  {activeTab === 'ALL'
                    ? 'No orders recorded yet.'
                    : `No orders currently marked as '${activeTab}'.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {orders.map((order) => {
                  return (
                    <div
                      key={order.id}
                      className="bg-[#141516] border border-[#252728] rounded-3xl p-5 shadow-xl flex flex-col justify-between hover:border-gray-600 transition-all"
                    >
                      <div>
                        {/* Ticket Top Row: Order #, Time, Status Pill */}
                        <div className="flex items-center justify-between pb-3 border-b border-[#212224] mb-3">
                          <div>
                            <span className="font-mono font-black text-sm text-[#C6EF2E]">
                              {order.orderNumber}
                            </span>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {order.dateTime ? new Date(order.dateTime).toLocaleTimeString() : 'Just now'}
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              order.status === 'RECEIVED'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                : order.status === 'PREPARING'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : order.status === 'READY'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        {/* Destination Pill & Member Info */}
                        <div className="flex items-center justify-between gap-2 mb-3 bg-[#0f1011] p-2.5 rounded-xl border border-[#202122]">
                          <div>
                            <div className="text-xs font-bold text-white">
                              {order.user?.name || 'Walk-in Guest'}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {order.user?.phone || 'No Phone'}
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase inline-block ${
                                order.deliveryLocation === 'COURT_SIDE'
                                  ? 'bg-[#C6EF2E]/20 text-[#C6EF2E] border border-[#C6EF2E]/40'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              }`}
                            >
                              <i
                                className={`fa-solid ${
                                  order.deliveryLocation === 'COURT_SIDE'
                                    ? 'fa-bolt'
                                    : order.deliveryLocation === 'BAR_LOUNGE'
                                    ? 'fa-chair'
                                    : 'fa-bag-shopping'
                                } mr-1`}
                              ></i>
                              {order.courtNumber || (order.tableNumber ? `Table #${order.tableNumber}` : 'Takeaway')}
                            </span>
                          </div>
                        </div>

                        {/* Itemized Order List */}
                        <div className="space-y-1.5 mb-3">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Ticket Items:
                          </div>
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs py-1 border-b border-[#1c1d1e] last:border-none"
                              >
                                <span className="font-semibold text-gray-200">
                                  <span className="text-[#C6EF2E] font-bold mr-1.5">
                                    {item.quantity}x
                                  </span>
                                  {item.name}
                                </span>
                                <span className="text-gray-400 font-mono text-[11px]">
                                  {formatINR(item.totalPrice)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-gray-300">
                              {order.orderItems?.join(', ') || 'Custom order items'}
                            </div>
                          )}
                        </div>

                        {/* Customer Notes */}
                        {order.notes && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 mb-3">
                            <i className="fa-solid fa-comment-dots mr-1.5"></i>
                            <strong className="font-bold">Note:</strong> {order.notes}
                          </div>
                        )}
                      </div>

                      {/* Bottom Total & KDS Advance Controls */}
                      <div className="pt-3 border-t border-[#212224] mt-2">
                        <div className="flex items-center justify-between mb-3 text-xs">
                          <span className="text-gray-400">Total Charged:</span>
                          <span className="font-black text-[#C6EF2E] text-sm">
                            {formatINR(order.totalAmount)}
                          </span>
                        </div>

                        {/* Receipt & PDF Inspection Controls (FastAPI) */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(order.id)}
                            disabled={loadingReceipt}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#1c1d1e] hover:bg-[#27282a] text-[11px] font-bold text-gray-200 border border-[#2b2d2f] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <i className="fa-solid fa-receipt text-[#C6EF2E]"></i>
                            <span>Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(order.id, order.orderNumber)}
                            disabled={downloadingPdf}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#1c1d1e] hover:bg-[#27282a] text-[11px] font-bold text-[#C6EF2E] border border-[#2b2d2f] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <i className="fa-solid fa-file-pdf"></i>
                            <span>PDF</span>
                          </button>
                        </div>

                        {/* Status Transition Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {order.status === 'RECEIVED' && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                                className="col-span-2 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs transition-all flex items-center justify-center gap-1.5"
                              >
                                <i className="fa-solid fa-fire-burner"></i>
                                <span>Start Prep</span>
                              </button>
                            </>
                          )}

                          {order.status === 'PREPARING' && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                                className="col-span-2 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
                              >
                                <i className="fa-solid fa-person-running"></i>
                                <span>Mark Ready for Runner</span>
                              </button>
                            </>
                          )}

                          {order.status === 'READY' && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'SERVED')}
                                className="col-span-2 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                              >
                                <i className="fa-solid fa-circle-check"></i>
                                <span>Mark Served ✓</span>
                              </button>
                            </>
                          )}

                          {order.status === 'SERVED' && (
                            <div className="col-span-2 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-center text-[11px] font-bold">
                              ✓ Completed & Delivered
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: MENU INVENTORY & AVAILABILITY MANAGER (FastAPI CRUD) */}
        {activeView === 'MENU_MANAGER' && (
          <div className="bg-[#141516] border border-[#242627] rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#242627]">
              <div>
                <h3 className="text-xl font-black text-white">Menu Availability & Stock Control</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Full FastAPI CRUD: Add new items, update pricing & descriptions, restock or archive.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#C6EF2E] font-bold">
                  {menuItems.length} Active Items
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddMenu}
                  className="px-3.5 py-2 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#C6EF2E]/20"
                >
                  <i className="fa-solid fa-plus"></i>
                  <span>Add Menu Item</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    item.isAvailable
                      ? 'bg-[#111213] border-[#262829]'
                      : 'bg-[#181313] border-red-900/40 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div>
                        <h4 className="text-sm font-bold text-white mb-0.5">{item.name}</h4>
                        <span className="text-[10px] text-[#C6EF2E] uppercase font-bold tracking-wider">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-mono font-black text-white text-sm">
                        {formatINR(item.price)}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 line-clamp-2 mb-2">
                      {item.description || 'No description provided.'}
                    </p>

                    {/* Tags & Prep Time */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-gray-400 mb-3">
                      {item.preparationTime && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-gray-800">
                          ⏱ {item.preparationTime}m prep
                        </span>
                      )}
                      {item.calories && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-gray-800">
                          🔥 {item.calories} cal
                        </span>
                      )}
                      {item.isVegan && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          🌱 Vegan
                        </span>
                      )}
                      {item.isGlutenFree && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                          🌾 Gluten-Free
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#222425] space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold ${
                          item.isAvailable ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.isAvailable ? '● Available' : '○ Sold Out'}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          item.isAvailable
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black border border-emerald-500/30'
                        }`}
                      >
                        {item.isAvailable ? 'Mark Sold Out' : 'Restock'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[#1c1d1e]">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMenu(item)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-[11px] font-bold text-gray-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-pen-to-square text-[#C6EF2E]"></i>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMenuItem(item.id, item.name)}
                        className="py-1.5 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-bold text-rose-400 border border-rose-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Archive Item"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT MENU ITEM (FastAPI POST /admin/menu & PUT /admin/menu/{id}) */}
      {menuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#141414] border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-sm">
                  <i className={`fa-solid ${editingItem ? 'fa-pen-to-square' : 'fa-plus'}`}></i>
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    FastAPI Dish & Drink Catalog
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
              <div>
                <label className="block text-gray-300 font-bold mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Signature Matcha Latte"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#C6EF2E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Category *</label>
                  <select
                    value={menuForm.category}
                    onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-[#C6EF2E]"
                  >
                    {MENU_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="180"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#C6EF2E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Artisanal description of ingredients and flavors..."
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#C6EF2E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Prep Time (mins)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="5"
                    value={menuForm.preparationTime}
                    onChange={(e) => setMenuForm({ ...menuForm, preparationTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-[#C6EF2E]"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Calories (kcal)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="220"
                    value={menuForm.calories}
                    onChange={(e) => setMenuForm({ ...menuForm, calories: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-[#C6EF2E]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-gray-200">
                  <input
                    type="checkbox"
                    checked={menuForm.isAvailable}
                    onChange={(e) => setMenuForm({ ...menuForm, isAvailable: e.target.checked })}
                    className="rounded border-gray-700 text-[#C6EF2E] focus:ring-0"
                  />
                  <span>Mark as Available / In Stock immediately</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-200">
                  <input
                    type="checkbox"
                    checked={menuForm.isVegan}
                    onChange={(e) => setMenuForm({ ...menuForm, isVegan: e.target.checked })}
                    className="rounded border-gray-700 text-[#C6EF2E] focus:ring-0"
                  />
                  <span>🌱 100% Plant-Based / Vegan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-200">
                  <input
                    type="checkbox"
                    checked={menuForm.isGlutenFree}
                    onChange={(e) => setMenuForm({ ...menuForm, isGlutenFree: e.target.checked })}
                    className="rounded border-gray-700 text-[#C6EF2E] focus:ring-0"
                  />
                  <span>🌾 Certified Gluten-Free</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMenuModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMenu}
                  className="px-5 py-2 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingMenu ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>{editingItem ? 'Save Changes' : 'Create Item'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT RECEIPT (FastAPI GET /orders/{id}/receipt & /pdf) */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#141414] border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-sm">
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Order Receipt Breakdown</h3>
                  <p className="text-[10px] text-gray-400 font-mono">
                    Order #{selectedReceipt.order_number || selectedReceipt.order_id?.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Receipt Header Info */}
              <div className="bg-gray-900/80 rounded-xl p-3 border border-gray-800/80 space-y-1.5 text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Date & Time:</span>
                  <span className="font-medium text-white">
                    {selectedReceipt.date_time ? new Date(selectedReceipt.date_time).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Customer:</span>
                  <span className="font-medium text-white">{selectedReceipt.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Destination:</span>
                  <span className="font-bold text-[#C6EF2E]">{selectedReceipt.court_or_table}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment:</span>
                  <span className="font-medium text-white uppercase font-mono text-[11px]">
                    {selectedReceipt.payment_method} ({selectedReceipt.payment_status})
                  </span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                  Ordered Items
                </div>
                <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60 bg-gray-950/40">
                  {selectedReceipt.items?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs">{item.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {item.quantity} × {formatINR(item.unit_price)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-white text-xs">
                        {formatINR(item.total_price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 space-y-1.5 text-gray-300">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">{formatINR(selectedReceipt.subtotal)}</span>
                </div>
                {selectedReceipt.discount_applied > 0 && (
                  <div className="flex justify-between text-[#C6EF2E]">
                    <span>Membership Discount ({selectedReceipt.membership_tier})</span>
                    <span className="font-mono">- {formatINR(selectedReceipt.discount_applied)}</span>
                  </div>
                )}
                {selectedReceipt.tax_amount > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Tax</span>
                    <span className="font-mono text-white">{formatINR(selectedReceipt.tax_amount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-800 pt-2 flex justify-between font-black text-sm text-white">
                  <span>Grand Total</span>
                  <span className="text-[#C6EF2E] font-mono">{formatINR(selectedReceipt.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-gray-800 flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleDownloadPdf(selectedReceipt.order_id, selectedReceipt.order_number)}
                disabled={downloadingPdf}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-download"></i>
                    <span>Download PDF Receipt</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
