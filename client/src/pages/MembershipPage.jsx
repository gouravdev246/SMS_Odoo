import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageBanner from '../components/common/PageBanner';
import SubHeading from '../components/common/SubHeading';
import ScrollReveal from '../components/common/ScrollReveal';
import api from '../services/api';

const DEFAULT_PLANS = [
  {
    tier: 'JUNIOR',
    name: 'Junior Academy',
    badge: 'Under-18 Special',
    annualFee: 8000,
    renewalFee: 7200,
    courtDiscount: 15,
    shopDiscount: 11,
    cafeDiscount: 5,
    advanceBookingDays: 3,
    description: 'Specially structured for rising athletes, students, and aspiring club champions.',
    benefits: [
      '15% off court bookings during junior coaching hours',
      '11% off junior rackets, footwear, and strings',
      '5% off smoothies and fresh hydration drinks at Court-Side Bar',
      '3-Day advance slot reservation window',
      'Quarterly performance coaching assessment reports',
      'Digital Virtual Card & Turnstile QR Access',
    ],
  },
  {
    tier: 'SILVER',
    name: 'Silver Regular',
    badge: 'Most Flexible',
    annualFee: 15000,
    renewalFee: 13500,
    courtDiscount: 10,
    shopDiscount: 15,
    cafeDiscount: 10,
    advanceBookingDays: 4,
    description: 'Perfect for regular players seeking consistent game time, tournament entry, and community perks.',
    benefits: [
      '10% off all Court Bookings (Padel, Tennis, Badminton, Cricket)',
      '15% off Pro Shop equipment, strings & grips',
      '10% off Court-Side Bar & Cafeteria food & beverage orders',
      '4-Day advance court slot booking window',
      'Access to monthly club social mixer tournaments',
      'Complimentary locker room access during matches',
      'Digital Virtual Card & Turnstile QR Access',
    ],
  },
  {
    tier: 'GOLD',
    name: 'Gold All-Access',
    badge: 'Most Popular / Best Value',
    isPopular: true,
    annualFee: 25000,
    renewalFee: 22000,
    courtDiscount: 20,
    shopDiscount: 30,
    cafeDiscount: 20,
    advanceBookingDays: 7,
    description: 'The ultimate VIP club experience with maximum discounts, peak priority, and exclusive privileges.',
    benefits: [
      '20% off all Court Bookings across all sports',
      '30% off Sports Gear & Apparel at Champions Pro Shop',
      '20% off Court-Side Bar & Cafeteria tabs',
      '7-Day priority court reservation window',
      'Complimentary monthly racket re-gripping service',
      '2 Monthly guest passes for friends & family',
      'VIP member lounge & private locker privileges',
      'Digital Virtual Card & Turnstile QR Access',
    ],
  },
];

const faqs = [
  {
    q: 'How does membership renewal work, and what is the renewal discount?',
    a: 'Active members receive an exclusive renewal discount (up to ₹3,000 off annual fees) when renewing before or upon expiration. Renewing instantly extends your membership by 365 calendar days from your current expiry date without losing any remaining days.',
  },
  {
    q: 'Can I pay for my renewal or upgrade using my Club Virtual Card?',
    a: 'Yes! You can pay seamlessly from your Virtual Card wallet balance with 1-click checkout. If your balance is insufficient, you can top up instantly via UPI, Net Banking, or Credit/Debit Card on the Wallet page.',
  },
  {
    q: 'How are tier upgrade fees calculated?',
    a: 'Upgrades are prorated! You only pay the difference in annual fees between your current tier and your target tier (e.g., upgrading from Silver to Gold costs ₹10,000). Your membership expiry will automatically reset to a full 365 days from the upgrade date.',
  },
  {
    q: 'Do I get guest passes with my membership?',
    a: 'Gold All-Access members receive 2 complimentary guest passes every month to bring friends or family members to Adelux courts. Silver and Junior members can book guest slots at their tier-discounted rate.',
  },
  {
    q: 'How do the tier discounts apply at the Pro Shop and Court-Side Bar?',
    a: 'Discounts are applied automatically! When booking courts online or using your Virtual Card QR code / OTP at the Pro Shop and Bar counters, your Gold (30% shop / 20% bar), Silver (15% shop / 10% bar), or Junior (11% shop / 5% bar) discount is deducted in real-time.',
  },
];

