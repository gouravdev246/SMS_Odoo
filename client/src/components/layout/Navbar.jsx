import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { getDashboardRoute, getRoleBadge } from '../../utils/roleRedirect';

export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = api.auth.getUser();
  const roleBadge = getRoleBadge(currentUser);
  const dashboardRoute = getDashboardRoute(currentUser);
  const isAdminOrSuperAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN');

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await api.auth.logout();
    navigate('/login');
  };

  return (
    <header>
      <div className="navbar-container">
        <div className="hero-container navbar-hero-container">
          <nav className="navbar navbar-expand-xl">
            <div className="navbar-nav-container">
              {/* Logo Container */}
              <div className="logo-container">
                <Link className="navbar-brand fw-bold" to="/">
                  <img
                    src="/assets/images/Adelux-Logo.png"
                    alt="Adelux Logo"
                    className="img-fluid"
                    style={{ maxHeight: '48px', objectFit: 'contain' }}
                  />
                </Link>
              </div>

              {/* Nav Link Buttons Container */}
              <div className="nav-link-container">
                <nav className="navbar-nav-links" aria-label="Main Navigation">
                  <Link
                    to="/"
                    className={`nav-link-btn ${isActive('/') ? 'active' : ''}`}
                  >
                    Home
                  </Link>

                  {/* Hide Book Court for Admin / Super Admin, show for Member / Guest */}
                  {!isAdminOrSuperAdmin && (
                    <Link
                      to="/booking"
                      className={`nav-link-btn ${isActive('/booking') ? 'active' : ''}`}
                    >
                      Book Court
                    </Link>
                  )}

                  <Link
                    to="/shop"
                    className={`nav-link-btn ${isActive('/shop') ? 'active' : ''}`}
                  >
                    Pro Shop
                  </Link>
                  <Link
                    to="/bar"
                    className={`nav-link-btn ${isActive('/bar') || isActive('/cafe') ? 'active' : ''}`}
                  >
                    Court Bar
                  </Link>
                  <Link
                    to="/about"
                    className={`nav-link-btn ${isActive('/about') ? 'active' : ''}`}
                  >
                    About Us
                  </Link>
                  <Link
                    to="/contact"
                    className={`nav-link-btn ${isActive('/contact') ? 'active' : ''}`}
                  >
                    Contact Us
                  </Link>

                  {/* Role-Specific Portal Navigation */}
                  {currentUser && currentUser.role === 'SUPERADMIN' && (
                    <Link
                      to="/super-admin"
                      className={`nav-link-btn ${isActive('/super-admin') ? 'active' : ''}`}
                    >
                      <i className="fa-solid fa-chart-pie mr-1 text-lime-400"></i>
                      Super Admin
                    </Link>
                  )}

                  {currentUser && currentUser.role === 'ADMIN' && (
                    <Link
                      to="/admin"
                      className={`nav-link-btn ${isActive('/admin') ? 'active' : ''}`}
                    >
                      <i className="fa-solid fa-gauge-high mr-1 text-lime-400"></i>
                      Admin
                    </Link>
                  )}

                  {currentUser && (currentUser.role === 'SUBADMIN' || currentUser.role === 'STAFF') && (
                    <Link
                      to={dashboardRoute}
                      className={`nav-link-btn ${isActive(dashboardRoute) ? 'active' : ''}`}
                    >
                      <i className="fa-solid fa-briefcase mr-1 text-lime-400"></i>
                      {roleBadge?.title || 'Dashboard'}
                    </Link>
                  )}

                  {currentUser && (
                    <Link
                      to="/wallet"
                      className={`nav-link-btn ${isActive('/wallet') ? 'active' : ''}`}
                    >
                      <i className="fa-solid fa-wallet mr-1 text-lime-400"></i>
                      Wallet
                    </Link>
                  )}

                  {!currentUser && (
                    <Link
                      to="/login"
                      className={`nav-link-btn ${isActive('/login') || isActive('/register') ? 'active' : ''}`}
                    >
                      Login / Register
                    </Link>
                  )}
                </nav>
              </div>

              {/* Mobile Hamburger Toggle Button */}
              <button
                className="nav-btn"
                type="button"
                onClick={onOpenSidebar}
                aria-label="Open mobile menu"
              >
                <i className="fa-solid fa-bars-staggered"></i>
              </button>

              {/* Navbar Right Actions / CTA Container */}
              <div className="navbar-cta-container">
                <div className="d-flex align-items-center gap-2">
                  {currentUser ? (
                    <div className="d-flex align-items-center gap-2">
                      <div className="text-right d-none d-md-block">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                          <span className="w-2 h-2 rounded-full bg-lime-400"></span>
                          {currentUser.name || 'Member'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {roleBadge?.title || currentUser.role}
                        </div>
                      </div>

                      <Link
                        to="/wallet"
                        className="btn-auth-nav text-xs py-1.5 px-2.5 flex items-center gap-1.5 border border-[#C6EF2E]/40 text-[#C6EF2E] hover:bg-[#C6EF2E]/10 rounded-xl"
                        title="Club Wallet & Prepaid Balance"
                      >
                        <i className="fa-solid fa-wallet text-xs"></i>
                        <span className="font-mono font-bold">
                          ₹{Number(currentUser.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="btn-auth-nav text-xs py-1.5 px-3 hover:text-rose-400"
                        title="Sign Out"
                      >
                        <i className="fa-solid fa-arrow-right-from-bracket mr-1"></i>
                        <span>Logout</span>
                      </button>

                      {/* Hide Book Court for Admin / Super Admin, show for Member */}
                      {!isAdminOrSuperAdmin && (
                        <Link to="/booking" className="btn btn-accent">
                          <span className="btn-title">Book Court</span>
                          <span className="icon-circle">
                            <i className="fa-solid fa-arrow-right"></i>
                          </span>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* <Link
                        to="/login"
                        className="btn-auth-nav"
                        title="Sign In or Register"
                      >
                        <i className="fa-regular fa-user mr-1.5"></i>
                        <span>Login</span>
                      </Link> */}
                      <Link to="/membership" className="btn btn-accent">
                        <span className="btn-title">Join The Club</span>
                        <span className="icon-circle">
                          <i className="fa-solid fa-arrow-right"></i>
                        </span>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
