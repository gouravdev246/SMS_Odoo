import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

export default function Member360Tab({ showAlert }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [member360Data, setMember360Data] = useState(null);
  const [loading360, setLoading360] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [historySubTab, setHistorySubTab] = useState('bookings'); // 'bookings', 'shop', 'cafe', 'stringing'

  // Load detailed 360 profile for a selected member
  const loadMember360 = useCallback(async (memberId) => {
    setLoading360(true);
    setMember360Data(null);
    try {
      const res = await api.member360.getHistory(memberId);
      // res is { profile, entitlements, summary, history }
      setMember360Data(res);
      setSelectedMember(res.profile);
    } catch (err) {
      if (showAlert) showAlert('error', err.message || 'Failed to load member 360 profile');
    } finally {
      setLoading360(false);
    }
  }, [showAlert]);

  // Search members by name, phone, or email
  const handleSearch = useCallback(async (query, autoSelectFirst = false) => {
    setSearching(true);
    try {
      const res = await api.member360.search(query || '');
      // res could be { members: [...] } or direct array
      const list = res.members || res.data || (Array.isArray(res) ? res : []);
      setSearchResults(list);
      if (autoSelectFirst && list.length > 0 && !selectedMember) {
        loadMember360(list[0].id);
      }
    } catch (err) {
      if (showAlert) showAlert('error', err.message || 'Failed to search members');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [showAlert, selectedMember, loadMember360]);

  // Initial load: fetch recent members and load first member's 360 data
  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      handleSearch('', true);
    });
    return () => {
      isMounted = false;
    };
  }, [handleSearch]);

  // 1-Click Check-In Handler
  const handleCheckIn = async (memberId) => {
    setCheckingIn(true);
    try {
      const res = await api.member360.checkin(memberId, 'Front desk 1-touch check-in');
      if (showAlert) {
        showAlert('success', res.message || 'Member checked in successfully!');
      }
      // Refresh member profile so lastEntry updates
      loadMember360(memberId);
      // Also refresh search list
      handleSearch(searchQuery);
    } catch (err) {
      if (showAlert) showAlert('error', err.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Rapid Recognition Bar */}
      <div className="bg-[#161616] p-5 rounded-2xl border border-gray-800 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div>
            <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
              <i className="fa-solid fa-address-card text-lime-400"></i>
              Front Desk Member 360 Recognition (Scene 1)
            </h4>
            <p className="text-xs text-gray-400 mb-0">
              Instant member identification by phone, email, or name with full cross-module history.
            </p>
          </div>
          <span className="text-xs text-lime-400 bg-lime-400/10 px-3 py-1 rounded-full font-mono font-semibold border border-lime-400/20">
            Rapid Check-in Active
          </span>
        </div>

        {/* Search Bar Input */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input
              type="text"
              placeholder="Search by phone (e.g. 9876543210), name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch(searchQuery);
              }}
              className="w-full bg-[#111111] border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 transition"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch(searchQuery)}
            disabled={searching}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#C6EF2E] text-black hover:bg-lime-400 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {searching ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-search"></i>
            )}
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleSearch('');
              }}
              className="px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white bg-[#222222] border border-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* Live Search Results Chips */}
        {searchResults.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-800/80">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Recognized Member Records ({searchResults.length}):
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
              {searchResults.map((m) => {
                const isSelected = selectedMember?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => loadMember360(m.id)}
                    className={`px-3 py-2 rounded-xl text-left border transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-lime-400 bg-lime-400/15 shadow-sm text-white'
                        : 'border-gray-800 bg-[#1e1e1e] hover:border-gray-700 text-gray-300'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full bg-lime-400/10 text-lime-400 flex items-center justify-center font-bold text-xs">
                      {m.name?.[0] || 'M'}
                    </span>
                    <div>
                      <div className="text-xs font-bold leading-tight">{m.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {m.phone} • {m.membership}
                      </div>
                    </div>
                    {m.status === 'EXPIRING_SOON' && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Expiring Soon"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading360 && (
        <div className="p-12 text-center text-gray-400 bg-[#161616] rounded-2xl border border-gray-800">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-lime-400"></i>
          <div className="text-xs">Aggregating cross-module Member 360 profile & history...</div>
        </div>
      )}

      {/* Member 360 Full Profile Card */}
      {member360Data && !loading360 && (
        <div className="space-y-6">
          {/* Hero Identification & 1-Click Checkin Card */}
          <div className="p-6 rounded-2xl bg-[#161616] border border-gray-800 shadow-xl relative overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Member Details */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lime-400/20 to-lime-500/5 border border-lime-400/40 text-lime-400 flex items-center justify-center text-2xl font-black">
                  {member360Data.profile?.name?.[0] || 'M'}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-white mb-0">
                      {member360Data.profile?.name}
                    </h3>
                    {/* Membership Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      member360Data.profile?.membership === 'GOLD'
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                        : member360Data.profile?.membership === 'SILVER'
                        ? 'bg-slate-400/20 text-slate-300 border-slate-400/40'
                        : 'bg-lime-500/20 text-lime-300 border-lime-500/40'
                    }`}>
                      {member360Data.profile?.membership} MEMBER
                    </span>
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      member360Data.profile?.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : member360Data.profile?.status === 'EXPIRING_SOON'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}>
                      {member360Data.profile?.status === 'EXPIRING_SOON'
                        ? `EXPIRING (${member360Data.profile?.daysUntilExpiry}d left)`
                        : member360Data.profile?.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-phone text-lime-400"></i>
                      {member360Data.profile?.phone}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-envelope text-lime-400"></i>
                      {member360Data.profile?.email}
                    </span>
                    <span>•</span>
                    <span className="text-gray-400">
                      Renewal: {member360Data.profile?.renewalDate ? new Date(member360Data.profile.renewalDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: 1-Click Checkin & Virtual Card Balance */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                <div className="p-3 rounded-xl bg-[#111111] border border-gray-700/80 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Virtual Card Wallet</div>
                  <div className="text-xl font-bold font-mono text-lime-400">
                    ₹{Number(member360Data.profile?.walletBalance || 0).toLocaleString()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCheckIn(member360Data.profile.id)}
                  disabled={checkingIn}
                  className="px-5 py-3 rounded-xl font-bold text-xs bg-[#C6EF2E] text-black hover:bg-lime-400 transition flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <i className={`fa-solid ${checkingIn ? 'fa-spinner fa-spin' : 'fa-door-open'}`}></i>
                  <span>{checkingIn ? 'Checking In...' : '1-Click Check-In'}</span>
                </button>
              </div>
            </div>

            {/* Last Entry Info */}
            <div className="mt-4 pt-3 border-t border-gray-800 text-[11px] text-gray-400 flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left text-lime-400"></i>
              <span>Last Club Entrance:</span>
              <strong className="text-gray-200">
                {member360Data.profile?.lastEntry
                  ? new Date(member360Data.profile.lastEntry).toLocaleString()
                  : 'No check-ins recorded yet'}
              </strong>
            </div>
          </div>

          {/* Active Plan Entitlements & Privileges Grid */}
          <div className="p-5 rounded-2xl bg-[#161616] border border-gray-800 shadow-xl">
            <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-lime-400"></i>
              Active Plan Entitlements & Privileges
            </h4>
            <p className="text-xs text-gray-400 mb-4">
              Discounts and booking allowances automatically applied to this member.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div className="p-3 rounded-xl bg-[#111111] border border-gray-800">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Court Booking Disc.</div>
                <div className="text-lg font-bold font-mono text-lime-400">
                  {member360Data.entitlements?.courtDiscountPercent || 0}% OFF
                </div>
                <div className="text-[10px] text-gray-500">All 4 sports facilities</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111111] border border-gray-800">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Pro Shop Disc.</div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {member360Data.entitlements?.shopDiscountPercent || 0}% OFF
                </div>
                <div className="text-[10px] text-gray-500">Gear, rackets & apparel</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111111] border border-gray-800">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Cafe & Bar Disc.</div>
                <div className="text-lg font-bold font-mono text-amber-400">
                  {member360Data.entitlements?.cafeDiscountPercent || 0}% OFF
                </div>
                <div className="text-[10px] text-gray-500">Food & beverage tabs</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111111] border border-gray-800">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Daily Booking Limit</div>
                <div className="text-lg font-bold font-mono text-blue-400">
                  {member360Data.entitlements?.dailyBookingLimit || 2} Courts/Day
                </div>
                <div className="text-[10px] text-gray-500">Standard member cap</div>
              </div>
            </div>

            {/* Privileges Notes */}
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-xs text-gray-300 space-y-1">
              <div><strong>Courts:</strong> {member360Data.entitlements?.courtPrivileges}</div>
              <div><strong>Shop:</strong> {member360Data.entitlements?.shopPrivileges}</div>
              <div><strong>Cafe:</strong> {member360Data.entitlements?.cafePrivileges}</div>
            </div>
          </div>

          {/* Lifetime Spend & KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#161616] border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total Lifetime Spent</span>
              <span className="text-lg font-bold font-mono text-lime-400 block mt-1">
                ₹{member360Data.summary?.totalLifetimeSpent?.toLocaleString() || 0}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#161616] border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Confirmed Bookings</span>
              <span className="text-lg font-bold font-mono text-white block mt-1">
                {member360Data.summary?.confirmedBookingsCount || 0} (₹{member360Data.summary?.totalBookingsSpent || 0})
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#161616] border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Shop Purchases</span>
              <span className="text-lg font-bold font-mono text-emerald-400 block mt-1">
                {member360Data.summary?.totalShopPurchasesCount || 0} (₹{member360Data.summary?.totalShopSpent || 0})
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#161616] border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Cafe & Bar Orders</span>
              <span className="text-lg font-bold font-mono text-amber-400 block mt-1">
                {member360Data.summary?.totalCafeOrdersCount || 0} (₹{member360Data.summary?.totalCafeSpent || 0})
              </span>
            </div>
          </div>

          {/* Cross-Module History Sections */}
          <div className="p-5 rounded-2xl bg-[#161616] border border-gray-800 shadow-xl">
            {/* History Sub-tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-800">
              <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-lime-400"></i>
                Cross-Module Activity History
              </h4>

              <div className="flex gap-1.5 p-1 bg-gray-900 rounded-xl border border-gray-800 text-xs">
                <button
                  type="button"
                  onClick={() => setHistorySubTab('bookings')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    historySubTab === 'bookings'
                      ? 'bg-lime-400 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Courts ({member360Data.history?.sportsBookings?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySubTab('shop')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    historySubTab === 'shop'
                      ? 'bg-lime-400 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Pro Shop ({member360Data.history?.shopPurchases?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorySubTab('cafe')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    historySubTab === 'cafe'
                      ? 'bg-lime-400 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Cafe Orders ({member360Data.history?.cafeOrders?.length || 0})
                </button>
              </div>
            </div>

            {/* Sub-tab 1: Sports Bookings */}
            {historySubTab === 'bookings' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Sport Court</th>
                      <th className="p-3">Slot Date & Time</th>
                      <th className="p-3">Players</th>
                      <th className="p-3">Disc. Applied</th>
                      <th className="p-3">Amount Paid</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(member360Data.history?.sportsBookings || []).map((b) => (
                      <tr key={b.id} className="hover:bg-gray-800/30 transition">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-lime-400"></span>
                          {b.sport?.replace('_', ' ')}
                        </td>
                        <td className="p-3 font-mono text-gray-400">
                          {b.slot ? new Date(b.slot).toLocaleString() : '—'}
                        </td>
                        <td className="p-3">{b.playerCount}p</td>
                        <td className="p-3 text-emerald-400 font-mono font-semibold">
                          {b.discountPercentage}%
                        </td>
                        <td className="p-3 font-mono font-bold text-white">₹{b.totalAmount}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(member360Data.history?.sportsBookings || []).length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-gray-500">
                          No court bookings on record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub-tab 2: Shop Purchases */}
            {historySubTab === 'shop' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Purchase Date</th>
                      <th className="p-3">Items Purchased</th>
                      <th className="p-3">Pickup PIN</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(member360Data.history?.shopPurchases || []).map((o) => (
                      <tr key={o.id} className="hover:bg-gray-800/30 transition">
                        <td className="p-3 font-mono text-gray-400">#{o.id.slice(0, 8)}</td>
                        <td className="p-3 text-gray-400">
                          {o.purchaseDate ? new Date(o.purchaseDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-3 text-gray-300">
                          {(o.orderItems || []).map((item) => (
                            <div key={item.id}>
                              {item.product?.name} (x{item.quantity})
                            </div>
                          ))}
                        </td>
                        <td className="p-3 font-mono font-bold text-lime-400">
                          {o.pickupCode || '—'}
                        </td>
                        <td className="p-3 font-mono font-bold text-white">₹{o.totalAmount}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(member360Data.history?.shopPurchases || []).length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-gray-500">
                          No sports shop purchases on record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub-tab 3: Cafe Orders */}
            {historySubTab === 'cafe' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Order Amount</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(member360Data.history?.cafeOrders || []).map((c) => (
                      <tr key={c.id} className="hover:bg-gray-800/30 transition">
                        <td className="p-3 font-mono text-gray-400">#{c.id.slice(0, 8)}</td>
                        <td className="p-3 text-gray-400">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-3 font-mono font-bold text-white">₹{c.totalAmount || c.price || 0}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {c.status || 'SERVED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(member360Data.history?.cafeOrders || []).length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-gray-500">
                          No cafe orders on record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback Member Directory Table when no specific member profile is selected */}
      {!member360Data && !loading360 && (
        <div className="p-6 rounded-2xl bg-[#161616] border border-gray-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                <i className="fa-solid fa-users text-lime-400"></i>
                Club Members Directory ({searchResults.length})
              </h4>
              <p className="text-xs text-gray-400 mb-0">Select any member below to review their full cross-module 360 profile, history & entitlements.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-[#111111]">
                <tr>
                  <th className="p-3">Member</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Membership Tier</th>
                  <th className="p-3">Wallet Balance</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {searchResults.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-gray-500">
                      No member records found. Try searching by phone, name, or email above.
                    </td>
                  </tr>
                ) : (
                  searchResults.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-800/30 transition">
                      <td className="p-3 font-bold text-white flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-lime-400/10 text-lime-400 flex items-center justify-center font-bold text-xs">
                          {m.name?.[0] || 'M'}
                        </span>
                        <div>
                          <div>{m.name}</div>
                          <div className="text-[10px] text-gray-500 font-normal">ID: {m.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-gray-300">{m.phone}</td>
                      <td className="p-3 text-gray-400">{m.email}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          m.membership === 'GOLD'
                            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                            : m.membership === 'SILVER'
                            ? 'bg-slate-400/20 text-slate-300 border-slate-400/30'
                            : 'bg-lime-500/20 text-lime-300 border-lime-500/30'
                        }`}>
                          {m.membership}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-lime-400">
                        ₹{Number(m.amount || m.walletBalance || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => loadMember360(m.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C6EF2E] text-black hover:bg-lime-400 transition cursor-pointer"
                        >
                          View 360 Profile
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
