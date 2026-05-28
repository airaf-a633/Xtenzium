import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { useState, useEffect } from 'react';

// Public components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CustomCursor from './components/CustomCursor';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';

// Public pages
import Home from './pages/Home';
import Strategy from './pages/Strategy';
import Electronics from './pages/Electronics';
import Team from './pages/Team';
import About from './pages/About';
import Services from './pages/Services';
import Blogs from './pages/Blogs';

// Service sub-pages
import Consultancy from './pages/services/Consultancy';
import Marketing from './pages/services/Marketing';
import Design from './pages/services/Design';
import Technical from './pages/services/Technical';
import Development from './pages/services/Development';
import IoT from './pages/services/IoT';

// Admin pages
import Login from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Leads from './pages/admin/leads/Leads';
import LeadDetail from './pages/admin/leads/LeadDetail';
import AdminBlogs from './pages/admin/blogs/Blogs';
import BlogEdit from './pages/admin/blogs/BlogEdit';
import BlogPost from './pages/BlogPost';
import ProtectedRoute from './components/admin/ProtectedRoute';

// Context
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

// ─── Public animated routes ────────────────────────────────────────────────
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/services" element={<PageTransition><Services /></PageTransition>} />
        <Route path="/services/consultancy" element={<PageTransition><Consultancy /></PageTransition>} />
        <Route path="/services/marketing" element={<PageTransition><Marketing /></PageTransition>} />
        <Route path="/services/design" element={<PageTransition><Design /></PageTransition>} />
        <Route path="/services/technical" element={<PageTransition><Technical /></PageTransition>} />
        <Route path="/services/development" element={<PageTransition><Development /></PageTransition>} />
        <Route path="/services/iot" element={<PageTransition><IoT /></PageTransition>} />
        <Route path="/strategy" element={<PageTransition><Strategy /></PageTransition>} />
        <Route path="/electronics" element={<PageTransition><Electronics /></PageTransition>} />
        <Route path="/blogs" element={<PageTransition><Blogs /></PageTransition>} />
        <Route path="/blog/:slug" element={<PageTransition><BlogPost /></PageTransition>} />
        <Route path="/team" element={<PageTransition><Team /></PageTransition>} />
        <Route path="/about" element={<PageTransition><About /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

// ─── Public app shell ──────────────────────────────────────────────────────
const PublicApp = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const splashPlayed = sessionStorage.getItem('splashPlayed');
    if (!splashPlayed) {
      setShowSplash(true);
    }
  }, []);

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 0.8, smoothWheel: true, wheelMultiplier: 1.0 }}>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div style={{ visibility: showSplash ? 'hidden' : 'visible' }}>
        <ScrollToTop />
        <CustomCursor />
        <Navbar />
        <main>
          <AnimatedRoutes />
        </main>
        <Footer />
      </div>
    </ReactLenis>
  );
};

// ─── Route splitter — decides admin vs public ──────────────────────────────
const AppRoutes = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="blogs" element={<AdminBlogs />} />
          <Route path="blogs/new" element={<BlogEdit />} />
          <Route path="blogs/:id" element={<BlogEdit />} />
        </Route>
      </Routes>
    );
  }

  return <PublicApp />;
};

// ─── Root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
