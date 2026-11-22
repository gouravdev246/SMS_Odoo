import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageBanner from '../components/common/PageBanner';
import api from '../services/api';

const CATEGORIES = [
  { id: 'ALL', label: 'All Items', icon: 'fa-utensils' },
  { id: 'SMOOTHIES', label: 'Smoothies', icon: 'fa-blender' },
  { id: 'PROTEIN', label: 'Protein Shakes', icon: 'fa-dumbbell' },
  { id: 'FOOD', label: 'Gourmet Bowls & Wraps', icon: 'fa-bowl-food' },
  { id: 'COFFEE', label: 'Espresso & Coffee', icon: 'fa-mug-hot' },
  { id: 'BEVERAGES', label: 'Hydration Drinks', icon: 'fa-bottle-water' },
  { id: 'SNACKS', label: 'Energy Snacks', icon: 'fa-cookie-bite' },
];

const getCategoryIcon = (category) => {
  switch (category) {
    case 'SMOOTHIES':
      return 'fa-blender';
    case 'PROTEIN':
      return 'fa-dumbbell';
    case 'FOOD':
      return 'fa-bowl-food';
    case 'COFFEE':
      return 'fa-mug-hot';
    case 'BEVERAGES':
      return 'fa-bottle-water';
    case 'SNACKS':
      return 'fa-cookie-bite';
    default:
      return 'fa-utensils';
  }
};

const COURTS = [
  'Padel Court 1 (Panoramic)',
  'Padel Court 2 (Standard)',
  'Tennis Court 3 (Clay)',
  'Tennis Court 4 (Hard)',
  'Badminton Court 1',
  'Badminton Court 2',
  'Cricket Practice Net A',
  'Cricket Practice Net B',
];

const TABLES = Array.from({ length: 12 }, (_, i) => `Table #${i + 1}`);

