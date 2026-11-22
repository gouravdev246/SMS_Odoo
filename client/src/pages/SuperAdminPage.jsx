import { useState, useEffect, useCallback } from 'react';
import PageBanner from '../components/common/PageBanner';
import ScrollReveal from '../components/common/ScrollReveal';
import { api } from '../services/api';

export default function SuperAdminPage() {
  const [period, setPeriod] = useState('this_month');
  const [financials, setFinancials] = useState(null);
  const [overview, setOverview] = useState(null);
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Subadmin reassignment modal state
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [newModule, setNewModule] = useState('front-desk');
  const [updatingModule, setUpdatingModule] = useState(false);

  // Subadmin creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [subAdminForm, setSubAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'SUBADMIN',
    module: 'front-desk',
    salary: '35000',
  });
  const [creatingSubAdmin, setCreatingSubAdmin] = useState(false);

  // Live member activity feed tab ('bookings' | 'orders' | 'purchases' | 'members')
  const [activityTab, setActivityTab] = useState('bookings');

  // Dedicated Court Bookings Management State
  const [courtBookings, setCourtBookings] = useState([]);
  const [courtFilter, setCourtFilter] = useState('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');

  // Fetch consolidated financials, system overview, and court bookings
  const loadDashboardData = useCallback(async (currentPeriod) => {
    setLoading(true);
    setError('');
    try {
      const [finRes, ovRes, subRes, bookingsRes] = await Promise.all([
        api.financials.getConsolidated(currentPeriod).catch((err) => {
          console.warn('Financials load note:', err.message);
          return { report: null };
        }),
        api.superAdmin.getOverview().catch((err) => {
          console.warn('Overview load note:', err.message);
          return { counts: {}, modules: {}, recentActivity: {} };
        }),
        api.superAdmin.getSubAdmins().catch((err) => {
          console.warn('SubAdmins load note:', err.message);
          return { subAdmins: [] };
        }),
        api.superAdmin.getCourtBookings().catch((err) => {
          console.warn('CourtBookings load note:', err.message);
          return { data: [] };
        }),
      ]);

      const finData = finRes?.report || finRes || {};
      setFinancials(finData);
      setOverview(ovRes || {});
      const staffList = Array.isArray(subRes) ? subRes : (subRes?.subAdmins || []);
      setSubAdmins(staffList);
      setCourtBookings(bookingsRes?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load executive dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      try {
        const meRes = await api.auth.getMe().catch(() => null);
        if (meRes?.user && isMounted) {
          api.auth.updateUser(meRes.user);
        }
      } catch {}
      if (isMounted) {
        loadDashboardData(period);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [period, loadDashboardData]);

  // Handle module reassignment
  const handleReassignModule = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setUpdatingModule(true);
    try {
      await api.superAdmin.updateSubAdminModule(selectedStaff.id || selectedStaff.userId, newModule);
      setActionSuccess(`Staff member ${selectedStaff.name} reassigned to '${newModule}' module successfully.`);
      setSelectedStaff(null);
      loadDashboardData(period);
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to update module assignment.');
    } finally {
      setUpdatingModule(false);
    }
  };

  // Handle new sub-admin creation
  const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    setCreatingSubAdmin(true);
    setModalError('');
    setError('');
    try {
      const res = await api.superAdmin.createSubAdmin(subAdminForm);
      const newStaff = res?.subAdmin;
      if (newStaff) {
        setSubAdmins((prev) => {
          const filtered = prev.filter((s) => s.email?.toLowerCase() !== newStaff.email?.toLowerCase());
          return [newStaff, ...filtered];
        });
      }
      setActionSuccess(`Sub-Admin '${subAdminForm.name}' created successfully with '${subAdminForm.module}' access!`);
      setCreateModalOpen(false);
      setSubAdminForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'SUBADMIN',
        module: 'front-desk',
        salary: '35000',
      });
      await loadDashboardData(period);
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      const errMsg = err.message || (err.data && err.data.message) || 'Failed to create sub-admin.';
      setModalError(errMsg);
      setError(errMsg);
    } finally {
      setCreatingSubAdmin(false);
    }
  };

  // Dual-compatible metrics extraction (supports both executiveSummary and legacy summary structures, fallback to overview modules)
  const courtsRev =
    financials?.revenueStreams?.courts?.totalRevenue ??
    financials?.streams?.courts?.revenue ??
    Number(overview?.modules?.sports?.totalBookingRevenue || 0);

  const shopRev =
    financials?.revenueStreams?.gearShop?.totalRevenue ??
    financials?.streams?.gearShop?.totalRevenue ??
    Number(overview?.modules?.shop?.totalRevenue || 0);

  const cafeRev =
    financials?.revenueStreams?.barAndCafeteria?.totalRevenue ??
    financials?.streams?.cafeAndBar?.revenue ??
    Number(overview?.modules?.cafe?.totalRevenue || 0);

  const grossRevenue =
    financials?.executiveSummary?.grossRevenue ??
    financials?.summary?.grossRevenue ??
    (courtsRev + shopRev + cafeRev);

  const netEarnings =
    financials?.executiveSummary?.netOperatingIncome ??
    financials?.summary?.netEarnings ??
    grossRevenue;

  const totalPayroll =
    financials?.liabilitiesAndObligations?.proratedStaffPayrollForPeriod ??
    financials?.liabilities?.totalPayrollLiability ??
    0;

  const walletLiabilities =
    financials?.liabilitiesAndObligations?.circulatingMemberBalancesOwed ??
    financials?.executiveSummary?.circulatingMemberBalances ??
    financials?.liabilities?.circulatingWalletBalances ??
    Number(overview?.modules?.users?.totalBalance || 0);

  const courtsBookingsCount =
    financials?.revenueStreams?.courts?.bookingsCount ??
    financials?.streams?.courts?.bookingsCount ??
    (overview?.modules?.sports?.totalBookings || 0);

  const shopPurchasesCount =
    financials?.revenueStreams?.gearShop?.purchasesCount ??
    financials?.streams?.gearShop?.purchasesCount ??
    (overview?.modules?.shop?.totalPurchases || 0);

  const cafeOrdersCount =
    financials?.revenueStreams?.barAndCafeteria?.ordersCount ??
    financials?.streams?.cafeAndBar?.ordersCount ??
    (overview?.modules?.cafe?.totalOrders || 0);

  const maxStreamRev = Math.max(courtsRev, shopRev, cafeRev, 1);
  const courtsBarPct = Math.round((courtsRev / maxStreamRev) * 100);
  const shopBarPct = Math.round((shopRev / maxStreamRev) * 100);
  const cafeBarPct = Math.round((cafeRev / maxStreamRev) * 100);

  // Recent member activities from overview
  const recentBookings = overview?.recentActivity?.recentBookings || [];
  const recentOrders = overview?.recentActivity?.recentOrders || [];
  const recentPurchases = overview?.recentActivity?.recentPurchases || [];
  const recentUsers = overview?.recentActivity?.recentUsers || [];

  // Membership counts
  const usersMod = overview?.modules?.users || {};
  const goldCount = usersMod.byMembership?.GOLD || 0;
  const silverCount = usersMod.byMembership?.SILVER || 0;
  const juniorCount = usersMod.byMembership?.JUNIOR || 0;
  const totalMembers = goldCount + silverCount + juniorCount || 1;

  const goldPct = Math.round((goldCount / totalMembers) * 100);
  const silverPct = Math.round((silverCount / totalMembers) * 100);
  const juniorPct = Math.round((juniorCount / totalMembers) * 100);

  // Filtered Court Bookings for Super Admin Oversight
  const filteredCourtBookings = courtBookings.filter((b) => {
    const matchesCourt = courtFilter === 'ALL' || b.whichCourt === courtFilter;
    const matchesStatus = bookingStatusFilter === 'ALL' || b.status === bookingStatusFilter;
    return matchesCourt && matchesStatus;
  });

  return (
    <main className="bg-[#0e0f0f] text-gray-100 min-h-screen">
      <PageBanner
        title="Super Admin Executive Analytics"
        current="Super Admin"
        bannerClass="banner-inner-booking"
      />

      <div className="section">
        <div className="hero-container">
          {/* Header Controls & Period Selector */}
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
            <div>
              <div className="sub-heading mb-1">
                <i className="fa-solid fa-circle accent-color-2"></i>
                <span className="sub-heading-title">Executive Intelligence Console</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-0">System Overview & Analytics</h2>
            </div>

            {/* Time Period Filter Pills */}
            <div className="d-flex align-items-center gap-1.5 p-1 bg-gray-900/80 rounded-xl border border-gray-800">
              {['today', 'this_week', 'this_month'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    period === p
                      ? 'bg-lime-400 text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {p === 'today' ? 'Today' : p === 'this_week' ? 'This Week' : 'This Month'}
                </button>
              ))}
              <button
                onClick={() => loadDashboardData(period)}
                className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white ml-1"
                title="Refresh Analytics"
              >
                <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin text-lime-400' : ''}`}></i>
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-rose-400">&times;</button>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs flex items-center justify-between">
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess('')} className="text-emerald-400">&times;</button>
            </div>
          )}

          {/* KPI Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card 1: Gross Consolidated Revenue */}
            <ScrollReveal animation="fade-up" delay={50}>
              <div className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gross Revenue</span>
                  <span className="w-8 h-8 rounded-xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-indian-rupee-sign"></i>
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono mb-1">
                  ₹{Number(grossRevenue).toLocaleString()}
                </div>
                <div className="text-[11px] text-lime-400 flex items-center gap-1 font-semibold">
                  <i className="fa-solid fa-arrow-trend-up"></i>
                  <span>Combined across Courts, Shop & Cafe</span>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 2: Net Operating Profit */}
            <ScrollReveal animation="fade-up" delay={100}>
              <div className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Net Retained</span>
                  <span className="w-8 h-8 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-wallet"></i>
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono mb-1">
                  ₹{Number(netEarnings).toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-400">
                  After staff payroll & obligations
                </div>
              </div>
            </ScrollReveal>

            {/* Card 3: Total Registered Members */}
            <ScrollReveal animation="fade-up" delay={150}>
              <div className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Club Members</span>
                  <span className="w-8 h-8 rounded-xl bg-blue-400/10 text-blue-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-users"></i>
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono mb-1">
                  {overview?.modules?.users?.total || 0}
                </div>
                <div className="text-[11px] text-blue-400">
                  {goldCount} Gold • {silverCount} Silver • {juniorCount} Junior
                </div>
              </div>
            </ScrollReveal>

            {/* Card 4: Active Staff & Sub-Admins */}
            <ScrollReveal animation="fade-up" delay={200}>
              <div className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Staff</span>
                  <span className="w-8 h-8 rounded-xl bg-purple-400/10 text-purple-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-id-badge"></i>
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono mb-1">
                  {overview?.modules?.staff?.totalStaff || subAdmins.length}
                </div>
                <div className="text-[11px] text-purple-300">
                  Across Bar, Shop, Front Desk & Ops
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Charts & Visual Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chart 1: Revenue Stream Comparison (Native SVG Bar Chart) */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                      <i className="fa-solid fa-chart-column text-lime-400"></i>
                      Revenue Streams Comparison
                    </h4>
                    <p className="text-xs text-gray-400 mb-0">Consolidated gross contributions by module</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-lime-400 bg-lime-400/10 px-2 py-1 rounded-lg">
                    ₹{grossRevenue.toLocaleString()}
                  </span>
                </div>

                {/* SVG Visual Bars */}
                <div className="space-y-4 my-6">
                  {/* Courts Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-1 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-lime-400"></span>
                        Sports Courts & Slots
                      </span>
                      <span className="font-mono text-lime-400">₹{courtsRev.toLocaleString()} ({courtsBarPct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800/80 rounded-full h-4 overflow-hidden p-0.5 border border-gray-700/50">
                      <div
                        className="bg-lime-400 h-full rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${Math.max(courtsBarPct, 4)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Pro Shop Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-1 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></span>
                        Pro Shop & Equipment Services
                      </span>
                      <span className="font-mono text-emerald-400">₹{shopRev.toLocaleString()} ({shopBarPct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800/80 rounded-full h-4 overflow-hidden p-0.5 border border-gray-700/50">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${Math.max(shopBarPct, 4)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Cafe & Bar Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-300 mb-1 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
                        Cafe, Bar & Lounge Orders
                      </span>
                      <span className="font-mono text-amber-400">₹{cafeRev.toLocaleString()} ({cafeBarPct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800/80 rounded-full h-4 overflow-hidden p-0.5 border border-gray-700/50">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${Math.max(cafeBarPct, 4)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Stream Footnotes */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-800/80 text-center text-xs">
                <div>
                  <div className="text-gray-400 text-[10px]">Courts Bookings</div>
                  <div className="font-bold text-white font-mono">{courtsBookingsCount}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px]">Shop Purchases</div>
                  <div className="font-bold text-white font-mono">{shopPurchasesCount}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px]">Cafe Bills</div>
                  <div className="font-bold text-white font-mono">{cafeOrdersCount}</div>
                </div>
              </div>
            </div>

            {/* Chart 2: Membership Tier Distribution (SVG Donut Visual) */}
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
                  <i className="fa-solid fa-gem text-lime-400"></i>
                  Membership Tiers
                </h4>
                <p className="text-xs text-gray-400 mb-4">Distribution of active member subscriptions</p>

                {/* SVG Donut Visual Representation */}
                <div className="flex items-center justify-center my-3">
                  <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#27272a"
                      strokeWidth="3.8"
                    />
                    {/* Gold stroke */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="3.8"
                      strokeDasharray={`${goldPct} ${100 - goldPct}`}
                      strokeDashoffset="0"
                    />
                    {/* Silver stroke */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="3.8"
                      strokeDasharray={`${silverPct} ${100 - silverPct}`}
                      strokeDashoffset={`${-goldPct}`}
                    />
                    {/* Junior stroke */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#a3e635"
                      strokeWidth="3.8"
                      strokeDasharray={`${juniorPct} ${100 - juniorPct}`}
                      strokeDashoffset={`${-(goldPct + silverPct)}`}
                    />
                  </svg>
                </div>

                {/* Donut Legend */}
                <div className="space-y-2 mt-4 text-xs">
                  <div className="flex justify-between items-center text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                      Gold Tier (20% off)
                    </span>
                    <span className="font-mono font-bold text-yellow-400">{goldCount} ({goldPct}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      Silver Tier (10% off)
                    </span>
                    <span className="font-mono font-bold text-slate-300">{silverCount} ({silverPct}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-lime-400"></span>
                      Junior Tier (15% off)
                    </span>
                    <span className="font-mono font-bold text-lime-400">{juniorCount} ({juniorPct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Liabilities & Payment Methods Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Liabilities Card */}
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl">
              <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-scale-balanced text-rose-400"></i>
                Liabilities & Obligations
              </h4>
              <p className="text-xs text-gray-400 mb-4">Prorated staff payroll and circulating member escrow</p>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Staff Payroll Liabilities</div>
                    <div className="text-[11px] text-gray-400">Prorated salary commitments for {period.replace('_', ' ')}</div>
                  </div>
                  <span className="text-base font-mono font-bold text-rose-400">₹{totalPayroll.toLocaleString()}</span>
                </div>

                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Member Virtual Card Escrow</div>
                    <div className="text-[11px] text-gray-400">Total unused funds held in customer wallets</div>
                  </div>
                  <span className="text-base font-mono font-bold text-amber-400">₹{walletLiabilities.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl">
              <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-credit-card text-lime-400"></i>
                Payment Methods Volume
              </h4>
              <p className="text-xs text-gray-400 mb-4">Transactions processed by payment rail</p>

              <div className="space-y-2.5 text-xs">
                {Object.entries(financials?.paymentMethodsBreakdown || {}).map(([method, data]) => (
                  <div key={method} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/40 border border-gray-800/80">
                    <span className="font-semibold text-gray-300 flex items-center gap-2">
                      <i className={`fa-solid ${
                        method === 'VIRTUAL_CARD' ? 'fa-mobile-screen-button text-lime-400' :
                        method === 'UPI' ? 'fa-qrcode text-emerald-400' :
                        method === 'CARD' ? 'fa-credit-card text-blue-400' :
                        'fa-money-bill-wave text-amber-400'
                      }`}></i>
                      {method.replace('_', ' ')}
                    </span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white">₹{data.revenue?.toLocaleString() || 0}</span>
                      <span className="text-[10px] text-gray-500 ml-2">({data.count || 0} txns)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Member Activity Feed Across Club Modules */}
          <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl mb-8">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
              <div>
                <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <i className="fa-solid fa-bolt text-lime-400"></i>
                  Live Member Activity Stream
                </h4>
                <p className="text-xs text-gray-400 mb-0">Real-time actions, court bookings, food orders, and gear purchases across all club modules</p>
              </div>

              {/* Activity Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-900/80 rounded-xl border border-gray-800">
                <button
                  onClick={() => setActivityTab('bookings')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activityTab === 'bookings'
                      ? 'bg-lime-400 text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-table-tennis-paddle-ball text-xs"></i>
                  <span>Courts ({recentBookings.length})</span>
                </button>
                <button
                  onClick={() => setActivityTab('orders')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activityTab === 'orders'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-utensils text-xs"></i>
                  <span>Bar & Cafe ({recentOrders.length})</span>
                </button>
                <button
                  onClick={() => setActivityTab('purchases')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activityTab === 'purchases'
                      ? 'bg-emerald-400 text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-store text-xs"></i>
                  <span>Pro Shop ({recentPurchases.length})</span>
                </button>
                <button
                  onClick={() => setActivityTab('members')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activityTab === 'members'
                      ? 'bg-blue-400 text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-users text-xs"></i>
                  <span>New Members ({recentUsers.length})</span>
                </button>
              </div>
            </div>

            {/* Activity Table: Court Bookings */}
            {activityTab === 'bookings' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Sport Court</th>
                      <th className="p-3">Slot Time</th>
                      <th className="p-3">Players</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {recentBookings.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-gray-500">No recent court bookings recorded.</td>
                      </tr>
                    ) : (
                      recentBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-800/30 transition">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-lime-400/10 text-lime-400 flex items-center justify-center text-xs">
                              {b.user?.name?.[0] || 'M'}
                            </span>
                            <div>
                              <div>{b.user?.name || 'Member'}</div>
                              <div className="text-[10px] text-gray-400 font-normal">{b.user?.phone || b.user?.email}</div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-300">
                            <span className="font-semibold text-white">{b.whichCourt?.replace('_', ' ')}</span>
                          </td>
                          <td className="p-3 font-mono text-gray-400">
                            {b.slot ? new Date(b.slot).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Scheduled'}
                          </td>
                          <td className="p-3 text-gray-400">{b.playerCount || 1} Player(s)</td>
                          <td className="p-3 font-mono font-bold text-lime-400">₹{Number(b.totalAmount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Activity Table: Food & Bar Orders */}
            {activityTab === 'orders' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Order Items</th>
                      <th className="p-3">Delivery Destination</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-gray-500">No recent cafe or bar orders recorded.</td>
                      </tr>
                    ) : (
                      recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-800/30 transition">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center text-xs">
                              {o.user?.name?.[0] || 'C'}
                            </span>
                            <div>
                              <div>{o.user?.name || 'Customer'}</div>
                              <div className="text-[10px] text-gray-400 font-normal">{o.orderNumber}</div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-300">
                            {Array.isArray(o.orderItems) ? o.orderItems.join(', ') : o.orderItems || 'Kitchen Items'}
                          </td>
                          <td className="p-3 text-gray-400">
                            {o.deliveryLocation === 'COURT' ? `Court #${o.courtNumber}` : o.deliveryLocation === 'TABLE' ? `Table #${o.tableNumber}` : 'Takeaway'}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-400">₹{Number(o.totalAmount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Activity Table: Pro Shop Purchases */}
            {activityTab === 'purchases' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Gear & Services</th>
                      <th className="p-3">Fulfillment</th>
                      <th className="p-3">Total Paid</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {recentPurchases.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-gray-500">No recent pro shop purchases recorded.</td>
                      </tr>
                    ) : (
                      recentPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-800/30 transition">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-emerald-400/10 text-emerald-400 flex items-center justify-center text-xs">
                              {p.user?.name?.[0] || 'S'}
                            </span>
                            <div>
                              <div>{p.user?.name || p.name || 'Member'}</div>
                              <div className="text-[10px] text-gray-400 font-normal">{p.phone || p.user?.email}</div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-300">
                            {Array.isArray(p.items) ? p.items.join(', ') : 'Sports Equipment'}
                          </td>
                          <td className="p-3 text-gray-400">
                            {p.pickupCode ? `Pickup PIN: ${p.pickupCode}` : p.fulfillmentType || 'Counter'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400">₹{Number(p.totalAmount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Activity Table: New Members */}
            {activityTab === 'members' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Tier</th>
                      <th className="p-3 text-right">Wallet Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {recentUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-gray-500">No recent member registrations recorded.</td>
                      </tr>
                    ) : (
                      recentUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-800/30 transition">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-400/10 text-blue-400 flex items-center justify-center text-xs">
                              {u.name?.[0] || 'U'}
                            </span>
                            {u.name}
                          </td>
                          <td className="p-3 text-gray-400">{u.email}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              u.membership === 'GOLD' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                              u.membership === 'SILVER' ? 'bg-slate-400/20 text-slate-300 border-slate-400/30' :
                              'bg-lime-400/20 text-lime-300 border-lime-400/30'
                            }`}>
                              {u.membership}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-lime-400">
                            ₹{Number(u.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dedicated Court Bookings Management & Live Facility Operations Section */}
          <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl mb-8">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
              <div>
                <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                  <i className="fa-solid fa-table-tennis-paddle-ball text-lime-400"></i>
                  Court Bookings Oversight & Facility Operations
                </h4>
                <p className="text-xs text-gray-400 mb-0">
                  Comprehensive audit of all court slots, member reservations, and booking revenue
                </p>
              </div>

              {/* Total & Filter Status Badges */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20 text-xs font-mono font-bold">
                  Total Bookings: {courtBookings.length}
                </span>
                <button
                  type="button"
                  onClick={() => loadDashboardData(period)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition"
                  title="Reload Bookings"
                >
                  <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
                </button>
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-2 bg-gray-900/60 rounded-xl border border-gray-800">
              {/* Sport Court Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400 font-semibold mr-1">Facility:</span>
                {['ALL', 'BADMINTON', 'TENNIS', 'CRICKET', 'PADEL_COURT'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourtFilter(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      courtFilter === c
                        ? 'bg-lime-400 text-black shadow-sm'
                        : 'text-gray-400 hover:text-white bg-gray-800/60'
                    }`}
                  >
                    {c === 'ALL' ? 'All Courts' : c.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Booking Status Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400 font-semibold mr-1">Status:</span>
                {['ALL', 'CONFIRMED', 'HELD', 'CANCELLED'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBookingStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      bookingStatusFilter === s
                        ? 'bg-lime-400 text-black shadow-sm'
                        : 'text-gray-400 hover:text-white bg-gray-800/60'
                    }`}
                  >
                    {s === 'ALL' ? 'All Status' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookings Full Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/80">
                  <tr>
                    <th className="p-3">Booking ID</th>
                    <th className="p-3">Player / Member</th>
                    <th className="p-3">Facility Court</th>
                    <th className="p-3">Slot Time Window</th>
                    <th className="p-3">Party Size</th>
                    <th className="p-3">Rate & Discount</th>
                    <th className="p-3">Total Charged</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredCourtBookings.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-6 text-center text-gray-500">
                        No court bookings matching current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCourtBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-800/30 transition">
                        <td className="p-3 font-mono text-gray-400">
                          #{b.id.slice(0, 8)}
                        </td>
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-lime-400/10 text-lime-400 flex items-center justify-center text-xs font-bold">
                            {b.user?.name?.[0] || 'M'}
                          </span>
                          <div>
                            <div>{b.user?.name || 'Club Member'}</div>
                            <div className="text-[10px] text-gray-400 font-mono font-normal">
                              {b.user?.phone || b.user?.email || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-800 text-white border border-gray-700 flex items-center gap-1.5 w-max">
                            <i className="fa-solid fa-table-tennis-paddle-ball text-lime-400 text-xs"></i>
                            {b.whichCourt?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-gray-300">
                          <div>
                            {b.slot ? new Date(b.slot).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </div>
                          <div className="text-[10px] text-lime-400">
                            {b.slot ? new Date(b.slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            {b.endTime ? ` - ${new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </div>
                        </td>
                        <td className="p-3 text-gray-300">
                          {b.playerCount || 1} Player(s)
                        </td>
                        <td className="p-3 font-mono text-gray-400">
                          ₹{Number(b.basePrice || 0).toLocaleString()}
                          {Number(b.discountPercentage || 0) > 0 && (
                            <span className="text-yellow-400 text-[10px] ml-1">
                              (-{Number(b.discountPercentage)}%)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-lime-400">
                          ₹{Number(b.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : b.status === 'HELD'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-Admin & Department Staff Management Table */}
          <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
              <div>
                <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                  <i className="fa-solid fa-user-shield text-lime-400"></i>
                  Sub-Admins & Module Assignments
                </h4>
                <p className="text-xs text-gray-400 mb-0">Control department managers (Bar, Shop, Front Desk, Ops)</p>
              </div>

              {/* Create Sub-Admin Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setModalError('');
                  setCreateModalOpen(true);
                }}
                className="py-2 px-3.5 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <i className="fa-solid fa-user-plus text-xs"></i>
                <span>Create Sub-Admin</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                  <tr>
                    <th className="p-3">Staff Name</th>
                    <th className="p-3">Email & Phone</th>
                    <th className="p-3">System Role</th>
                    <th className="p-3">Assigned Module</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {subAdmins.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-800/30 transition">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-lime-400/10 text-lime-400 flex items-center justify-center text-xs">
                          {staff.name?.[0] || 'S'}
                        </span>
                        {staff.name}
                      </td>
                      <td className="p-3 text-gray-400">
                        <div>{staff.email}</div>
                        <div className="text-[10px] text-gray-500">{staff.phone}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {staff.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          staff.designation === 'bar' || staff.designation === 'cafe'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : staff.designation === 'shop'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-lime-500/20 text-lime-300 border-lime-500/30'
                        }`}>
                          {staff.designation || 'front-desk'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setNewModule(staff.designation || 'front-desk');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-lime-400 border border-gray-700 transition"
                        >
                          Reassign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Sub-Admin Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A1D20] border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white text-base font-bold flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-lime-400"></i>
                Create New Sub-Admin
              </h4>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-white text-base"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Set up credentials and assign a department module for the new sub-admin.
            </p>

            {modalError && (
              <div className="p-3 mb-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-rose-400"></i>
                  <span className="font-semibold">{modalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError('')}
                  className="text-rose-400 hover:text-white text-base cursor-pointer px-1"
                >
                  &times;
                </button>
              </div>
            )}

            <form onSubmit={handleCreateSubAdmin} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={subAdminForm.name}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:border-lime-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Email Address (Login)</label>
                  <input
                    type="email"
                    required
                    value={subAdminForm.email}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, email: e.target.value })}
                    placeholder="e.g. rahul@smsclub.com"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:border-lime-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Phone Number (10 digits)</label>
                  <input
                    type="text"
                    required
                    value={subAdminForm.phone}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, phone: e.target.value })}
                    placeholder="e.g. 9810000999"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:border-lime-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Login Password</label>
                  <input
                    type="password"
                    required
                    value={subAdminForm.password}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, password: e.target.value })}
                    placeholder="Temporary password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:border-lime-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">System Role</label>
                  <select
                    value={subAdminForm.role}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, role: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                  >
                    <option value="SUBADMIN">Sub-Admin (Manager)</option>
                    <option value="STAFF">Staff Member</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Assigned Department</label>
                  <select
                    value={subAdminForm.module}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, module: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white focus:border-lime-400 focus:outline-none"
                  >
                    <option value="front-desk">Front Desk & Reception</option>
                    <option value="shop">Pro Shop & Gear</option>
                    <option value="bar">Bar, Lounge & Cafe</option>
                    <option value="operations">General Operations</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={subAdminForm.salary}
                    onChange={(e) => setSubAdminForm({ ...subAdminForm, salary: e.target.value })}
                    placeholder="35000"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:border-lime-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubAdmin}
                  className="py-2 px-5 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {creatingSubAdmin ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Create Sub-Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Module Reassignment Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A1D20] border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-white text-base font-bold mb-1">
              Reassign Module: {selectedStaff.name}
            </h4>
            <p className="text-xs text-gray-400 mb-4">
              Select which department portal this staff member directs to upon login.
            </p>

            <form onSubmit={handleReassignModule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Assigned Department</label>
                <select
                  value={newModule}
                  onChange={(e) => setNewModule(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="front-desk">Front Desk & Reception (/front-desk)</option>
                  <option value="shop">Pro Sports Shop & Gear (/shop-admin)</option>
                  <option value="bar">Bar, Lounge & Cafe (/bar-admin)</option>
                  <option value="operations">General Operations (/admin)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingModule}
                  className="py-2 px-4 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-xs transition cursor-pointer shadow-md"
                >
                  {updatingModule ? 'Saving...' : 'Update Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
