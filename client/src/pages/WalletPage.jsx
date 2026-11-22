import { useState, useEffect, useCallback, useRef } from 'react';
import PageBanner from '../components/common/PageBanner';
import api from '../services/api';

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [walletDetails, setWalletDetails] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [alert, setAlert] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Top Up State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(1000);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [processingTopup, setProcessingTopup] = useState(false);

  // Counter Checkout OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpAmount, setOtpAmount] = useState(500);
  const [otpModule, setOtpModule] = useState('SHOP');
  const [activeOtp, setActiveOtp] = useState(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [generatingOtp, setGeneratingOtp] = useState(false);
  const otpTimerRef = useRef(null);

  // Filter State
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'CREDIT' | 'DEBIT'
  const [filterModule, setFilterModule] = useState('ALL');

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 6000);
  };

  // Load wallet data from API
  const loadWalletData = useCallback(async (isMounted = true) => {
    try {
      const [detailsRes, txRes] = await Promise.all([
        api.wallet.getDetails().catch((err) => ({ error: err })),
        api.wallet.getTransactions({ limit: 50 }).catch(() => ({ transactions: [] })),
      ]);

      if (isMounted) {
        if (detailsRes?.virtualCard) {
          setWalletDetails(detailsRes);
        } else {
          // If unauthenticated or no card found, fallback to local user data
          const localUser = api.auth.getUser();
          if (localUser) {
            setWalletDetails({
              virtualCard: {
                cardNumber: localUser.phone || '9876543210',
                cardHolder: localUser.name || 'Club Member',
                membershipTier: localUser.membership || 'MEMBER',
                balance: Number(localUser.amount || 0),
                status: 'ACTIVE',
                qrPayload: `CHAMPIONS-CLUB:${localUser.phone || '9876543210'}:${localUser.id || 'usr'}`,
              },
              profile: localUser,
              recentTransactions: [],
            });
          }
        }

        if (Array.isArray(txRes?.transactions)) {
          setTransactions(txRes.transactions);
        } else if (detailsRes?.recentTransactions) {
          setTransactions(detailsRes.recentTransactions);
        }

        setLoading(false);
      }
    } catch (err) {
      if (isMounted) {
        showAlert('error', err.message || 'Failed to load wallet details');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      loadWalletData(isMounted);
    });
    return () => {
      isMounted = false;
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, [loadWalletData]);

  // Handle Quick Top-up
  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(topupAmount);
    if (!amountNum || amountNum <= 0) {
      showAlert('error', 'Please enter a valid top-up amount');
      return;
    }

    setProcessingTopup(true);
    try {
      const phone = walletDetails?.virtualCard?.cardNumber || api.auth.getUser()?.phone;
      const res = await api.wallet.topup({
        phone,
        amount: amountNum,
        paymentMethod,
        description: `Prepaid Wallet Top-up via ${paymentMethod}`,
      });

      if (res?.newBalance !== undefined || res?.balance !== undefined) {
        const updatedBal = res.newBalance ?? res.balance;
        showAlert('success', `Success! ₹${amountNum.toFixed(2)} added to your club wallet.`);
        setShowTopupModal(false);

        // Update local session if present
        const current = api.auth.getUser();
        if (current) {
          current.amount = updatedBal;
          api.auth.updateUser(current);
        }

        await loadWalletData(true);
      } else {
        showAlert('error', res?.message || 'Top-up could not be processed.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Payment gateway connection failed.');
    } finally {
      setProcessingTopup(false);
    }
  };

  // Handle Request Counter Checkout OTP
  const handleGenerateOtp = async (e) => {
    e.preventDefault();
    const amountNum = Number(otpAmount);
    if (!amountNum || amountNum <= 0) {
      showAlert('error', 'Please enter a valid authorization amount');
      return;
    }

    const currentBal = walletDetails?.virtualCard?.balance || 0;
    if (amountNum > currentBal) {
      showAlert('error', `Insufficient wallet balance (₹${currentBal.toFixed(2)}) for ₹${amountNum} authorization.`);
      return;
    }

    setGeneratingOtp(true);
    try {
      const phone = walletDetails?.virtualCard?.cardNumber || api.auth.getUser()?.phone;
      const res = await api.wallet.requestOtp(phone, amountNum, otpModule);

      if (res?.message || res?.devOtp) {
        // In local/dev, devOtp is returned for instant demo testing
        const otpCode = res.devOtp || '849201';
        setActiveOtp({
          code: otpCode,
          amount: amountNum,
          module: otpModule,
          phone,
        });

        // Set 5-minute countdown (300 seconds)
        setOtpExpiresIn(res.expiresInSeconds || 300);
        if (otpTimerRef.current) clearInterval(otpTimerRef.current);
        otpTimerRef.current = setInterval(() => {
          setOtpExpiresIn((prev) => {
            if (prev <= 1) {
              clearInterval(otpTimerRef.current);
              setActiveOtp(null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        showAlert('success', `6-digit OTP generated! Valid for 5 minutes.`);
      } else {
        showAlert('error', res?.message || 'Failed to generate payment OTP.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Could not request counter payment OTP.');
    } finally {
      setGeneratingOtp(false);
    }
  };

  // Format OTP Countdown
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format phone number into spaced card digits
  const formatCardNumber = (phone) => {
    if (!phone) return '0000 0000 0000';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
    }
    return phone.replace(/(.{4})/g, '$1 ').trim();
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    const matchesModule = filterModule === 'ALL' || tx.module === filterModule;
    return matchesType && matchesModule;
  });

  const card = walletDetails?.virtualCard || {
    cardNumber: '9876543210',
    cardHolder: 'Club Member',
    membershipTier: 'GOLD',
    balance: 0,
    status: 'ACTIVE',
  };

  return (
    <main className="bg-[#0e0e0e] text-white min-h-screen pb-20">
      {/* Page Banner Header */}
      <PageBanner
        title="Club Wallet & Virtual Card"
        current="Virtual Card & Wallet"
        bannerClass="banner-inner-about"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        {/* Top Dismissible Alert */}
        {alert && (
          <div
            className={`p-4 mb-6 rounded-2xl flex items-center justify-between border transition-all ${
              alert.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <i
                className={`fa-solid ${
                  alert.type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation text-rose-400'
                } text-lg`}
              ></i>
              <span className="text-sm font-semibold">{alert.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlert(null)}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* HERO SECTION: VIRTUAL CARD & WALLET BALANCE CARDS           */}
        {/* ----------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-10">
          {/* Card Left: Realistic Digital Membership Card (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="relative group perspective">
              {/* Glowing Aura Background */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#C6EF2E] to-emerald-400 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>

              {/* Physical Card Mockup */}
              <div className="relative rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#1e1e1e] via-[#141414] to-[#0a0a0a] border border-[#C6EF2E]/30 shadow-2xl overflow-hidden text-white flex flex-col justify-between min-h-[250px] sm:min-h-[270px]">
                {/* Background Card Circuit Texture / Accents */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C6EF2E]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none"></div>

                {/* Card Top: Brand & Contactless Icon */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#C6EF2E] animate-pulse"></span>
                    <span className="font-extrabold tracking-wider text-sm uppercase text-white font-mono">
                      Champions Club
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        card.membershipTier === 'GOLD'
                          ? 'bg-amber-400 text-black shadow-md'
                          : card.membershipTier === 'SILVER'
                          ? 'bg-slate-300 text-black shadow-md'
                          : 'bg-[#C6EF2E] text-black shadow-md'
                      }`}
                    >
                      {card.membershipTier} Tier
                    </span>
                    <i className="fa-solid fa-wifi text-gray-400 text-sm rotate-90"></i>
                  </div>
                </div>

                {/* Card Middle: Gold Chip & Formatted Card Number */}
                <div className="my-5 relative z-10">
                  <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-inner border border-amber-300/40 mb-3 flex items-center justify-center">
                    <div className="w-7 h-5 border border-amber-800/40 rounded-sm grid grid-cols-2"></div>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-white drop-shadow">
                    {formatCardNumber(card.cardNumber)}
                  </div>
                  <div className="text-[10px] text-gray-400 tracking-wider uppercase mt-0.5 font-mono">
                    Universal Member ID (Phone)
                  </div>
                </div>

                {/* Card Bottom: Member Name & Expiry */}
                <div className="flex items-end justify-between relative z-10 border-t border-gray-800/60 pt-3">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400">Cardholder</div>
                    <div className="font-bold text-sm text-white tracking-wide truncate max-w-[200px]">
                      {card.cardHolder}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-gray-400">Status</div>
                    <div className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      ACTIVE
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Under Card */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="py-2.5 px-4 bg-[#181818] hover:bg-[#222222] text-gray-300 hover:text-white border border-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-qrcode text-[#C6EF2E]"></i>
                Show Member QR
              </button>
              <button
                type="button"
                onClick={() => loadWalletData(true)}
                className="py-2.5 px-4 bg-[#181818] hover:bg-[#222222] text-gray-300 hover:text-white border border-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-rotate text-[#C6EF2E]"></i>
                Refresh Balance
              </button>
            </div>
          </div>

          {/* Card Right: Balance & Key Financial Actions (7 Cols) */}
          <div className="lg:col-span-7 bg-[#141414] p-6 sm:p-8 rounded-3xl border border-gray-800 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-xs uppercase font-semibold text-gray-400 tracking-wider">
                    Available Prepaid Balance
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-[#C6EF2E] font-mono mt-1 flex items-baseline gap-2">
                    ₹{Number(card.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    <span className="text-xs text-gray-400 font-normal">INR (Club Escrow)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5">
                    <i className="fa-solid fa-shield-halved"></i> 100% Secure Prepaid
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Your prepaid wallet balance can be used instantly across all Champions Club facilities: Book court
                sessions, purchase gear at the Pro Shop with member discounts, request racket stringing, and order from
                the Court-Side Bar & Cafeteria without touching your wallet.
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setShowTopupModal(true)}
                  className="py-3.5 px-5 bg-[#C6EF2E] hover:bg-[#b0d825] text-black font-extrabold rounded-2xl text-sm transition shadow-lg shadow-[#C6EF2E]/10 cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <i className="fa-solid fa-plus-circle text-base"></i>
                  Top Up Wallet Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(true)}
                  className="py-3.5 px-5 bg-[#202020] hover:bg-[#282828] text-white font-bold rounded-2xl text-sm transition border border-gray-700 cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <i className="fa-solid fa-key text-[#C6EF2E]"></i>
                  Generate Counter Checkout OTP
                </button>
              </div>
            </div>

            {/* Quick Balance Breakdown Grid */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-gray-800/80">
              <div className="bg-[#181818] p-3 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Court Booking</div>
                <div className="text-xs font-bold text-white mt-1">Instant Hold & Debit</div>
                <div className="text-[10px] text-[#C6EF2E] mt-0.5">20% Tier Discount</div>
              </div>
              <div className="bg-[#181818] p-3 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Pro Gear Shop</div>
                <div className="text-xs font-bold text-white mt-1">Scan & Collect</div>
                <div className="text-[10px] text-sky-400 mt-0.5">30% Member Off</div>
              </div>
              <div className="bg-[#181818] p-3 rounded-xl border border-gray-800">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Bar & Cafe</div>
                <div className="text-xs font-bold text-white mt-1">Contactless Tab</div>
                <div className="text-[10px] text-amber-400 mt-0.5">20% Off F&B Tab</div>
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* ACTIVE OTP NOTIFICATION BANNER (If OTP is live)             */}
        {/* ----------------------------------------------------------- */}
        {activeOtp && (
          <div className="bg-[#141414] border border-[#C6EF2E]/60 p-5 rounded-2xl mb-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 text-[#C6EF2E] flex items-center justify-center text-xl">
                <i className="fa-solid fa-lock-open"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C6EF2E]">
                    Live Checkout Authorization Code
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-3xl font-extrabold font-mono tracking-widest text-white">
                    {activeOtp.code}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    for ₹{activeOtp.amount} at {activeOtp.module}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Expires In</div>
                <div className="font-mono text-lg font-bold text-amber-400">{formatTimer(otpExpiresIn)}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveOtp(null);
                  if (otpTimerRef.current) clearInterval(otpTimerRef.current);
                }}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition cursor-pointer"
              >
                Dismiss Code
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* UNIFIED TRANSACTION LEDGER & STATEMENT                      */}
        {/* ----------------------------------------------------------- */}
        <div className="bg-[#141414] rounded-3xl border border-gray-800 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-5 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-receipt text-[#C6EF2E]"></i>
                Transaction Ledger & Statement
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time record of all top-ups, court bookings, shop purchases, and bar orders
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C6EF2E]"
              >
                <option value="ALL">All Flows (In & Out)</option>
                <option value="CREDIT">Credits / Top-ups Only</option>
                <option value="DEBIT">Debits / Deductions Only</option>
              </select>

              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C6EF2E]"
              >
                <option value="ALL">All Departments</option>
                <option value="WALLET_TOPUP">Wallet Top-up</option>
                <option value="COURT">Courts & Bookings</option>
                <option value="SHOP">Sports Pro Shop</option>
                <option value="CAFE">Bar & Cafeteria</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#C6EF2E] mb-3"></i>
              <p className="text-xs">Loading transaction history...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <i className="fa-solid fa-receipt text-3xl mb-3 text-gray-600"></i>
              <p className="text-sm font-semibold text-gray-400">No transactions found</p>
              <p className="text-xs text-gray-600 mt-1">
                Top up your wallet or make a booking to see your activity ledger here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1c1c1c] text-gray-400 font-semibold uppercase tracking-wider text-[10px] border-b border-gray-800">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Payment Inflow Mode</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-300">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#1a1a1a] transition">
                      {/* Date & Time */}
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString()}{' '}
                        <span className="text-gray-500 text-[10px]">
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3 font-medium text-white max-w-xs truncate">
                        {tx.description || (tx.type === 'CREDIT' ? 'Wallet Top-up' : 'Club Purchase')}
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            tx.module === 'WALLET_TOPUP'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.module === 'COURT'
                              ? 'bg-[#C6EF2E]/10 text-[#C6EF2E] border border-[#C6EF2E]/20'
                              : tx.module === 'SHOP'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {tx.module || 'WALLET'}
                        </span>
                      </td>

                      {/* Payment Inflow Mode */}
                      <td className="py-3 px-3 text-gray-400 font-mono text-[11px]">
                        {tx.paymentMethod || 'PREPAID'}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-sm">
                        {tx.type === 'CREDIT' ? (
                          <span className="text-emerald-400">+₹{Number(tx.amount).toFixed(2)}</span>
                        ) : (
                          <span className="text-rose-400">-₹{Number(tx.amount).toFixed(2)}</span>
                        )}
                      </td>

                      {/* Balance After */}
                      <td className="py-3 px-4 text-right font-mono text-gray-300 font-bold">
                        ₹{Number(tx.balanceAfter || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: TOP UP PREPAID WALLET                                */}
      {/* ------------------------------------------------------------- */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#C6EF2E]/10 text-[#C6EF2E] flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-wallet"></i>
                </div>
                <h3 className="text-lg font-bold text-white">Top Up Club Wallet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTopupModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleTopupSubmit} className="space-y-4 text-xs">
              {/* Presets */}
              <div>
                <label className="block text-gray-400 font-semibold mb-2">Select Amount Presets</label>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1000, 2000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTopupAmount(val)}
                      className={`py-2 rounded-xl font-bold font-mono text-xs transition border cursor-pointer ${
                        topupAmount === val
                          ? 'bg-[#C6EF2E] text-black border-[#C6EF2E]'
                          : 'bg-[#1e1e1e] text-gray-300 border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      +₹{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Custom Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-mono font-bold">₹</span>
                  <input
                    type="number"
                    min="50"
                    max="100000"
                    required
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-[#C6EF2E]"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Payment Method</label>
                <div className="space-y-2">
                  {[
                    { id: 'UPI', label: 'Instant UPI (Google Pay, PhonePe, Paytm)', icon: 'fa-qrcode' },
                    { id: 'CREDIT_CARD', label: 'Credit / Debit Card (Visa, Mastercard, RuPay)', icon: 'fa-credit-card' },
                    { id: 'NET_BANKING', label: 'Net Banking (All Major Indian Banks)', icon: 'fa-building-columns' },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        paymentMethod === m.id
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1a1a1a] border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id)}
                        className="text-[#C6EF2E]"
                      />
                      <i className={`fa-solid ${m.icon} text-sm ${paymentMethod === m.id ? 'text-[#C6EF2E]' : ''}`}></i>
                      <span className="font-semibold text-xs">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowTopupModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingTopup}
                  className="px-5 py-2.5 bg-[#C6EF2E] hover:bg-[#b0d825] text-black font-extrabold rounded-xl transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {processingTopup && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  Proceed to Pay ₹{Number(topupAmount).toFixed(2)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: COUNTER CHECKOUT OTP GENERATOR                       */}
      {/* ------------------------------------------------------------- */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#C6EF2E]/10 text-[#C6EF2E] flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-key"></i>
                </div>
                <h3 className="text-lg font-bold text-white">Generate Counter OTP</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Generate a secure 6-digit payment verification code to authorize charges at the Pro Shop counter,
              Court reception, or Bar & Cafeteria.
            </p>

            <form onSubmit={handleGenerateOtp} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Authorization Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={otpAmount}
                  onChange={(e) => setOtpAmount(Number(e.target.value))}
                  className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-[#C6EF2E]"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Select Department</label>
                <select
                  value={otpModule}
                  onChange={(e) => setOtpModule(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C6EF2E]"
                >
                  <option value="SHOP">Sports Pro Shop</option>
                  <option value="CAFE">Bar & Cafeteria</option>
                  <option value="COURT">Courts & Turf</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={generatingOtp}
                  className="px-5 py-2.5 bg-[#C6EF2E] hover:bg-[#b0d825] text-black font-extrabold rounded-xl cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {generatingOtp && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  Generate 6-Digit Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: SHOW MEMBER QR CODE                                  */}
      {/* ------------------------------------------------------------- */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-center space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h4 className="font-bold text-white text-sm">Digital Member Pass</h4>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* QR Mockup */}
            <div className="bg-white p-5 rounded-2xl mx-auto w-48 h-48 flex items-center justify-center shadow-lg">
              <div className="w-full h-full border-4 border-black p-2 flex flex-col justify-between items-center font-mono">
                <i className="fa-solid fa-qrcode text-8xl text-black"></i>
              </div>
            </div>

            <div>
              <div className="font-mono text-xs text-[#C6EF2E] font-bold">{card.cardNumber}</div>
              <div className="font-bold text-sm text-white mt-0.5">{card.cardHolder}</div>
              <p className="text-[11px] text-gray-400 mt-1">
                Scan this pass at turnstiles, front desk reception, or counter checkout points.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