export default function BarMenuPage() {
  const [currentUser, setCurrentUser] = useState(api.auth.getUser());
  const [menu, setMenu] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyVegan, setOnlyVegan] = useState(false);
  const [onlyGlutenFree, setOnlyGlutenFree] = useState(false);

  // Cart / Tab state
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState('COURT_SIDE'); // 'COURT_SIDE' | 'BAR_LOUNGE' | 'TAKEAWAY'
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0]);
  const [selectedTable, setSelectedTable] = useState('Table #1');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('VIRTUAL_CARD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation & Order History Modals
  const [placedOrder, setPlacedOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [alert, setAlert] = useState(null);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 6000);
  };

  const handleViewReceipt = async (orderId) => {
    setLoadingReceipt(true);
    try {
      const res = await api.cafe.getReceipt(orderId);
      if (res?.receipt) {
        setSelectedReceipt(res.receipt);
      }
    } catch (err) {
      showAlert('error', err.message || 'Failed to load order receipt.');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleDownloadPdf = async (orderId, orderNumber = '') => {
    setDownloadingPdf(true);
    try {
      await api.cafe.downloadReceiptPdf(orderId, `receipt-${orderNumber || orderId.slice(0, 8)}.pdf`);
      showAlert('success', 'Official PDF receipt downloaded successfully.');
    } catch (err) {
      showAlert('error', err.message || 'Failed to download receipt PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Format INR Currency
  const formatINR = (amt) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt || 0);

  // User membership tier & discount
  const userTier = (currentUser?.membership || 'NONE').toUpperCase();
  const tierDiscountPercent = useMemo(() => {
    if (userTier === 'GOLD') return 20;
    if (userTier === 'SILVER') return 10;
    if (userTier === 'JUNIOR') return 5;
    return 0;
  }, [userTier]);

  const walletBalance = Number(currentUser?.amount || 0);

  // Fetch Member's recent cafe orders
  const fetchRecentOrders = useCallback(async (isMounted = true) => {
    if (!currentUser) return;
    try {
      const res = await api.cafe.getMyOrders();
      if (isMounted && res?.success && Array.isArray(res.orders)) {
        setRecentOrders(res.orders);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const res = await api.cafe.getMenu({ availableOnly: false });
        if (isMounted && res?.success && Array.isArray(res.menu)) {
          setMenu(res.menu);
          setLoadingMenu(false);
        }
      } catch {
        if (isMounted) setLoadingMenu(false);
      }

      if (currentUser) {
        try {
          const walletRes = await api.wallet.getDetails();
          if (isMounted && walletRes?.virtualCard?.balance !== undefined) {
            const freshBal = Number(walletRes.virtualCard.balance);
            setCurrentUser((prev) => {
              const updated = { ...(prev || {}), amount: freshBal };
              api.auth.updateUser(updated);
              return updated;
            });
          }
        } catch {
          // ignore
        }

        try {
          const res = await api.cafe.getMyOrders();
          if (isMounted && res?.success && Array.isArray(res.orders)) {
            setRecentOrders(res.orders);
          }
        } catch {
          // ignore
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Filtered menu list
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      if (activeCategory !== 'ALL' && item.category !== activeCategory) {
        return false;
      }
      if (onlyVegan && !item.isVegan) {
        return false;
      }
      if (onlyGlutenFree && !item.isGlutenFree) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [menu, activeCategory, onlyVegan, onlyGlutenFree, searchQuery]);

  // Cart operations
  const addToCart = (item) => {
    if (!item.isAvailable) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const totalCartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Cart Pricing Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Math.round(((subtotal * tierDiscountPercent) / 100) * 100) / 100;
  }, [subtotal, tierDiscountPercent]);

  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Submit Order
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showAlert('error', 'Please login to place an order.');
      return;
    }
    if (cart.length === 0) {
      showAlert('error', 'Your order tab is empty.');
      return;
    }

    if (paymentMethod === 'VIRTUAL_CARD' && walletBalance < finalTotal) {
      showAlert(
        'error',
        `Insufficient Virtual Card balance (₹${walletBalance.toFixed(2)}). Please top up your wallet.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        deliveryLocation,
        tableNumber:
          deliveryLocation === 'BAR_LOUNGE' ? parseInt(selectedTable.replace('Table #', ''), 10) : null,
        courtNumber: deliveryLocation === 'COURT_SIDE' ? selectedCourt : null,
        notes: customerNotes.trim() || null,
        paymentMethod,
        items: cart.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
      };

      const res = await api.cafe.createOrder(orderPayload);
      if (res?.success) {
        setPlacedOrder(res.order);
        setCart([]);
        setIsCartOpen(false);

        // Update local user's wallet balance
        if (res.walletBalance !== undefined) {
          const updated = { ...currentUser, amount: res.walletBalance };
          api.auth.updateUser(updated);
          setCurrentUser(updated);
        }

        showAlert('success', res.message || 'Order sent to the Barista & Kitchen!');
        fetchRecentOrders();
      } else {
        showAlert('error', res?.message || 'Failed to place order.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Error occurred while placing order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-[#0e0f0f] text-gray-100 min-h-screen">
      {/* Banner */}
      <PageBanner
        title="Court-Side Bar & Cafeteria"
        current="Bar & Lounge"
        bannerClass="banner-inner-services"
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

      {/* MEMBER DISCOUNT CALLOUT & WALLET SUMMARY */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="bg-[#141414] border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-2xl shrink-0">
              <i className="fa-solid fa-utensils"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-black text-white">Court-Side Athletic Nutrition</span>
                {userTier !== 'NONE' && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      userTier === 'GOLD'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : userTier === 'SILVER'
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                        : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    }`}
                  >
                    {userTier} Member
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1 mb-0">
                {userTier !== 'NONE' ? (
                  <>
                    <strong className="text-[#C6EF2E]">{tierDiscountPercent}% Member Discount</strong>{' '}
                    applied automatically on all smoothies, power bowls, wraps, and matchday espresso.
                  </>
                ) : (
                  <>
                    Upgrade your membership to unlock up to{' '}
                    <strong className="text-[#C6EF2E]">20% off</strong> all court-side tabs.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {currentUser ? (
              <>
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-right">
                  <div className="text-[10px] text-gray-400 uppercase font-semibold">Virtual Card</div>
                  <div className="text-sm font-black text-white font-mono">{formatINR(walletBalance)}</div>
                </div>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-bold text-gray-200 transition-all border border-gray-800 hover:border-gray-700 flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-receipt text-[#C6EF2E]"></i>
                  <span>My Tabs ({recentOrders.length})</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-6 py-3 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-black text-xs transition-all shadow-md shadow-[#C6EF2E]/20 whitespace-nowrap"
              >
                Sign In to Order
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* MENU BROWSING & FILTERS */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Navigation Pills */}
        <div className="flex items-center gap-3 overflow-x-auto pb-3 scrollbar-none mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#C6EF2E] text-black shadow-lg shadow-[#C6EF2E]/20'
                  : 'bg-[#141414] text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${cat.icon}`}></i>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Dietary Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#141414] border border-gray-800 rounded-2xl p-4 mb-8 shadow-md">
          <div className="relative w-full sm:w-80">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"></i>
            <input
              type="text"
              placeholder="Search smoothies, bowls, coffee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#C6EF2E]"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setOnlyVegan(!onlyVegan)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                onlyVegan
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:border-gray-700'
              }`}
            >
              <i className="fa-solid fa-leaf text-xs"></i>
              <span>Vegan Only</span>
            </button>

            <button
              onClick={() => setOnlyGlutenFree(!onlyGlutenFree)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                onlyGlutenFree
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:border-gray-700'
              }`}
            >
              <i className="fa-solid fa-wheat-awn-circle-exclamation text-xs"></i>
              <span>Gluten-Free</span>
            </button>
          </div>
        </div>

        {/* Menu Cards Grid */}
        {loadingMenu ? (
          <div className="py-20 text-center text-gray-400">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#C6EF2E] mb-3"></i>
            <p className="text-sm">Loading Court-Side Menu & Nutrition Data...</p>
          </div>
        ) : filteredMenu.length === 0 ? (
          <div className="py-20 text-center bg-[#141414] border border-gray-800 rounded-3xl">
            <i className="fa-solid fa-bowl-food text-4xl text-gray-600 mb-3"></i>
            <h4 className="text-lg font-bold text-white">No items found</h4>
            <p className="text-xs text-gray-400">Try adjusting your category or diet filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenu.map((item) => {
              const inCartItem = cart.find((i) => i.id === item.id);
              const originalPrice = Number(item.price);
              const discountedPrice = Math.max(
                0,
                originalPrice - (originalPrice * tierDiscountPercent) / 100
              );

              return (
                <div
                  key={item.id}
                  className={`bg-[#141414] rounded-2xl border border-gray-800 hover:border-[#C6EF2E]/50 transition-all duration-300 flex flex-col justify-between overflow-hidden group p-5 space-y-4 shadow-xl ${
                    item.isAvailable ? '' : 'opacity-60'
                  }`}
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-300 font-mono">
                        {item.category}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {item.calories && (
                          <span className="text-[11px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800 font-mono">
                            {item.calories} kcal
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800 font-mono">
                          <i className="fa-solid fa-bolt text-[10px] text-amber-400 mr-1"></i>
                          {item.prepTimeMin}m prep
                        </span>
                      </div>
                    </div>

                    {/* Category Icon Visual Mockup */}
                    <div className="w-full h-36 bg-[#1a1a1a] rounded-xl flex items-center justify-center text-gray-600 group-hover:text-[#C6EF2E] transition border border-gray-800/60 mb-3">
                      <i className={`fa-solid ${getCategoryIcon(item.category)} text-5xl`}></i>
                    </div>

                    <h4 className="font-bold text-white text-base leading-snug line-clamp-1 mb-1" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 min-h-[36px] mb-3">
                      {item.description}
                    </p>

                    {/* Dietary Badges */}
                    <div className="flex items-center gap-1.5 min-h-[22px]">
                      {item.isVegan && (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                          <i className="fa-solid fa-leaf text-[9px]"></i> Vegan
                        </span>
                      )}
                      {item.isGlutenFree && (
                        <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                          <i className="fa-solid fa-wheat-awn-circle-exclamation text-[9px]"></i> Gluten-Free
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Pricing & Actions */}
                  <div className="pt-3 border-t border-gray-800/80">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        {tierDiscountPercent > 0 ? (
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-extrabold text-[#C6EF2E] font-mono">
                                {formatINR(discountedPrice)}
                              </span>
                              <span className="text-xs text-gray-500 line-through font-mono">
                                {formatINR(originalPrice)}
                              </span>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-semibold block">
                              {userTier} Member Price ({tierDiscountPercent}% Off)
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-lg font-extrabold text-white font-mono">
                              {formatINR(originalPrice)}
                            </span>
                            <div className="text-[10px] text-gray-500">Standard MRP</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Button or Stepper */}
                    {!item.isAvailable ? (
                      <button
                        disabled
                        type="button"
                        className="w-full py-2.5 px-4 bg-gray-900 text-gray-500 font-bold rounded-xl text-xs border border-gray-800 cursor-not-allowed"
                      >
                        Sold Out
                      </button>
                    ) : inCartItem ? (
                      <div className="flex items-center justify-between bg-gray-900 border border-[#C6EF2E] rounded-xl overflow-hidden p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-9 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <i className="fa-solid fa-minus text-xs"></i>
                        </button>
                        <div className="flex items-center gap-1.5 font-mono text-sm font-black text-[#C6EF2E]">
                          <span>{inCartItem.quantity}</span>
                          <span className="text-[10px] font-sans text-gray-400 font-normal">in tab</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-9 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-full py-2.5 px-4 bg-[#202020] hover:bg-[#C6EF2E] hover:text-black text-white font-bold rounded-xl text-xs transition border border-gray-700 hover:border-[#C6EF2E] cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>Add to Tab</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FLOATING CART BUTTON (BOTTOM RIGHT) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40 animate-bounce-subtle">
          <button
            onClick={() => setIsCartOpen(true)}
            className="px-6 py-4 rounded-3xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-black text-sm shadow-2xl flex items-center gap-3 border-2 border-black/20 transition-all hover:scale-105"
          >
            <div className="w-7 h-7 rounded-full bg-black text-[#C6EF2E] text-xs font-black flex items-center justify-center">
              {totalCartCount}
            </div>
            <span>View Tab & Checkout</span>
            <span className="bg-black/15 px-2 py-0.5 rounded-md text-xs font-black">
              {formatINR(finalTotal)}
            </span>
          </button>
        </div>
      )}

      {/* SLIDE-OVER ORDER TAB / CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm animate-fade-in flex justify-end">
          <div className="relative w-full max-w-md bg-[#141414] border-l border-gray-800 h-full flex flex-col justify-between shadow-2xl">
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E]">
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Your Bar Tab</h3>
                  <p className="text-xs text-gray-400">
                    {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} in tab
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-gray-400 hover:text-white p-2 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Selected Items */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Ordered Items
                </div>
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl p-3.5"
                  >
                    <div className="flex-1 pr-3">
                      <h4 className="text-xs font-bold text-white mb-0.5">{item.name}</h4>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {formatINR(item.price)} each
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-[#1a1b1c] border border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-2 py-1 text-gray-300 hover:text-white cursor-pointer"
                        >
                          <i className="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <span className="px-2 text-xs font-bold text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="px-2 py-1 text-gray-300 hover:text-white cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-[10px]"></i>
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Destination Selector */}
              <div className="border-t border-gray-800 pt-4">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Delivery Destination
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryLocation('COURT_SIDE')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      deliveryLocation === 'COURT_SIDE'
                        ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-[#C6EF2E]'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <i className="fa-solid fa-bolt text-xs mb-1 block"></i>
                    <span className="text-[11px] font-bold">Court-Side</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryLocation('BAR_LOUNGE')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      deliveryLocation === 'BAR_LOUNGE'
                        ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-[#C6EF2E]'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <i className="fa-solid fa-chair text-xs mb-1 block"></i>
                    <span className="text-[11px] font-bold">Lounge Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryLocation('TAKEAWAY')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      deliveryLocation === 'TAKEAWAY'
                        ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-[#C6EF2E]'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <i className="fa-solid fa-bag-shopping text-xs mb-1 block"></i>
                    <span className="text-[11px] font-bold">Takeaway</span>
                  </button>
                </div>

                {deliveryLocation === 'COURT_SIDE' && (
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Select Playing Court:
                    </label>
                    <select
                      value={selectedCourt}
                      onChange={(e) => setSelectedCourt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white focus:outline-none focus:border-[#C6EF2E]"
                    >
                      {COURTS.map((court) => (
                        <option key={court} value={court}>
                          {court}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {deliveryLocation === 'BAR_LOUNGE' && (
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Select Lounge Table:
                    </label>
                    <select
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white focus:outline-none focus:border-[#C6EF2E]"
                    >
                      {TABLES.map((table) => (
                        <option key={table} value={table}>
                          {table}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Special Instructions for Barista */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Chef & Barista Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra chilled, deliver after set 2..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#C6EF2E]"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="border-t border-gray-800 pt-4">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Payment Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('VIRTUAL_CARD')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'VIRTUAL_CARD'
                        ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <i className="fa-solid fa-wallet text-[#C6EF2E]"></i> Virtual Card
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 font-mono">
                      Bal: {formatINR(walletBalance)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COUNTER_OTP')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'COUNTER_OTP'
                        ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <i className="fa-solid fa-mobile-screen-button text-[#C6EF2E]"></i> Counter OTP / Cash
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">Pay at Bar Desk</div>
                  </button>
                </div>

                {paymentMethod === 'VIRTUAL_CARD' && walletBalance < finalTotal && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                    <span>Low balance. Please top up your wallet.</span>
                    <Link to="/wallet" className="font-bold underline text-[#C6EF2E]">
                      Top Up
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer & Checkout Button */}
            <div className="p-5 border-t border-gray-800 bg-[#121314] space-y-3">
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="text-white font-medium font-mono">{formatINR(subtotal)}</span>
                </div>
                {tierDiscountPercent > 0 && (
                  <div className="flex justify-between text-[#C6EF2E] font-semibold">
                    <span>{userTier} Tier Discount ({tierDiscountPercent}%):</span>
                    <span className="font-mono">- {formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-800 pt-1.5 flex justify-between font-black text-white text-base">
                  <span>Total Amount:</span>
                  <span className="text-[#C6EF2E] font-mono">{formatINR(finalTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={
                  isSubmitting ||
                  (paymentMethod === 'VIRTUAL_CARD' && walletBalance < finalTotal)
                }
                className="w-full py-3.5 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] disabled:opacity-50 text-black font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#C6EF2E]/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Sending Order...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Send to Bar & Kitchen ({formatINR(finalTotal)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-ORDER CONFIRMATION MODAL */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#141414] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-2xl mx-auto mb-4">
              <i className="fa-solid fa-bell-concierge"></i>
            </div>

            <h3 className="text-xl font-black text-white">Order Sent to Kitchen!</h3>
            <div className="text-xs text-gray-400 mt-1 mb-4">
              Order <span className="font-mono text-[#C6EF2E] font-bold">{placedOrder.orderNumber}</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left space-y-2 text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Destination:</span>
                <span className="font-bold text-white">
                  {placedOrder.courtNumber || `Table #${placedOrder.tableNumber}` || 'Takeaway'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="px-2 py-0.5 rounded-md bg-[#C6EF2E]/20 text-[#C6EF2E] font-bold text-[10px]">
                  {placedOrder.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated Ready:</span>
                <span className="text-white font-bold">5 – 8 minutes</span>
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between font-black text-sm">
                <span className="text-gray-300">Amount Paid:</span>
                <span className="text-[#C6EF2E] font-mono">{formatINR(placedOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleViewReceipt(placedOrder.id)}
                disabled={loadingReceipt}
                className="py-2.5 px-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-gray-500 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loadingReceipt ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-[#C6EF2E]"></i>
                ) : (
                  <i className="fa-solid fa-receipt text-[#C6EF2E]"></i>
                )}
                <span>View Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPdf(placedOrder.id, placedOrder.orderNumber)}
                disabled={downloadingPdf}
                className="py-2.5 px-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-gray-500 text-xs font-bold text-[#C6EF2E] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-file-pdf"></i>
                )}
                <span>Download PDF</span>
              </button>
            </div>

            <button
              onClick={() => setPlacedOrder(null)}
              className="w-full py-3 rounded-xl bg-[#C6EF2E] hover:bg-[#b0d826] text-black font-extrabold text-sm transition-all cursor-pointer"
            >
              Continue Playing
            </button>
          </div>
        </div>
      )}

      {/* MY RECENT TABS MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#141414] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E]">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">My Bar Tabs History</h3>
                  <p className="text-xs text-gray-400">Recent food & drink orders</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {recentOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No orders placed yet.
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#C6EF2E]">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          order.status === 'SERVED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : order.status === 'READY'
                            ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                            : order.status === 'PREPARING'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="text-gray-300">
                      {order.orderItems?.join(', ') || 'Custom order'}
                    </div>

                    <div className="flex items-center justify-between text-gray-400 pt-1 border-t border-gray-800 text-[11px]">
                      <span>
                        <i className="fa-solid fa-location-dot text-[#C6EF2E] mr-1"></i>
                        {order.courtNumber || (order.tableNumber ? `Table #${order.tableNumber}` : 'Takeaway')}
                      </span>
                      <span className="font-bold text-white font-mono">
                        {formatINR(order.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-800/60">
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(order.id)}
                        disabled={loadingReceipt}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <i className="fa-solid fa-receipt text-[#C6EF2E]"></i>
                        <span>Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(order.id, order.orderNumber)}
                        disabled={downloadingPdf}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-[11px] font-bold text-[#C6EF2E] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <i className="fa-solid fa-file-pdf"></i>
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#141414] border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 flex items-center justify-center text-[#C6EF2E] text-sm">
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Official Cafe Receipt</h3>
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
