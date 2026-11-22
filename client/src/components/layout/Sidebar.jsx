import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

export default function Sidebar({ isOpen, onClose }) {
  const [morePagesOpen, setMorePagesOpen] = useState(false);
  const currentUser = api.auth.getUser();
  const isAdminOrSuperAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN');

  return (
    <aside>
      <div>
        {/* Overlay */}
        <div
          className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
          onClick={onClose}
        ></div>

        {/* Sidebar Panel */}
        <div className={`sidebar ${isOpen ? 'active' : ''}`}>
          <div className="sidebar-header">
            <div className="logo">
              <Link to="/" onClick={onClose}>
                <img
                  src="/assets/images/Adelux-Black-Logo.png"
                  className="logo"
                  alt="Adelux Logo"
                  style={{ maxHeight: '42px', objectFit: 'contain' }}
                />
              </Link>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close sidebar">
              <span>X</span>
            </button>
          </div>

          <ul className="menu">
            <li>
              <Link to="/" onClick={onClose}>
                Home
              </Link>
            </li>
            {!isAdminOrSuperAdmin && (
              <li>
                <Link to="/booking" onClick={onClose}>
                  Book Court
                </Link>
              </li>
            )}
            <li>
              <Link to="/shop" onClick={onClose}>
                <i className="fa-solid fa-store mr-2 text-[#C6EF2E]"></i>
                Pro Shop & Stringing
              </Link>
            </li>
            <li>
              <Link to="/bar" onClick={onClose}>
                <i className="fa-solid fa-utensils mr-2 text-[#C6EF2E]"></i>
                Court-Side Bar & Cafe
              </Link>
            </li>
            <li>
              <Link to="/about" onClick={onClose}>
                About Us
              </Link>
            </li>
            <li>
              <Link to="/contact" onClick={onClose}>
                Contact Us
              </Link>
            </li>
            {currentUser && currentUser.role === 'SUPERADMIN' && (
              <li>
                <Link to="/super-admin" onClick={onClose} className="text-[#C6EF2E] font-bold">
                  <i className="fa-solid fa-chart-pie mr-2 text-[#C6EF2E]"></i>
                  Super Admin Portal
                </Link>
              </li>
            )}
            {currentUser && currentUser.role === 'ADMIN' && (
              <li>
                <Link to="/admin" onClick={onClose} className="text-[#C6EF2E] font-bold">
                  <i className="fa-solid fa-gauge-high mr-2 text-[#C6EF2E]"></i>
                  Admin Console
                </Link>
              </li>
            )}
            <li>
              <Link to="/front-desk" onClick={onClose}>
                Front Desk Operations
              </Link>
            </li>
            <li>
              <Link to="/wallet" onClick={onClose}>
                <i className="fa-solid fa-wallet mr-2 text-[#C6EF2E]"></i>
                Club Wallet & Virtual Card
              </Link>
            </li>
            <li>
              <Link to="/login" onClick={onClose} className="text-[#000000] font-bold">
                <i className="fa-regular fa-user mr-2 text-[#C6EF2E]"></i>
                Login / Register
              </Link>
            </li>

            {/* More Pages Dropdown */}
            <li className="sidebar-dropdown">
              <div
                className="dropdown-header d-flex justify-content-between align-items-center cursor-pointer"
                onClick={() => setMorePagesOpen(!morePagesOpen)}
              >
                <span>More Pages</span>
                <button
                  type="button"
                  className="sidebar-dropdown-btn bg-transparent border-0"
                  aria-label="Toggle pages menu"
                >
                  <i
                    className={`fa-solid fa-angle-down transition-transform duration-200 ${
                      morePagesOpen ? 'rotate-180' : ''
                    }`}
                  ></i>
                </button>
              </div>
              {morePagesOpen && (
                <ul className="sidebar-dropdown-menu ps-4 pt-2">
                  <li className="py-1">
                    <Link to="/service" onClick={onClose}>
                      Our Services
                    </Link>
                  </li>
                  <li className="py-1">
                    <Link to="/event" onClick={onClose}>
                      Tournaments & Events
                    </Link>
                  </li>
                  <li className="py-1">
                    <Link to="/membership" onClick={onClose}>
                      Membership
                    </Link>
                  </li>
                  <li className="py-1">
                    <Link to="/coaching" onClick={onClose}>
                      Coaching & Academy
                    </Link>
                  </li>
                  <li className="py-1">
                    <Link to="/community" onClick={onClose}>
                      Community
                    </Link>
                  </li>
                  <li className="py-1">
                    <Link to="/faq" onClick={onClose}>
                      FAQ
                    </Link>
                  </li>
                  <li className="py-1">
                    <Link to="/blog" onClick={onClose}>
                      Blog
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>

          <div className="p-3 mt-4 d-flex flex-column gap-2">
            {!isAdminOrSuperAdmin && (
              <Link
                to="/booking"
                onClick={onClose}
                className="btn btn-accent w-100 justify-content-center text-center"
              >
                <span className="btn-title">Book a Court</span>
                <span className="icon-circle">
                  <i className="fa-solid fa-arrow-right"></i>
                </span>
              </Link>
            )}
            <Link
              to="/login"
              onClick={onClose}
              className="btn btn-accent bg-accent-color-6 w-100 justify-content-center text-center"
            >
              <span className="btn-title">Member Login</span>
              <span className="icon-circle">
                <i className="fa-solid fa-arrow-right"></i>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
