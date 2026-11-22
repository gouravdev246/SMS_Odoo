import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageBanner from '../components/common/PageBanner';
import ScrollReveal from '../components/common/ScrollReveal';
import { api } from '../services/api';

export default function AdminPage() {
  const [sportsPricing, setSportsPricing] = useState([]);
  const [crmOverview, setCrmOverview] = useState(null);
  const [coverageSummary, setCoverageSummary] = useState(null);
  const [frontDeskStats, setFrontDeskStats] = useState(null);
  const [recentCallLogs, setRecentCallLogs] = useState([]);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pricingRes, crmRes, coverageRes, walkinStatsRes, callsRes, dailyRes] = await Promise.all([
        api.sports.getPricing().catch(() => ({ pricing: [] })),
        api.crm.getOverview().catch(() => null),
        api.leaves.getCoverage().catch(() => null),
        api.walkins.getStats().catch(() => null),
        api.callLogs.getAll({ limit: 5 }).catch(() => null),
        api.dailyActivities.get().catch(() => null),
      ]);

      setSportsPricing(pricingRes.pricing || []);
      setCrmOverview(crmRes);
      setCoverageSummary(coverageRes);
      if (walkinStatsRes?.success) setFrontDeskStats(walkinStatsRes.data);
      if (callsRes?.success) setRecentCallLogs(callsRes.data || []);
      if (dailyRes?.success) setDailyData(dailyRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load club operations data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (!isMounted) return;
      loadAdminData();
    });
    return () => {
      isMounted = false;
    };
  }, [loadAdminData]);

  return (
    <main className="bg-[#0e0f0f] text-gray-100 min-h-screen">
      <PageBanner
        title="Club Admin Operations"
        current="Admin Console"
        bannerClass="banner-inner-booking"
      />

      <div className="section">
        <div className="hero-container">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <div className="sub-heading mb-1">
                <i className="fa-solid fa-circle accent-color-2"></i>
                <span className="sub-heading-title">General Administration</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-0">Club Facilities & Operations</h2>
            </div>
            <button
              onClick={loadAdminData}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-lime-400 hover:bg-gray-700 border border-gray-700 flex items-center gap-1.5"
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
              Refresh Operations
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs">
              {error}
            </div>
          )}

          {/* Quick Department Shortcuts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Link
              to="/front-desk"
              className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 hover:border-lime-500 transition group block"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Front Desk</span>
                <span className="w-8 h-8 rounded-xl bg-lime-400/10 text-lime-400 flex items-center justify-center text-sm group-hover:bg-lime-400 group-hover:text-black transition">
                  <i className="fa-solid fa-concierge-bell"></i>
                </span>
              </div>
              <div className="text-lg font-bold text-white mb-1">
                Reception & Walk-ins
              </div>
              <p className="text-xs text-gray-400 mb-2">
                Member 360 recognition, visitor log, and call logs
              </p>
              <div className="text-[11px] font-mono text-lime-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse"></span>
                <span>{frontDeskStats?.totalWalkins || 0} Registered Visitors • {dailyData?.summary?.totalActivities || 0} Activities Today</span>
              </div>
            </Link>

            <Link
              to="/shop-admin"
              className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 hover:border-emerald-500 transition group block"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pro Shop</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center text-sm group-hover:bg-emerald-400 group-hover:text-black transition">
                  <i className="fa-solid fa-store"></i>
                </span>
              </div>
              <div className="text-lg font-bold text-white mb-1">Gear & Stringing</div>
              <p className="text-xs text-gray-400 mb-0">Inventory replenishment, pickup PINs & stringing</p>
            </Link>

            <Link
              to="/bar-admin"
              className="p-4 rounded-2xl bg-[#1A1D20] border border-gray-800 hover:border-amber-500 transition group block"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bar & Cafe</span>
                <span className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center text-sm group-hover:bg-amber-400 group-hover:text-black transition">
                  <i className="fa-solid fa-beer-mug-empty"></i>
                </span>
              </div>
              <div className="text-lg font-bold text-white mb-1">Lounge Orders</div>
              <p className="text-xs text-gray-400 mb-0">Cafe order bills and menu items</p>
            </Link>
          </div>

          {/* Front Desk Management Real-Time Intelligence Section */}
          <ScrollReveal animation="fade-up">
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl mb-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                    <i className="fa-solid fa-concierge-bell text-lime-400"></i>
                    Front Desk Management & Reception
                  </h4>
                  <p className="text-xs text-gray-400 mb-0">Live visitor flow, member recognition stats, and phone call activity logs</p>
                </div>
                <Link
                  to="/front-desk"
                  className="px-3.5 py-1.5 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-xs transition flex items-center gap-1.5 shadow-md"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                  <span>Open Full Operations Console</span>
                </Link>
              </div>

              {/* Front Desk Key KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">Total Walk-ins</div>
                  <div className="text-2xl font-black font-mono text-lime-400">
                    {frontDeskStats?.totalWalkins ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500">Visitor check-ins logged</div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">Today's Activities</div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {dailyData?.summary?.totalActivities ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {dailyData?.summary?.checkinsCount ?? 0} check-ins • {dailyData?.summary?.callsCount ?? 0} calls
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">Visitor Memberships</div>
                  <div className="text-2xl font-black font-mono text-yellow-400">
                    {frontDeskStats?.byMembership?.GOLD ?? 0}G / {frontDeskStats?.byMembership?.SILVER ?? 0}S
                  </div>
                  <div className="text-[10px] text-gray-500">Tier converted walk-ins</div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">Active Phone Logs</div>
                  <div className="text-2xl font-black font-mono text-blue-400">
                    {recentCallLogs.length}
                  </div>
                  <div className="text-[10px] text-gray-500">Recent inquiries recorded</div>
                </div>
              </div>

              {/* Recent Call Inquiries Mini-Table */}
              <div className="border border-gray-800/80 rounded-xl overflow-hidden bg-gray-900/40">
                <div className="p-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-phone-volume text-lime-400"></i>
                    Recent Front Desk Phone Inquiries & Logs
                  </span>
                  <Link to="/front-desk" className="text-lime-400 hover:underline text-[11px]">View All in Console &rarr;</Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-900/60 border-b border-gray-800">
                      <tr>
                        <th className="p-2.5">Caller Name</th>
                        <th className="p-2.5">Phone Number</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Inquiry Purpose</th>
                        <th className="p-2.5 text-right">Logged Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/80">
                      {recentCallLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-3 text-center text-gray-500 text-xs">No recent call logs on record.</td>
                        </tr>
                      ) : (
                        recentCallLogs.slice(0, 4).map((c) => (
                          <tr key={c.id} className="hover:bg-gray-800/20">
                            <td className="p-2.5 font-bold text-white">{c.callerName}</td>
                            <td className="p-2.5 font-mono text-gray-300">{c.phone}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.callType === 'INCOMING' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {c.callType}
                              </span>
                            </td>
                            <td className="p-2.5 text-gray-300">{c.purpose}</td>
                            <td className="p-2.5 text-right font-mono text-gray-400 text-[11px]">
                              {c.callTime ? new Date(c.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Sports Pricing & Court Capacity Table */}
          <ScrollReveal animation="fade-up">
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-white text-base font-bold mb-0 flex items-center gap-2">
                    <i className="fa-solid fa-table-tennis-paddle-ball text-lime-400"></i>
                    Court Pricing & Operating Hours
                  </h4>
                  <p className="text-xs text-gray-400 mb-0">Standard rates, capacity limits, and tier discounts</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 bg-gray-900/40">
                    <tr>
                      <th className="p-3">Sport Facility</th>
                      <th className="p-3">Base Rate</th>
                      <th className="p-3">Court Capacity</th>
                      <th className="p-3">Gold Disc.</th>
                      <th className="p-3">Silver Disc.</th>
                      <th className="p-3">Junior Disc.</th>
                      <th className="p-3">Operating Window</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sportsPricing.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-800/30 transition">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-lime-400"></span>
                          {item.sport.replace('_', ' ')}
                        </td>
                        <td className="p-3 font-mono font-bold text-lime-400">₹{item.basePrice}/hr</td>
                        <td className="p-3">{item.capacity} Players max</td>
                        <td className="p-3 text-yellow-400 font-mono font-semibold">{item.goldDiscount}%</td>
                        <td className="p-3 text-slate-300 font-mono font-semibold">{item.silverDiscount}%</td>
                        <td className="p-3 text-lime-300 font-mono font-semibold">{item.juniorDiscount}%</td>
                        <td className="p-3 font-mono text-gray-400">{item.openTime} - {item.closeTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>

          {/* CRM & Staff Operational Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CRM Inquiries Card */}
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl">
              <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-funnel-dollar text-lime-400"></i>
                CRM Leads Pipeline
              </h4>
              <p className="text-xs text-gray-400 mb-4">Prospective member conversion overview</p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider">New Leads</div>
                  <div className="text-xl font-bold font-mono text-lime-400">
                    {crmOverview?.pipelineCounts?.NEW || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider">Quotes Sent</div>
                  <div className="text-xl font-bold font-mono text-blue-400">
                    {crmOverview?.pipelineCounts?.QUOTE_SENT || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider">Trial Sessions</div>
                  <div className="text-xl font-bold font-mono text-amber-400">
                    {crmOverview?.totalTrialsRequested || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider">Converted Members</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {crmOverview?.pipelineCounts?.CONVERTED || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Shift & Staff Coverage Card */}
            <div className="p-5 rounded-2xl bg-[#1A1D20] border border-gray-800 shadow-xl">
              <h4 className="text-white text-base font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-user-clock text-lime-400"></i>
                Shift & Leave Coverage
              </h4>
              <p className="text-xs text-gray-400 mb-4">Current shift roster coverage analysis</p>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-gray-300 font-semibold">Staff on Active Leave:</span>
                  <span className="font-mono font-bold text-amber-400">{coverageSummary?.activeLeavesCount || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-gray-300 font-semibold">Shifts Needing Coverage:</span>
                  <span className="font-mono font-bold text-rose-400">{coverageSummary?.shiftsNeedingCoverageCount || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-gray-300 font-semibold">Total Shifts Scheduled:</span>
                  <span className="font-mono font-bold text-emerald-400">{coverageSummary?.totalShifts || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