export default function MembershipPage() {
  const [currentUser, setCurrentUser] = useState(api.auth.getUser());
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [memberStatus, setMemberStatus] = useState(null);
  const [alert, setAlert] = useState(null);
  const [activeFaq, setActiveFaq] = useState(0);

  // Modals & Purchase Selection
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState('GOLD');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradeTier, setSelectedUpgradeTier] = useState('GOLD');
  const [paymentMethod, setPaymentMethod] = useState('VIRTUAL_CARD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openPurchaseModal = (tierCode) => {
    setSelectedTier(tierCode || 'GOLD');
    setShowPurchaseModal(true);
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 7000);
  };

  // Format currency
  const formatINR = (amt) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const refreshStatus = useCallback(async () => {
    const localUser = api.auth.getUser();
    if (!localUser) return;
    try {
      const statusRes = await api.membership.getStatus();
      if (statusRes?.success && statusRes.data) {
        setMemberStatus(statusRes.data);
        const updated = {
          ...localUser,
          membership: statusRes.data.user?.membership || localUser.membership,
          amount: statusRes.data.user?.amount ?? localUser.amount,
          renewalDate: statusRes.data.user?.renewalDate || localUser.renewalDate,
        };
        localStorage.setItem('user', JSON.stringify(updated));
        setCurrentUser(updated);
      }
    } catch {
      // Unauthenticated or server error
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const plansRes = await api.membership.getPlans().catch(() => null);
        if (isMounted && plansRes?.plans && Array.isArray(plansRes.plans)) {
          setPlans(plansRes.plans);
        }
      } catch {
        // Keep default plans
      }

      const localUser = api.auth.getUser();
      if (localUser) {
        try {
          const statusRes = await api.membership.getStatus();
          if (isMounted && statusRes?.success && statusRes.data) {
            setMemberStatus(statusRes.data);
            const updated = {
              ...localUser,
              membership: statusRes.data.user?.membership || localUser.membership,
              amount: statusRes.data.user?.amount ?? localUser.amount,
              renewalDate: statusRes.data.user?.renewalDate || localUser.renewalDate,
            };
            localStorage.setItem('user', JSON.stringify(updated));
            if (isMounted) setCurrentUser(updated);
          }
        } catch {
          // Keep local user
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Current user's tier details
  const currentTier = (memberStatus?.user?.membership || currentUser?.membership || 'NONE').toUpperCase();
  const currentPlan =
    plans.find((p) => p.tier === currentTier) ||
    DEFAULT_PLANS.find((p) => p.tier === currentTier) ||
    null;

  const walletBalance = Number(memberStatus?.user?.amount ?? currentUser?.amount ?? 0);
  const daysRemaining = memberStatus?.daysRemaining ?? 0;
  const renewalDate = memberStatus?.user?.renewalDate || currentUser?.renewalDate;

  // Handle Membership Renewal
  const handleRenew = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.membership.renew({ paymentMethod });
      if (res?.success) {
        showAlert('success', res.message || 'Membership renewed successfully for 1 year!');
        setShowRenewModal(false);

        // Update local state and storage
        if (currentUser) {
          const updated = {
            ...currentUser,
            amount: res.walletBalance ?? currentUser.amount,
            renewalDate: res.newRenewalDate,
          };
          localStorage.setItem('user', JSON.stringify(updated));
          setCurrentUser(updated);
        }
        await refreshStatus();
      } else {
        showAlert('error', res?.message || 'Failed to renew membership.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Error occurred while processing renewal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Membership Upgrade
  const handleUpgrade = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.membership.upgrade({
        targetTier: selectedUpgradeTier,
        paymentMethod,
      });
      if (res?.success) {
        showAlert(
          'success',
          res.message || `Congratulations! You have upgraded to ${selectedUpgradeTier} tier!`
        );
        setShowUpgradeModal(false);

        // Update local state and storage
        if (currentUser) {
          const updated = {
            ...currentUser,
            membership: res.newTier || selectedUpgradeTier,
            amount: res.walletBalance ?? currentUser.amount,
            renewalDate: res.newRenewalDate,
          };
          localStorage.setItem('user', JSON.stringify(updated));
          setCurrentUser(updated);
        }
        await refreshStatus();
      } else {
        showAlert('error', res?.message || 'Failed to upgrade membership.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Error occurred while processing upgrade.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate upgrade cost
  const getUpgradeCost = (targetTierCode) => {
    const targetPlan = plans.find((p) => p.tier === targetTierCode) || DEFAULT_PLANS.find((p) => p.tier === targetTierCode);
    if (!targetPlan) return 0;
    if (!currentPlan) return targetPlan.annualFee;
    return Math.max(0, targetPlan.annualFee - currentPlan.annualFee);
  };

  // Calculate actual payable fee for any tier (renewal, upgrade, or new subscription)
  const getPayableFee = (targetTierCode) => {
    const targetPlan = plans.find((p) => p.tier === targetTierCode) || DEFAULT_PLANS.find((p) => p.tier === targetTierCode);
    if (!targetPlan) return 0;
    if (targetTierCode === currentTier) {
      return targetPlan.renewalFee || targetPlan.annualFee;
    }
    if (currentPlan && targetPlan.annualFee > currentPlan.annualFee) {
      return targetPlan.annualFee - currentPlan.annualFee;
    }
    return targetPlan.annualFee;
  };

  // Unified Self-Service Purchase Handler
  const handlePurchase = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.membership.purchase({
        tier: selectedTier,
        paymentMethod,
      });

      if (res?.success) {
        showAlert(
          'success',
          res.message || `Congratulations! You have successfully subscribed to ${selectedTier} plan!`
        );
        setShowPurchaseModal(false);
        setShowRenewModal(false);
        setShowUpgradeModal(false);

        // Update local session
        if (currentUser) {
          const updated = {
            ...currentUser,
            membership: res.membershipTier || selectedTier,
            amount: res.walletBalance ?? currentUser.amount,
            renewalDate: res.newRenewalDate,
          };
          localStorage.setItem('user', JSON.stringify(updated));
          localStorage.setItem('champions_user', JSON.stringify(updated));
          setCurrentUser(updated);
        }
        await refreshStatus();
      } else {
        showAlert('error', res?.message || 'Failed to complete subscription purchase.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Error occurred while processing subscription purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-[#0e0f0f] text-gray-100 min-h-screen">
      {/* Page Banner */}
      <PageBanner
        title="Club Membership & Pass"
        current="Membership"
        bannerClass="banner-inner-membership"
      />

      {/* Global Alert Notification */}
      {alert && (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div
            className={`p-4 rounded-2xl flex items-center justify-between text-sm shadow-xl transition-all ${
              alert.type === 'success'
                ? 'bg-[#C6EF2E]/10 border border-[#C6EF2E] text-[#C6EF2E]'
                : 'bg-red-500/10 border border-red-500 text-red-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <i
                className={`fa-solid ${
                  alert.type === 'success' ? 'fa-circle-check text-lg' : 'fa-triangle-exclamation text-lg'
                }`}
              ></i>
              <span className="font-medium">{alert.message}</span>
            </div>
            <button
              onClick={() => setAlert(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: LOGGED-IN MEMBER MEMBERSHIP 360 HERO PORTAL */}
      {currentUser && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="relative bg-gradient-to-br from-[#1a1c1d] via-[#141515] to-[#101111] border border-[#2d3032] rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
            {/* Subtle glow orb */}
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#C6EF2E]/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-[#262828] pb-6">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-[#C6EF2E]/20 text-[#C6EF2E] border border-[#C6EF2E]/40 flex items-center gap-1.5">
                    <i className="fa-solid fa-id-card"></i> Member Portal
                  </span>

                  {/* Tier Pill */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                      currentTier === 'GOLD'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                        : currentTier === 'SILVER'
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/50'
                        : currentTier === 'JUNIOR'
                        ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/50'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        currentTier === 'GOLD'
                          ? 'fa-crown text-amber-300'
                          : currentTier === 'SILVER'
                          ? 'fa-shield-halved text-slate-200'
                          : 'fa-star text-emerald-300'
                      }`}
                    ></i>
                    {currentTier} TIER
                  </span>

                  {/* Expiration Status Badge */}
                  {renewalDate && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        daysRemaining <= 0
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                          : daysRemaining <= 7
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      <i className="fa-solid fa-clock"></i>
                      {daysRemaining <= 0
                        ? 'Expired'
                        : daysRemaining === 1
                        ? 'Expires Tomorrow!'
                        : `${daysRemaining} Days Left`}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  Welcome Back, <span className="text-[#C6EF2E]">{currentUser.name || 'Member'}</span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Card Holder: <span className="text-gray-200 font-medium">{currentUser.phone || '9876543210'}</span> | Active Plan:{' '}
                  <span className="text-white font-semibold">{currentPlan?.name || `${currentTier} Membership`}</span>
                </p>
              </div>

              {/* Virtual Card Balance Chip */}
              <div className="flex items-center gap-4 bg-[#111213] border border-[#2b2d2e] rounded-2xl p-4 shadow-inner">
                <div className="w-12 h-12 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-xl">
                  <i className="fa-solid fa-wallet"></i>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Virtual Card Balance</div>
                  <div className="text-xl md:text-2xl font-black text-white">{formatINR(walletBalance)}</div>
                </div>
                <Link
                  to="/wallet"
                  className="ml-2 px-3 py-1.5 rounded-xl bg-[#202223] hover:bg-[#C6EF2E] hover:text-black text-xs font-semibold text-gray-200 transition-all border border-gray-700 hover:border-[#C6EF2E]"
                >
                  Top Up
                </Link>
              </div>
            </div>

            {/* Active Perks & Expiry Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
              <div className="bg-[#121314] border border-[#242627] rounded-2xl p-4 text-center hover:border-[#C6EF2E]/40 transition-colors">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Court Bookings</div>
                <div className="text-2xl font-black text-[#C6EF2E]">
                  {currentPlan?.courtDiscount ?? 10}% OFF
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Real-time discount</div>
              </div>

              <div className="bg-[#121314] border border-[#242627] rounded-2xl p-4 text-center hover:border-[#C6EF2E]/40 transition-colors">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Champions Pro Shop</div>
                <div className="text-2xl font-black text-[#C6EF2E]">
                  {currentPlan?.shopDiscount ?? 15}% OFF
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Gear, apparel & strings</div>
              </div>

              <div className="bg-[#121314] border border-[#242627] rounded-2xl p-4 text-center hover:border-[#C6EF2E]/40 transition-colors">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Court-Side Bar</div>
                <div className="text-2xl font-black text-[#C6EF2E]">
                  {currentPlan?.cafeDiscount ?? 10}% OFF
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Tabs, drinks & snacks</div>
              </div>

              <div className="bg-[#121314] border border-[#242627] rounded-2xl p-4 text-center hover:border-[#C6EF2E]/40 transition-colors">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Advance Booking</div>
                <div className="text-2xl font-black text-[#C6EF2E]">
                  {currentPlan?.advanceBookingDays ?? 4} Days
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Priority slot window</div>
              </div>
            </div>

            {/* Expiry Progress & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#262828]">
              <div className="text-sm text-gray-300">
                <i className="fa-solid fa-calendar-check text-[#C6EF2E] mr-2"></i>
                Valid Until:{' '}
                <span className="font-bold text-white">
                  {renewalDate ? formatDate(renewalDate) : '365 Days From Enrollment'}
                </span>
                {daysRemaining <= 7 && (
                  <span className="ml-2 text-xs text-amber-400 font-semibold">
                    (Renewal Recommended)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Select / Change Subscription Button */}
                <button
                  type="button"
                  onClick={() => openPurchaseModal(currentTier !== 'NONE' ? currentTier : 'GOLD')}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-sm transition-all shadow-lg hover:shadow-[#C6EF2E]/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-crown"></i>
                  <span>Select / Change Tier</span>
                </button>

                {/* Renew Button */}
                <button
                  type="button"
                  onClick={() => openPurchaseModal(currentTier)}
                  className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-[#1e2022] hover:bg-[#282a2d] text-white hover:text-[#C6EF2E] font-bold text-sm transition-all border border-[#36393b] hover:border-[#C6EF2E]/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-arrows-rotate text-[#C6EF2E]"></i>
                  <span>Renew Active Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: MEMBERSHIP PLANS COMPARISON & ENROLLMENT GRID */}
      <div className="section-wrapper py-12">
        <div className="section section-pricing">
          <div className="hero-container overflow-hidden">
            <div className="d-flex flex-column gspace-5">
              <div className="heading-section-container pricing-heading text-center">
                <SubHeading title="Official Membership Tiers" />
                <h2 className="secondary-accent text-3xl md:text-4xl font-extrabold mt-2">
                  Choose the Tier that Fits Your Athletic Goals
                </h2>
                <p className="text-gray-400 max-w-2xl mx-auto mt-2 text-sm md:text-base">
                  All memberships include seamless QR Turnstile access, unified Virtual Card billing,
                  instant booking perks, and dedicated pro discounts.
                </p>
              </div>

              <div className="row row-cols-xl-3 row-cols-md-2 row-cols-1 g-4">
                {plans.map((plan, idx) => {
                  const isCurrent = currentTier === plan.tier;
                  const canUpgrade =
                    currentUser &&
                    !isCurrent &&
                    getUpgradeCost(plan.tier) > 0 &&
                    currentTier !== 'GOLD';

                  return (
                    <div className="col" key={plan.tier}>
                      <ScrollReveal animation="fade-up" delay={idx * 100}>
                        <div
                          className={`relative h-full flex flex-col justify-between rounded-3xl p-6 md:p-8 transition-all duration-300 ${
                            plan.isPopular || plan.tier === 'GOLD'
                              ? 'bg-gradient-to-b from-[#1b1e1b] via-[#141614] to-[#0e100e] border-2 border-[#C6EF2E] shadow-2xl shadow-[#C6EF2E]/10'
                              : 'bg-[#151617] border border-[#27292a] hover:border-gray-600'
                          }`}
                        >
                          {/* Badge for Popular or Active */}
                          {isCurrent ? (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#C6EF2E] text-black text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5">
                              <i className="fa-solid fa-circle-check"></i> Your Active Tier
                            </div>
                          ) : plan.isPopular ? (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-400 text-black text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5">
                              <i className="fa-solid fa-crown"></i> Most Popular
                            </div>
                          ) : null}

                          <div>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4 mt-2">
                              <div>
                                <h3 className="text-xl md:text-2xl font-black text-white">{plan.name}</h3>
                                <span className="text-xs text-gray-400 font-medium">{plan.badge || 'Annual Pass'}</span>
                              </div>
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                                  plan.tier === 'GOLD'
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : plan.tier === 'SILVER'
                                    ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                                }`}
                              >
                                <i
                                  className={`fa-solid ${
                                    plan.tier === 'GOLD'
                                      ? 'fa-crown'
                                      : plan.tier === 'SILVER'
                                      ? 'fa-shield-halved'
                                      : 'fa-star'
                                  }`}
                                ></i>
                              </div>
                            </div>

                            <p className="text-xs text-gray-400 leading-relaxed mb-6 min-h-[36px]">
                              {plan.description}
                            </p>

                            {/* Pricing Block */}
                            <div className="bg-[#0f1011] border border-[#222425] rounded-2xl p-4 mb-6">
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">
                                  {formatINR(plan.annualFee)}
                                </span>
                                <span className="text-xs text-gray-400">/ Year</span>
                              </div>
                              <div className="mt-1 text-xs text-[#C6EF2E] flex items-center gap-1">
                                <i className="fa-solid fa-tags text-[11px]"></i>
                                Member Renewal:{' '}
                                <span className="font-bold">
                                  {formatINR(plan.renewalFee || plan.annualFee)}/yr
                                </span>
                                <span className="text-gray-400 text-[10px] ml-1">
                                  (Save {formatINR(plan.annualFee - (plan.renewalFee || plan.annualFee))})
                                </span>
                              </div>
                            </div>

                            {/* Discount Perks Quick Matrix */}
                            <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                              <div className="bg-[#18191a] rounded-xl p-2 border border-[#2b2d2e]">
                                <div className="text-[10px] text-gray-400 uppercase">Courts</div>
                                <div className="text-sm font-black text-[#C6EF2E]">
                                  {plan.courtDiscount}% OFF
                                </div>
                              </div>
                              <div className="bg-[#18191a] rounded-xl p-2 border border-[#2b2d2e]">
                                <div className="text-[10px] text-gray-400 uppercase">Pro Shop</div>
                                <div className="text-sm font-black text-[#C6EF2E]">
                                  {plan.shopDiscount}% OFF
                                </div>
                              </div>
                              <div className="bg-[#18191a] rounded-xl p-2 border border-[#2b2d2e]">
                                <div className="text-[10px] text-gray-400 uppercase">Cafe/Bar</div>
                                <div className="text-sm font-black text-[#C6EF2E]">
                                  {plan.cafeDiscount}% OFF
                                </div>
                              </div>
                            </div>

                            {/* Detailed Benefits Checklist */}
                            <div className="border-t border-[#252728] pt-4 mb-6">
                              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                                Included Privileges:
                              </div>
                              <ul className="space-y-2.5 text-xs text-gray-300">
                                {plan.benefits?.map((benefit, bIdx) => (
                                  <li key={bIdx} className="flex items-start gap-2.5">
                                    <i className="fa-solid fa-circle-check text-[#C6EF2E] text-sm mt-0.5 shrink-0"></i>
                                    <span className="leading-snug">{benefit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="mt-4 pt-4 border-t border-[#252728]">
                            {isCurrent ? (
                              <button
                                type="button"
                                onClick={() => openPurchaseModal(plan.tier)}
                                className="w-full py-3.5 rounded-2xl bg-[#C6EF2E]/20 border border-[#C6EF2E] text-[#C6EF2E] hover:bg-[#C6EF2E] hover:text-black font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <i className="fa-solid fa-arrows-rotate"></i>
                                Renew Active Plan ({formatINR(plan.renewalFee || plan.annualFee)})
                              </button>
                            ) : currentUser ? (
                              <button
                                type="button"
                                onClick={() => openPurchaseModal(plan.tier)}
                                className={`w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                  plan.isPopular || plan.tier === 'GOLD'
                                    ? 'bg-[#C6EF2E] hover:bg-[#b0d826] text-black shadow-lg hover:shadow-[#C6EF2E]/20'
                                    : 'bg-[#222426] hover:bg-[#2e3134] text-white border border-gray-700 hover:border-[#C6EF2E]'
                                }`}
                              >
                                <i className={`fa-solid ${canUpgrade ? 'fa-arrow-up-right-dots' : 'fa-crown'}`}></i>
                                {canUpgrade
                                  ? `Upgrade to ${plan.name} (${formatINR(getUpgradeCost(plan.tier))})`
                                  : `Select & Subscribe (${formatINR(plan.annualFee)})`}
                              </button>
                            ) : (
                              <Link
                                to={`/login?redirect=/membership&tier=${plan.tier}`}
                                className={`w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 ${
                                  plan.isPopular || plan.tier === 'GOLD'
                                    ? 'bg-[#C6EF2E] hover:bg-[#b0d826] text-black shadow-lg hover:shadow-[#C6EF2E]/20'
                                    : 'bg-[#1f2123] hover:bg-[#2b2e30] text-white border border-gray-700'
                                }`}
                              >
                                <span>Sign In to Subscribe</span>
                                <i className="fa-solid fa-arrow-right text-xs"></i>
                              </Link>
                            )}
                          </div>
                        </div>
                      </ScrollReveal>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: MEMBERSHIP PRIVILEGES SHOWCASE */}
      <div className="section py-12 border-t border-[#1c1d1e]">
        <div className="hero-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <SubHeading title="Exclusive Privileges" />
            <h2 className="text-3xl font-extrabold text-white mt-2">
              Engineered For Modern Athletic Lifestyles
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              From automated court turnstiles to emergency racket stringing, your membership unlocks
              unrivaled sports club facilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#141516] border border-[#262828] rounded-3xl p-6 hover:border-[#C6EF2E]/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-2xl mb-5">
                <i className="fa-solid fa-qrcode"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Turnstile QR & Virtual Card</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Walk in and flash your synchronized digital member QR code at the turnstiles for instant 1-touch entry.
              </p>
            </div>

            <div className="bg-[#141516] border border-[#262828] rounded-3xl p-6 hover:border-[#C6EF2E]/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-2xl mb-5">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">15-Min Express Stringing</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Snapped a string before match point? Gold & Silver members receive priority lane stringing at our Pro Shop.
              </p>
            </div>

            <div className="bg-[#141516] border border-[#262828] rounded-3xl p-6 hover:border-[#C6EF2E]/50 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-2xl mb-5">
                <i className="fa-solid fa-utensils"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Court-Side Bar Discounts</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Rehydrate post-match with automated tier deductions on gourmet power-bowls, shakes, and recovery drinks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: FREQUENTLY ASKED QUESTIONS */}
      <div className="section py-12 border-t border-[#1c1d1e]">
        <div className="hero-container">
          <div className="row row-cols-xl-2 row-cols-1 g-4 items-start">
            <div className="col col-xl-4">
              <div className="sticky top-28">
                <SubHeading title="Get Answers" />
                <h2 className="text-3xl font-extrabold text-white mt-2">
                  Membership FAQs
                </h2>
                <p className="text-gray-400 text-sm mt-3 leading-relaxed">
                  Have questions about your tier privileges, renewal billing, or guest passes? Everything you need to know about playing at Adelux.
                </p>
                <div className="mt-6 p-4 rounded-2xl bg-[#141516] border border-[#282a2b]">
                  <div className="text-xs text-gray-400">Need personal assistance?</div>
                  <div className="text-sm font-semibold text-white mt-1">Front Desk Helpdesk</div>
                  <div className="text-xs text-[#C6EF2E] mt-1 font-mono">+91 98765 43210</div>
                </div>
              </div>
            </div>

            <div className="col col-xl-8">
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-[#141516] border border-[#242627] hover:border-[#333638] cursor-pointer rounded-2xl transition-all"
                    onClick={() => setActiveFaq(activeFaq === idx ? -1 : idx)}
                  >
                    <div className="flex justify-between items-center gap-4">
                      <h4 className="text-base md:text-lg font-bold text-white mb-0">{faq.q}</h4>
                      <i
                        className={`fa-solid fa-chevron-down text-sm transition-transform duration-300 ${
                          activeFaq === idx ? 'rotate-180 text-[#C6EF2E]' : 'text-gray-400'
                        }`}
                      ></i>
                    </div>
                    {activeFaq === idx && (
                      <p className="mt-3 text-gray-400 text-sm leading-relaxed mb-0 border-t border-[#262828] pt-3">
                        {faq.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED SELF-SERVICE SUBSCRIPTION SELECTION & PURCHASE MODAL */}
      {(showPurchaseModal || showRenewModal || showUpgradeModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-[#161718] border border-[#2b2d2e] rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowPurchaseModal(false);
                setShowRenewModal(false);
                setShowUpgradeModal(false);
              }}
              className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                  selectedTier === 'GOLD'
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : selectedTier === 'SILVER'
                    ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                }`}
              >
                <i
                  className={`fa-solid ${
                    selectedTier === 'GOLD'
                      ? 'fa-crown'
                      : selectedTier === 'SILVER'
                      ? 'fa-shield-halved'
                      : 'fa-star'
                  }`}
                ></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Select & Purchase Subscription</h3>
                <p className="text-xs text-gray-400">
                  Current: <span className="text-[#C6EF2E] font-bold">{currentTier} Tier</span> | 1-Year Full Privileges
                </p>
              </div>
            </div>

            {/* Step 1: Interactive Tier Switcher (GOLD, SILVER, JUNIOR) */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                1. Select Subscription Tier:
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {['GOLD', 'SILVER', 'JUNIOR'].map((tierCode) => {
                  const isSelected = selectedTier === tierCode;
                  const isUserActive = currentTier === tierCode;
                  const payable = getPayableFee(tierCode);

                  return (
                    <button
                      key={tierCode}
                      type="button"
                      onClick={() => setSelectedTier(tierCode)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#C6EF2E]/15 border-[#C6EF2E] shadow-lg shadow-[#C6EF2E]/10'
                          : 'bg-[#1c1d1f] border-[#292b2c] hover:border-gray-600 text-gray-400'
                      }`}
                    >
                      {isUserActive && (
                        <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-[#C6EF2E] text-black text-[9px] font-black uppercase">
                          Active
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                          {tierCode}
                        </span>
                        <i
                          className={`fa-solid ${
                            tierCode === 'GOLD'
                              ? 'fa-crown text-amber-400 text-xs'
                              : tierCode === 'SILVER'
                              ? 'fa-shield text-slate-300 text-xs'
                              : 'fa-star text-emerald-400 text-xs'
                          }`}
                        ></i>
                      </div>
                      <div className="text-[11px] font-bold text-[#C6EF2E] mt-1.5">
                        {formatINR(payable)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {isUserActive ? 'Renewal / yr' : '1 Year Pass'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Selected Plan Benefits & Price Breakdown */}
            {(() => {
              const selectedPlan =
                plans.find((p) => p.tier === selectedTier) ||
                DEFAULT_PLANS.find((p) => p.tier === selectedTier);
              const payableFee = getPayableFee(selectedTier);
              const isRenewal = selectedTier === currentTier;
              const isUpgrade = currentPlan && selectedPlan.annualFee > currentPlan.annualFee && !isRenewal;
              const diffSavings = isRenewal
                ? selectedPlan.annualFee - (selectedPlan.renewalFee || selectedPlan.annualFee)
                : isUpgrade
                ? currentPlan.annualFee
                : 0;

              return (
                <>
                  <div className="bg-[#101112] border border-[#232526] rounded-2xl p-4 mb-5 text-xs space-y-2.5">
                    <div className="flex justify-between items-center text-gray-300">
                      <span>Subscription Tier:</span>
                      <span className="font-extrabold text-white text-sm">
                        {selectedPlan?.name || selectedTier}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center pt-2 pb-1 border-t border-[#232526]">
                      <div className="bg-[#18191a] p-2 rounded-xl border border-[#262829]">
                        <div className="text-[10px] text-gray-400 uppercase">Courts</div>
                        <div className="font-black text-[#C6EF2E] text-xs">
                          {selectedPlan?.courtDiscount}% OFF
                        </div>
                      </div>
                      <div className="bg-[#18191a] p-2 rounded-xl border border-[#262829]">
                        <div className="text-[10px] text-gray-400 uppercase">Pro Shop</div>
                        <div className="font-black text-[#C6EF2E] text-xs">
                          {selectedPlan?.shopDiscount}% OFF
                        </div>
                      </div>
                      <div className="bg-[#18191a] p-2 rounded-xl border border-[#262829]">
                        <div className="text-[10px] text-gray-400 uppercase">Cafe/Bar</div>
                        <div className="font-black text-[#C6EF2E] text-xs">
                          {selectedPlan?.cafeDiscount}% OFF
                        </div>
                      </div>
                      <div className="bg-[#18191a] p-2 rounded-xl border border-[#262829]">
                        <div className="text-[10px] text-gray-400 uppercase">Advance</div>
                        <div className="font-black text-[#C6EF2E] text-xs">
                          {selectedPlan?.advanceBookingDays} Days
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#232526] space-y-1.5">
                      <div className="flex justify-between text-gray-400">
                        <span>Standard Annual Rate:</span>
                        <span>{formatINR(selectedPlan?.annualFee)}</span>
                      </div>

                      {isRenewal && diffSavings > 0 && (
                        <div className="flex justify-between text-[#C6EF2E]">
                          <span>Member Renewal Special Discount:</span>
                          <span>- {formatINR(diffSavings)}</span>
                        </div>
                      )}

                      {isUpgrade && (
                        <div className="flex justify-between text-amber-300">
                          <span>Prorated Upgrade Credit (from {currentTier}):</span>
                          <span>- {formatINR(currentPlan?.annualFee)}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-extrabold text-white text-base pt-1 border-t border-[#2a2c2d]">
                        <span>Net Amount Due:</span>
                        <span className="text-[#C6EF2E]">{formatINR(payableFee)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Payment Method Selector */}
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                      2. Select Payment Method:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('VIRTUAL_CARD')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'VIRTUAL_CARD'
                            ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                            : 'bg-[#1a1b1c] border-[#292b2c] text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <i className="fa-solid fa-wallet text-[#C6EF2E]"></i> Virtual Card Wallet
                        </div>
                        <div className="text-[11px] text-gray-300 mt-1 font-mono">
                          Balance: {formatINR(walletBalance)}
                        </div>
                        {paymentMethod === 'VIRTUAL_CARD' && (
                          <div
                            className={`text-[10px] mt-1 font-medium ${
                              walletBalance >= payableFee ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {walletBalance >= payableFee
                              ? `Remaining: ${formatINR(walletBalance - payableFee)}`
                              : 'Insufficient wallet balance'}
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('UPI_ONLINE')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'UPI_ONLINE'
                            ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                            : 'bg-[#1a1b1c] border-[#292b2c] text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <i className="fa-solid fa-mobile-screen-button text-[#C6EF2E]"></i> UPI / Net Banking
                        </div>
                        <div className="text-[11px] text-gray-300 mt-1">Instant Digital Transfer</div>
                        <div className="text-[10px] text-gray-400 mt-1">Cards, UPI & Net Banking</div>
                      </button>
                    </div>

                    {/* Low balance warning */}
                    {paymentMethod === 'VIRTUAL_CARD' && walletBalance < payableFee && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                        <span>Wallet needs ₹{(payableFee - walletBalance).toLocaleString('en-IN')} more to pay.</span>
                        <Link to="/wallet" className="font-bold underline text-[#C6EF2E] hover:text-white">
                          Top Up Wallet Now &rarr;
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPurchaseModal(false);
                        setShowRenewModal(false);
                        setShowUpgradeModal(false);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-[#202223] hover:bg-[#282a2d] text-gray-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePurchase}
                      disabled={
                        isSubmitting ||
                        (paymentMethod === 'VIRTUAL_CARD' && walletBalance < payableFee)
                      }
                      className="flex-1 py-3 rounded-2xl bg-[#C6EF2E] hover:bg-[#b0d826] disabled:opacity-50 text-black font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#C6EF2E]/20"
                    >
                      {isSubmitting ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin"></i> Processing...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-crown"></i>
                          Confirm & Activate {selectedTier} ({formatINR(payableFee)})
                        </>
                      )}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
