import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import VideoModal from './components/layout/VideoModal';
import ScrollProgress from './components/common/ScrollProgress';
import BackToTop from './components/common/BackToTop';

// Pages
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import BookingPage from './pages/BookingPage';
import MembershipPage from './pages/MembershipPage';
import ServicePage from './pages/ServicePage';
import EventPage from './pages/EventPage';
import CoachingPage from './pages/CoachingPage';
import CommunityPage from './pages/CommunityPage';
import FAQPage from './pages/FAQPage';
import BlogPage from './pages/BlogPage';
import ContactPage from './pages/ContactPage';
import AuthPage from './pages/AuthPage';
import FrontDeskPage from './pages/FrontDeskPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AdminPage from './pages/AdminPage';
import ShopAdminPage from './pages/ShopAdminPage';
import BarAdminPage from './pages/BarAdminPage';
import WalletPage from './pages/WalletPage';
import ShopPage from './pages/ShopPage';
import BarMenuPage from './pages/BarMenuPage';
import ProtectedRoute from './components/common/ProtectedRoute';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const handleOpenVideo = (url) => {
    setVideoUrl(url || 'https://www.youtube.com/embed/VhBl3dHT5SY');
    setVideoOpen(true);
  };

  const handleCloseVideo = () => {
    setVideoOpen(false);
    setVideoUrl('');
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ScrollProgress />
      <div className="adelux-app min-h-screen d-flex flex-column">
        {/* Navigation Bar */}
        <Navbar onOpenSidebar={() => setSidebarOpen(true)} />

        {/* Mobile Sidebar Navigation Drawer */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Pages */}
        <div className="flex-grow-1">
          <Routes>
            <Route path="/" element={<HomePage onOpenVideo={handleOpenVideo} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/bar" element={<BarMenuPage />} />
            <Route path="/cafe" element={<BarMenuPage />} />
            <Route path="/membership" element={<MembershipPage />} />
            <Route path="/service" element={<ServicePage />} />
            <Route path="/event" element={<EventPage />} />
            <Route path="/coaching" element={<CoachingPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/register" element={<AuthPage initialMode="register" />} />

            {/* Member Virtual Card & Club Wallet Hub */}
            <Route
              path="/wallet"
              element={
                <ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'SUBADMIN', 'STAFF', 'MEMBER']}>
                  <WalletPage />
                </ProtectedRoute>
              }
            />

            {/* Role-Protected Admin & Department Dashboards */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'SUBADMIN']}>
                  <SuperAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shop-admin"
              element={
                <ProtectedRoute
                  allowedRoles={['SUPERADMIN', 'ADMIN', 'SUBADMIN', 'STAFF']}
                  allowedModules={['shop', 'sports shop']}
                >
                  <ShopAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bar-admin"
              element={
                <ProtectedRoute
                  allowedRoles={['SUPERADMIN', 'ADMIN', 'SUBADMIN', 'STAFF']}
                  allowedModules={['bar', 'cafe']}
                >
                  <BarAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/front-desk"
              element={
                <ProtectedRoute
                  allowedRoles={['SUPERADMIN', 'ADMIN', 'SUBADMIN', 'STAFF']}
                  allowedModules={['front-desk', 'reception', 'operations']}
                >
                  <FrontDeskPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/frontdesk"
              element={
                <ProtectedRoute
                  allowedRoles={['SUPERADMIN', 'ADMIN', 'SUBADMIN', 'STAFF']}
                  allowedModules={['front-desk', 'reception', 'operations']}
                >
                  <FrontDeskPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback to Home */}
            <Route path="*" element={<HomePage onOpenVideo={handleOpenVideo} />} />
          </Routes>
        </div>

        {/* Footer */}
        <Footer />

        {/* Floating Back to Top Button */}
        <BackToTop />

        {/* Global Video Modal */}
        <VideoModal isOpen={videoOpen} videoUrl={videoUrl} onClose={handleCloseVideo} />
      </div>
    </BrowserRouter>
  );
}
