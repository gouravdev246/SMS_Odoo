import { useState, useEffect, useCallback } from 'react';
import PageBanner from '../components/common/PageBanner';
import api from '../services/api';

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'stringing' | 'my_orders'
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState(null);

  // Cart State
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState('PICKUP'); // 'PICKUP' | 'DELIVERY'
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('VIRTUAL_CARD');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Racket Stringing Service State
  const [stringingForm, setStringingForm] = useState({
    racketModel: '',
    sport: 'BADMINTON',
    stringName: 'Yonex BG65 Ti',
    tensionLbs: 26.5,
    urgency: 'EMERGENCY_EXPRESS', // 'EMERGENCY_EXPRESS' | 'STANDARD'
    notes: '',
    paymentMethod: 'VIRTUAL_CARD',
  });
  const [submittingStringing, setSubmittingStringing] = useState(false);
  const [completedStringing, setCompletedStringing] = useState(null);

  // User History State
  const [myOrders, setMyOrders] = useState([]);
  const [myStringingJobs, setMyStringingJobs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // User details
  const [currentUser, setCurrentUser] = useState(api.auth.getUser());
  const membershipTier = currentUser?.membership || 'NONE';

  // Discount percentage by membership tier
  const tierDiscountPercent =
    membershipTier === 'GOLD' ? 30 : membershipTier === 'SILVER' ? 15 : membershipTier === 'JUNIOR' ? 11 : 0;

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 6000);
  };

  // 1. Fetch Products Catalog
  const fetchProducts = useCallback(async (isMounted = true) => {
    try {
      const res = await api.shop.getProducts();
      if (isMounted) {
        if (res?.success && Array.isArray(res.data)) {
          setProducts(res.data);
        } else if (Array.isArray(res)) {
          setProducts(res);
        }
        setLoadingProducts(false);
      }
    } catch (err) {
      if (isMounted) {
        showAlert('error', err.message || 'Failed to load shop catalog');
        setLoadingProducts(false);
      }
    }
  }, []);

  // 2. Fetch User Orders & Stringing History
  const fetchUserHistory = useCallback(async (isMounted = true) => {
    if (!currentUser?.id) return;
    setLoadingHistory(true);
    try {
      const [ordersRes, stringingRes] = await Promise.all([
        api.shop.getUserOrders(currentUser.id).catch(() => ({ data: [] })),
        api.shop.getStringingList({ userID: currentUser.id }).catch(() => ({ requests: [] })),
      ]);

      if (isMounted) {
        if (ordersRes?.success && Array.isArray(ordersRes.data)) {
          setMyOrders(ordersRes.data);
        } else if (Array.isArray(ordersRes)) {
          setMyOrders(ordersRes);
        }

        if (stringingRes?.success && Array.isArray(stringingRes.requests)) {
          setMyStringingJobs(stringingRes.requests);
        }
        setLoadingHistory(false);
      }
    } catch {
      if (isMounted) setLoadingHistory(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadWallet() {
      const user = api.auth.getUser();
      if (!user) return;
      try {
        const walletRes = await api.wallet.getDetails();
        if (isMounted && walletRes?.virtualCard?.balance !== undefined) {
          const freshAmount = Number(walletRes.virtualCard.balance);
          setCurrentUser((prev) => {
            const updated = { ...(prev || {}), amount: freshAmount };
            api.auth.updateUser(updated);
            return updated;
          });
        }
      } catch {
        // ignore
      }
    }

    loadWallet();
    fetchProducts(isMounted);
    fetchUserHistory(isMounted);

    return () => {
      isMounted = false;
    };
  }, [fetchProducts, fetchUserHistory]);

  // Cart Operations
  const addToCart = (product) => {
    if (product.inStock <= 0) {
      showAlert('error', `"${product.name}" is currently out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.inStock) {
          showAlert('error', `Cannot add more. Only ${product.inStock} unit(s) available in stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setShowCartDrawer(true);
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.inStock) {
              showAlert('error', `Max stock limit (${item.product.inStock}) reached.`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Cart Totals
  const cartSubtotal = cart.reduce((sum, item) => sum + Number(item.product.buyPrice) * item.quantity, 0);
  const cartDiscountAmount = Math.round(((cartSubtotal * tierDiscountPercent) / 100) * 100) / 100;
  const cartFinalTotal = Math.max(0, Math.round((cartSubtotal - cartDiscountAmount) * 100) / 100);
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 3. Checkout Submission
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      showAlert('error', 'Your cart is empty.');
      return;
    }

    if (!currentUser?.id) {
      showAlert('error', 'Please log in to complete your checkout.');
      return;
    }

    if (fulfillmentType === 'DELIVERY' && !deliveryAddress.trim()) {
      showAlert('error', 'Please provide a valid delivery address.');
      return;
    }

    // Check virtual card balance if chosen
    const userAmount = Number(currentUser.amount || 0);
    if (paymentMethod === 'VIRTUAL_CARD' && userAmount < cartFinalTotal) {
      showAlert(
        'error',
        `Insufficient virtual card balance (₹${userAmount.toFixed(2)}). Required: ₹${cartFinalTotal.toFixed(2)}. Please top up your wallet.`
      );
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await api.shop.checkout({
        userID: currentUser.id,
        phone: currentUser.phone,
        fulfillmentType,
        deliveryAddress: fulfillmentType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        paymentMethod,
        items: cart.map((item) => ({
          productID: item.product.id,
          quantity: item.quantity,
        })),
      });

      if (res?.success && res.data) {
        setCompletedOrder(res.data);
        setCart([]);
        setShowCartDrawer(false);
        showAlert('success', 'Order placed successfully!');

        // If virtual card was debited, update local balance
        if (paymentMethod === 'VIRTUAL_CARD') {
          const freshBalance = res.walletBalance !== undefined ? Number(res.walletBalance) : Math.max(0, userAmount - cartFinalTotal);
          const updated = { ...currentUser, amount: freshBalance };
          api.auth.updateUser(updated);
          setCurrentUser(updated);
        }

        // Refresh products stock & user history
        await fetchProducts(true);
        await fetchUserHistory(true);
      } else {
        showAlert('error', res?.message || 'Failed to place order.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Checkout failed. Please check stock or try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 4. Racket Stringing Submission
  const handleStringingSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) {
      showAlert('error', 'Please log in to submit a racket stringing request.');
      return;
    }

    if (!stringingForm.racketModel.trim()) {
      showAlert('error', 'Please enter your racket brand and model.');
      return;
    }

    const price = stringingForm.urgency === 'EMERGENCY_EXPRESS' ? 550 : 350;
    const userAmount = Number(currentUser.amount || 0);

    if (stringingForm.paymentMethod === 'VIRTUAL_CARD' && userAmount < price) {
      showAlert(
        'error',
        `Insufficient wallet balance (₹${userAmount.toFixed(2)}). Service fee is ₹${price}. Please top up your card.`
      );
      return;
    }

    setSubmittingStringing(true);
    try {
      const res = await api.shop.createStringing({
        userID: currentUser.id,
        racketModel: stringingForm.racketModel.trim(),
        sport: stringingForm.sport,
        stringName: stringingForm.stringName.trim(),
        tensionLbs: Number(stringingForm.tensionLbs),
        urgency: stringingForm.urgency,
        notes: stringingForm.notes.trim() || undefined,
        paymentMethod: stringingForm.paymentMethod,
      });

      if (res?.success && res.jobCard) {
        setCompletedStringing(res.jobCard);
        showAlert('success', res.message || 'Stringing service request booked!');
        setStringingForm((prev) => ({ ...prev, racketModel: '', notes: '' }));

        if (stringingForm.paymentMethod === 'VIRTUAL_CARD') {
          const freshBalance = res.walletBalance !== undefined ? Number(res.walletBalance) : Math.max(0, userAmount - price);
          const updated = { ...currentUser, amount: freshBalance };
          api.auth.updateUser(updated);
          setCurrentUser(updated);
        }

        await fetchUserHistory(true);
      } else {
        showAlert('error', res?.message || 'Failed to book stringing service.');
      }
    } catch (err) {
      showAlert('error', err.message || 'Failed to book stringing service.');
    } finally {
      setSubmittingStringing(false);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCat = categoryFilter === 'ALL' || p.category?.toUpperCase() === categoryFilter.toUpperCase();
    const matchesSearch =
      !searchQuery.trim() ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <main className="bg-[#0e0e0e] text-white min-h-screen pb-20">
      <PageBanner
        title="Sports Pro Shop & Stringing Center"
        current="Pro Shop"
        bannerClass="banner-inner-about"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        {/* Dismissible Alert */}
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
        {/* TOP NAVIGATION & CART TRIGGER                               */}
        {/* ----------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#141414] p-4 sm:p-5 rounded-2xl border border-gray-800 mb-8">
          {/* Sub-Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all border-0 cursor-pointer flex items-center gap-2 ${
                activeTab === 'catalog'
                  ? 'bg-[#C6EF2E] text-black shadow-md'
                  : 'text-gray-300 hover:text-white bg-[#202020]'
              }`}
            >
              <i className="fa-solid fa-store"></i>
              Pro Gear Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stringing')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all border-0 cursor-pointer flex items-center gap-2 ${
                activeTab === 'stringing'
                  ? 'bg-[#C6EF2E] text-black shadow-md'
                  : 'text-gray-300 hover:text-white bg-[#202020]'
              }`}
            >
              <i className="fa-solid fa-bolt text-amber-400"></i>
              15-Min Racket Stringing
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('my_orders')}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all border-0 cursor-pointer flex items-center gap-2 ${
                  activeTab === 'my_orders'
                    ? 'bg-[#C6EF2E] text-black shadow-md'
                    : 'text-gray-300 hover:text-white bg-[#202020]'
                }`}
              >
                <i className="fa-solid fa-clock-rotate-left"></i>
                My Orders & PINs ({myOrders.length + myStringingJobs.length})
              </button>
            )}
          </div>

          {/* Right Action: Member Tier Badge & Cart Button */}
          <div className="flex items-center gap-3">
            {tierDiscountPercent > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C6EF2E]/10 border border-[#C6EF2E]/30 text-[#C6EF2E] text-xs font-bold font-mono">
                <i className="fa-solid fa-tag"></i>
                {membershipTier} Tier: {tierDiscountPercent}% Off
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowCartDrawer(true)}
              className="px-4 py-2 bg-[#202020] hover:bg-[#282828] border border-gray-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2.5 cursor-pointer relative"
            >
              <i className="fa-solid fa-cart-shopping text-[#C6EF2E]"></i>
              <span>Cart</span>
              {totalCartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#C6EF2E] text-black font-extrabold text-[11px] flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* TAB 1: PRO GEAR CATALOG                                     */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            {/* Category Filter Chips & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#141414] p-4 rounded-xl border border-gray-800">
              <div className="flex flex-wrap gap-2">
                {['ALL', 'RACKETS', 'BALLS', 'FOOTWEAR', 'STRINGS'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-[#C6EF2E] text-black'
                        : 'bg-[#202020] text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Equipment' : cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-gray-500 text-xs"></i>
                <input
                  type="text"
                  placeholder="Search rackets, balls, strings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#202020] border border-gray-700 text-white rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#C6EF2E] w-56 sm:w-72"
                />
              </div>
            </div>

            {/* Products Grid */}
            {loadingProducts ? (
              <div className="py-20 text-center text-gray-400">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#C6EF2E] mb-3"></i>
                <p className="text-sm">Loading pro shop inventory...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center text-gray-500 bg-[#141414] rounded-2xl border border-gray-800">
                <i className="fa-solid fa-boxes-packing text-4xl mb-3 text-gray-600"></i>
                <p className="text-base font-bold text-gray-300">No equipment found</p>
                <p className="text-xs text-gray-500 mt-1">Try resetting the category filter or search term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((p) => {
                  const buyPrice = Number(p.buyPrice);
                  const memberPrice =
                    tierDiscountPercent > 0
                      ? Math.round(buyPrice * (1 - tierDiscountPercent / 100))
                      : buyPrice;

                  return (
                    <div
                      key={p.id}
                      className="bg-[#141414] rounded-2xl border border-gray-800 hover:border-gray-700 transition flex flex-col justify-between overflow-hidden group p-5 space-y-4"
                    >
                      {/* Product Header / Category */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-300 font-mono">
                            {p.category}
                          </span>
                          {p.inStock > 0 ? (
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              {p.inStock} in stock
                            </span>
                          ) : (
                            <span className="text-[11px] text-rose-400 flex items-center gap-1 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                              Out of stock
                            </span>
                          )}
                        </div>

                        {/* Product Icon Mockup */}
                        <div className="w-full h-36 bg-[#1a1a1a] rounded-xl flex items-center justify-center text-gray-600 group-hover:text-[#C6EF2E] transition border border-gray-800/60 mb-4">
                          <i
                            className={`fa-solid ${
                              p.category === 'RACKETS'
                                ? 'fa-table-tennis-paddle-ball text-5xl'
                                : p.category === 'BALLS'
                                ? 'fa-baseball text-5xl'
                                : p.category === 'STRINGS'
                                ? 'fa-lines-leaning text-5xl'
                                : 'fa-shoe-prints text-5xl'
                            }`}
                          ></i>
                        </div>

                        {/* Product Title */}
                        <h4 className="font-bold text-white text-sm line-clamp-2 leading-snug">{p.name}</h4>
                        {p.size && <p className="text-[11px] text-gray-400 mt-1">Size/Spec: {p.size}</p>}
                      </div>

                      {/* Pricing & Add to Cart */}
                      <div className="pt-3 border-t border-gray-800/80">
                        <div className="flex items-baseline justify-between mb-3">
                          <div>
                            {tierDiscountPercent > 0 ? (
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-extrabold text-[#C6EF2E] font-mono">
                                  ₹{memberPrice.toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-500 line-through font-mono">
                                  ₹{buyPrice.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-lg font-extrabold text-white font-mono">
                                ₹{buyPrice.toLocaleString()}
                              </span>
                            )}
                            {tierDiscountPercent > 0 && (
                              <span className="text-[10px] text-emerald-400 font-semibold block">
                                Member Price ({tierDiscountPercent}% Off)
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={p.inStock <= 0}
                          onClick={() => addToCart(p)}
                          className="w-full py-2.5 px-4 bg-[#202020] hover:bg-[#C6EF2E] hover:text-black text-white font-bold rounded-xl text-xs transition border border-gray-700 hover:border-[#C6EF2E] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-[#202020] disabled:hover:text-white"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          {p.inStock > 0 ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 2: RACKET STRINGING SERVICE (PRD SCENE 3)               */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'stringing' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Hero & Explainer (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#141414] p-6 sm:p-7 rounded-3xl border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="text-xs uppercase font-semibold text-amber-400 tracking-wider">
                    Court-Side Service Desk
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white leading-tight">
                  15-Minute Emergency Racket Stringing
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  String snapped ten minutes before a crucial match? Hand your racket to our pro stringers. We string
                  and tension on electronic constant-pull machines with a guaranteed 15-to-20 minute turnaround so you
                  never miss your court slot.
                </p>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="bg-[#1c1c1c] p-3.5 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">⚡ Emergency Express</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹550</span>
                    <span className="text-[10px] text-gray-400">15–20 min court turnaround</span>
                  </div>
                  <div className="bg-[#1c1c1c] p-3.5 rounded-xl border border-gray-800">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Standard Turnaround</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹350</span>
                    <span className="text-[10px] text-gray-400">Next-day pickup (24 hrs)</span>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-800 text-xs text-gray-400 space-y-2">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-[#C6EF2E] text-xs"></i>
                    <span>Tension accuracy ±0.5 lbs with 4-knot patterns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-[#C6EF2E] text-xs"></i>
                    <span>Seamless cardless payment via Club Virtual Card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-check text-[#C6EF2E] text-xs"></i>
                    <span>Automated SMS / Email alert the moment it's ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Booking Form (7 Cols) */}
            <div className="lg:col-span-7 bg-[#141414] p-6 sm:p-8 rounded-3xl border border-gray-800">
              <h4 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <i className="fa-solid fa-wrench text-[#C6EF2E]"></i>
                Log a Stringing Service Job Card
              </h4>
              <p className="text-xs text-gray-400 mb-6">
                Fill in your equipment details and desired tension. Hand over your racket at the Pro Shop counter.
              </p>

              <form onSubmit={handleStringingSubmit} className="space-y-4 text-xs">
                {/* Racket Model */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Racket Brand & Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yonex Astrox 88D Pro, Babolat Pure Aero, Head Speed..."
                    value={stringingForm.racketModel}
                    onChange={(e) => setStringingForm({ ...stringingForm, racketModel: e.target.value })}
                    className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#C6EF2E]"
                  />
                </div>

                {/* Sport & String Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 font-semibold mb-1">Sport Facility *</label>
                    <select
                      value={stringingForm.sport}
                      onChange={(e) => setStringingForm({ ...stringingForm, sport: e.target.value })}
                      className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C6EF2E]"
                    >
                      <option value="BADMINTON">Badminton</option>
                      <option value="TENNIS">Tennis</option>
                      <option value="PADEL_COURT">Padel / Squash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 font-semibold mb-1">String Brand / Model *</label>
                    <select
                      value={stringingForm.stringName}
                      onChange={(e) => setStringingForm({ ...stringingForm, stringName: e.target.value })}
                      className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C6EF2E]"
                    >
                      <option value="Yonex BG65 Ti">Yonex BG65 Ti (Titanium Power)</option>
                      <option value="Yonex Aerobite">Yonex Aerobite (Spin & Control)</option>
                      <option value="Yonex Nanogy 98">Yonex Nanogy 98 (Repulsion)</option>
                      <option value="Babolat RPM Blast 16">Babolat RPM Blast 16G (Heavy Spin)</option>
                      <option value="Wilson Sensation 16">Wilson Sensation 16 (Arm Comfort)</option>
                      <option value="Luxilon ALU Power 125">Luxilon ALU Power 125 (Tour Power)</option>
                      <option value="Own Strings Supplied">Own Strings Supplied (Labor Only)</option>
                    </select>
                  </div>
                </div>

                {/* Desired Tension (lbs) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-gray-300 font-semibold">Desired String Tension (lbs) *</label>
                    <span className="font-mono text-sm font-bold text-[#C6EF2E]">
                      {stringingForm.tensionLbs} lbs
                    </span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="35"
                    step="0.5"
                    value={stringingForm.tensionLbs}
                    onChange={(e) => setStringingForm({ ...stringingForm, tensionLbs: parseFloat(e.target.value) })}
                    className="w-full accent-[#C6EF2E] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5">
                    <span>18 lbs (Soft Control)</span>
                    <span>26 lbs (Club Standard)</span>
                    <span>35 lbs (Pro Tight)</span>
                  </div>
                </div>

                {/* Service Urgency Selector */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-2">Service Urgency *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        stringingForm.urgency === 'EMERGENCY_EXPRESS'
                          ? 'bg-amber-950/30 border-amber-500 text-white shadow-lg'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="urgency"
                          checked={stringingForm.urgency === 'EMERGENCY_EXPRESS'}
                          onChange={() => setStringingForm({ ...stringingForm, urgency: 'EMERGENCY_EXPRESS' })}
                          className="text-amber-400"
                        />
                        <div>
                          <div className="font-bold text-white text-xs">⚡ 15-Minute Emergency</div>
                          <div className="text-[10px] text-amber-400">Ready in 20 mins for match</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-white">₹550</span>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        stringingForm.urgency === 'STANDARD'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white shadow-lg'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="urgency"
                          checked={stringingForm.urgency === 'STANDARD'}
                          onChange={() => setStringingForm({ ...stringingForm, urgency: 'STANDARD' })}
                          className="text-[#C6EF2E]"
                        />
                        <div>
                          <div className="font-bold text-white text-xs">Standard Service</div>
                          <div className="text-[10px] text-gray-400">Next-day pickup (24 hours)</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-white">₹350</span>
                    </label>
                  </div>
                </div>

                {/* Player Notes */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Custom Stringing Notes <span className="text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 4-knots pattern, extra dampener, stencil logo..."
                    value={stringingForm.notes}
                    onChange={(e) => setStringingForm({ ...stringingForm, notes: e.target.value })}
                    className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-[#C6EF2E]"
                  />
                </div>

                {/* Payment Inflow Mode */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                        stringingForm.paymentMethod === 'VIRTUAL_CARD'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="stringingPay"
                        checked={stringingForm.paymentMethod === 'VIRTUAL_CARD'}
                        onChange={() => setStringingForm({ ...stringingForm, paymentMethod: 'VIRTUAL_CARD' })}
                        className="text-[#C6EF2E]"
                      />
                      <div>
                        <div className="font-bold text-xs text-white">Club Virtual Card</div>
                        <div className="text-[10px] text-gray-400">
                          Bal: ₹{Number(currentUser?.amount || 0).toFixed(0)}
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                        stringingForm.paymentMethod === 'UPI'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="stringingPay"
                        checked={stringingForm.paymentMethod === 'UPI'}
                        onChange={() => setStringingForm({ ...stringingForm, paymentMethod: 'UPI' })}
                        className="text-[#C6EF2E]"
                      />
                      <div>
                        <div className="font-bold text-xs text-white">Counter UPI / Card</div>
                        <div className="text-[10px] text-gray-400">Pay at pickup desk</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingStringing}
                    className="w-full py-3 bg-[#C6EF2E] hover:bg-[#b0d825] text-black font-extrabold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#C6EF2E]/10 disabled:opacity-50"
                  >
                    {submittingStringing ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <span>Registering Job Card...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-wrench"></i>
                        <span>
                          Submit Service Request (₹{stringingForm.urgency === 'EMERGENCY_EXPRESS' ? '550' : '350'})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 3: MY ORDERS & STRINGING JOBS                           */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'my_orders' && (
          <div className="space-y-8">
            {/* 1. Pro Shop Orders */}
            <div className="bg-[#141414] p-6 sm:p-7 rounded-3xl border border-gray-800">
              <h4 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <i className="fa-solid fa-bag-shopping text-[#C6EF2E]"></i>
                My Pro Shop Purchases & Counter Pickup PINs
              </h4>
              <p className="text-xs text-gray-400 mb-5">
                Present your 4-digit pickup PIN at the counter to collect your packed equipment.
              </p>

              {loadingHistory ? (
                <div className="p-8 text-center text-gray-400">
                  <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#C6EF2E] mb-2"></i>
                  <p className="text-xs">Loading orders...</p>
                </div>
              ) : myOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-[#181818] rounded-2xl border border-gray-800/80">
                  <p className="text-sm font-semibold text-gray-400">No shop orders found</p>
                  <p className="text-xs text-gray-600 mt-1">Browse our gear catalog and add items to your cart.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1c1c1c] text-gray-400 font-semibold uppercase tracking-wider text-[10px] border-b border-gray-800">
                        <th className="py-3 px-4">Order ID & Date</th>
                        <th className="py-3 px-3">Items Ordered</th>
                        <th className="py-3 px-3">Fulfillment</th>
                        <th className="py-3 px-3">Counter PIN / Address</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Total Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 text-gray-300">
                      {myOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#1a1a1a]">
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <div className="font-bold text-white">#{order.id.slice(0, 8)}</div>
                            <div className="text-gray-500 text-[10px]">
                              {new Date(order.purchaseDate || order.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate text-gray-300">
                            {Array.isArray(order.items) ? order.items.join(', ') : 'Equipment Order'}
                          </td>
                          <td className="py-3 px-3 font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                                order.fulfillmentType === 'PICKUP'
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              }`}
                            >
                              {order.fulfillmentType}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {order.pickupCode ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-base font-extrabold text-[#C6EF2E] tracking-widest bg-[#222] px-2.5 py-1 rounded-lg border border-[#C6EF2E]/40">
                                  {order.pickupCode}
                                </span>
                                <span className="text-[10px] text-gray-400">(Pickup PIN)</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px] truncate block max-w-xs">
                                {order.deliveryAddress || 'Home Delivery'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                order.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : order.status === 'READY_FOR_PICKUP'
                                  ? 'bg-[#C6EF2E]/10 text-[#C6EF2E] border border-[#C6EF2E]/30 animate-pulse'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            ₹{Number(order.totalAmount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Stringing Jobs */}
            <div className="bg-[#141414] p-6 sm:p-7 rounded-3xl border border-gray-800">
              <h4 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <i className="fa-solid fa-wrench text-amber-400"></i>
                My Racket Stringing Job Cards
              </h4>
              <p className="text-xs text-gray-400 mb-5">
                Track constant-pull electronic stringing status and ready timestamps.
              </p>

              {myStringingJobs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-[#181818] rounded-2xl border border-gray-800/80">
                  <p className="text-sm font-semibold text-gray-400">No active stringing jobs</p>
                  <p className="text-xs text-gray-600 mt-1">Book an emergency express or standard stringing service.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1c1c1c] text-gray-400 font-semibold uppercase tracking-wider text-[10px] border-b border-gray-800">
                        <th className="py-3 px-4">Racket & Sport</th>
                        <th className="py-3 px-3">String & Tension</th>
                        <th className="py-3 px-3">Urgency</th>
                        <th className="py-3 px-3">Ready By</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Fee Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 text-gray-300">
                      {myStringingJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-[#1a1a1a]">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{job.racketModel}</div>
                            <div className="text-[10px] text-gray-400">{job.sport}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-gray-300">{job.stringName}</div>
                            <div className="font-mono text-emerald-400 text-[11px] font-bold">
                              {job.tensionLbs} lbs
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                job.urgency === 'EMERGENCY_EXPRESS'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {job.urgency === 'EMERGENCY_EXPRESS' ? '⚡ 15-MIN EXPRESS' : 'STANDARD (24H)'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-gray-300">
                            {job.estimatedReady ? new Date(job.estimatedReady).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                job.status === 'READY_FOR_PICKUP'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse'
                                  : job.status === 'IN_PROGRESS'
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                                  : job.status === 'COLLECTED'
                                  ? 'bg-gray-700/30 text-gray-400 border border-gray-700'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            ₹{Number(job.price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SLIDE-OVER SHOPPING CART DRAWER                               */}
      {/* ------------------------------------------------------------- */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#141414] border-l border-gray-800 w-full max-w-md h-full flex flex-col justify-between shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-cart-shopping text-[#C6EF2E] text-lg"></i>
                  <h3 className="text-lg font-bold text-white">Your Shopping Cart ({totalCartCount})</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCartDrawer(false)}
                  className="text-gray-400 hover:text-white cursor-pointer p-1"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              {/* Items List */}
              {cart.length === 0 ? (
                <div className="py-16 text-center text-gray-500 space-y-2">
                  <i className="fa-solid fa-cart-arrow-down text-4xl text-gray-600 mb-2"></i>
                  <p className="text-sm font-semibold text-gray-400">Your cart is currently empty</p>
                  <p className="text-xs text-gray-600">Explore our pro shop catalog and add items to your cart.</p>
                </div>
              ) : (
                <div className="space-y-3 divide-y divide-gray-800/60 max-h-[40vh] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="pt-3 flex items-start justify-between gap-3 text-xs">
                      <div className="flex-1">
                        <div className="font-bold text-white">{item.product.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          ₹{Number(item.product.buyPrice).toLocaleString()} each
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-2 bg-[#202020] px-2 py-1 rounded-lg border border-gray-700">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="text-gray-400 hover:text-white cursor-pointer px-1"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-white text-xs px-1">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="text-gray-400 hover:text-white cursor-pointer px-1"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-gray-500 hover:text-rose-400 cursor-pointer p-1"
                        title="Remove item"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer Footer: Fulfillment, Payment, & Place Order */}
            {cart.length > 0 && (
              <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-4 border-t border-gray-800 text-xs">
                {/* Fulfillment Choice */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Fulfillment Mode *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('PICKUP')}
                      className={`py-2 px-3 rounded-xl font-bold transition border cursor-pointer text-left flex items-center gap-2 ${
                        fulfillmentType === 'PICKUP'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400'
                      }`}
                    >
                      <i className="fa-solid fa-store text-xs text-[#C6EF2E]"></i>
                      <div>
                        <div className="text-xs">Click & Collect</div>
                        <div className="text-[10px] text-gray-400">4-digit counter PIN</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFulfillmentType('DELIVERY')}
                      className={`py-2 px-3 rounded-xl font-bold transition border cursor-pointer text-left flex items-center gap-2 ${
                        fulfillmentType === 'DELIVERY'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400'
                      }`}
                    >
                      <i className="fa-solid fa-truck text-xs text-sky-400"></i>
                      <div>
                        <div className="text-xs">Home Delivery</div>
                        <div className="text-[10px] text-gray-400">Direct to door</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Delivery Address Input if Delivery chosen */}
                {fulfillmentType === 'DELIVERY' && (
                  <div>
                    <label className="block text-gray-300 font-semibold mb-1">Delivery Address *</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Enter flat/villa number, street, city..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-gray-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C6EF2E]"
                    />
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                        paymentMethod === 'VIRTUAL_CARD'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shopPayment"
                        checked={paymentMethod === 'VIRTUAL_CARD'}
                        onChange={() => setPaymentMethod('VIRTUAL_CARD')}
                        className="text-[#C6EF2E]"
                      />
                      <div>
                        <div className="font-bold text-xs text-white">Club Wallet</div>
                        <div className="text-[10px] text-gray-400">
                          Bal: ₹{Number(currentUser?.amount || 0).toFixed(0)}
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2 ${
                        paymentMethod === 'UPI'
                          ? 'bg-[#C6EF2E]/10 border-[#C6EF2E] text-white'
                          : 'bg-[#1c1c1c] border-gray-800 text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shopPayment"
                        checked={paymentMethod === 'UPI'}
                        onChange={() => setPaymentMethod('UPI')}
                        className="text-[#C6EF2E]"
                      />
                      <div>
                        <div className="font-bold text-xs text-white">UPI / Card</div>
                        <div className="text-[10px] text-gray-400">Instant gateway</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Order Summary Box */}
                <div className="bg-[#1c1c1c] p-3 rounded-xl border border-gray-800 space-y-1.5">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal:</span>
                    <span className="font-mono text-white">₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  {tierDiscountPercent > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>{membershipTier} Tier Discount ({tierDiscountPercent}%):</span>
                      <span className="font-mono">-₹{cartDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-white border-t border-gray-800 pt-1.5 mt-1">
                    <span>Total Amount:</span>
                    <span className="font-mono text-[#C6EF2E] text-base">₹{cartFinalTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Submit Checkout Button */}
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="w-full py-3 bg-[#C6EF2E] hover:bg-[#b0d825] text-black font-extrabold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#C6EF2E]/10 disabled:opacity-50"
                >
                  {submittingOrder ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Processing Order...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-bag-shopping"></i>
                      <span>Place Order • ₹{cartFinalTotal.toFixed(2)}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ORDER PLACED RECEIPT WITH COUNTER PIN                  */}
      {/* ------------------------------------------------------------- */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
              <i className="fa-solid fa-check"></i>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Order Confirmed!</h3>
              <p className="text-xs text-gray-400 mt-1">
                Order #{completedOrder.id.slice(0, 8)} • Paid ₹{Number(completedOrder.totalAmount).toFixed(2)}
              </p>
            </div>

            {/* If Pickup: Big Highlight of 4-Digit PIN */}
            {completedOrder.pickupCode ? (
              <div className="bg-[#1c1c1c] border border-[#C6EF2E]/50 p-5 rounded-2xl space-y-2">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                  Counter Pickup Verification PIN
                </span>
                <div className="font-mono text-4xl sm:text-5xl font-black text-[#C6EF2E] tracking-widest my-2">
                  {completedOrder.pickupCode}
                </div>
                <p className="text-[11px] text-gray-400">
                  Present this 4-digit PIN at the Pro Shop counter to claim your packed equipment.
                </p>
              </div>
            ) : (
              <div className="bg-[#1c1c1c] border border-gray-800 p-4 rounded-2xl text-left text-xs space-y-1">
                <span className="text-gray-400 block font-semibold">Delivery Destination:</span>
                <p className="text-white font-medium">{completedOrder.deliveryAddress}</p>
                <span className="text-[11px] text-sky-400 block pt-1">
                  Our courier team will dispatch your gear shortly.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setCompletedOrder(null);
                setActiveTab('my_orders');
              }}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              View in My Orders
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RACKET STRINGING RECEIPT                               */}
      {/* ------------------------------------------------------------- */}
      {completedStringing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-3xl mx-auto">
              <i className="fa-solid fa-wrench"></i>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Stringing Job Card Created!</h3>
              <p className="text-xs text-gray-400 mt-1">
                Job #{completedStringing.id.slice(0, 8)} • Fee: ₹{Number(completedStringing.price).toFixed(2)}
              </p>
            </div>

            <div className="bg-[#1c1c1c] border border-gray-800 p-4 rounded-2xl text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Racket:</span>
                <span className="font-bold text-white">{completedStringing.racketModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">String & Tension:</span>
                <span className="font-mono text-[#C6EF2E] font-bold">
                  {completedStringing.stringName} @ {completedStringing.tensionLbs} lbs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Service Urgency:</span>
                <span className="font-bold text-amber-400">
                  {completedStringing.urgency === 'EMERGENCY_EXPRESS' ? '⚡ 15-Minute Express' : 'Standard'}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-1.5">
                <span className="text-gray-400">Estimated Ready:</span>
                <span className="font-mono text-white font-bold">
                  {completedStringing.estimatedReady ? new Date(completedStringing.estimatedReady).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '20 mins'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Please hand over your racket at the Pro Shop service counter. We will notify you via email when strung!
            </p>

            <button
              type="button"
              onClick={() => {
                setCompletedStringing(null);
                setActiveTab('my_orders');
              }}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              Track in My Orders
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
