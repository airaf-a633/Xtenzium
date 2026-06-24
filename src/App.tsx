import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { useState, useEffect } from 'react';

// Always-on shell components (needed on first paint)
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CustomCursor from './components/CustomCursor';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';

// Context
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';

// ─── Lazy public pages ─────────────────────────────────────────────────────
const Home        = lazy(() => import('./pages/Home'));
const About       = lazy(() => import('./pages/About'));
const Services    = lazy(() => import('./pages/Services'));
const Strategy    = lazy(() => import('./pages/Strategy'));
const Electronics = lazy(() => import('./pages/Electronics'));
const Blogs       = lazy(() => import('./pages/Blogs'));
const BlogPost    = lazy(() => import('./pages/BlogPost'));
const Contact     = lazy(() => import('./pages/Contact'));

// ─── Lazy service sub-pages ────────────────────────────────────────────────
const Consultancy = lazy(() => import('./pages/services/Consultancy'));
const Marketing   = lazy(() => import('./pages/services/Marketing'));
const Design      = lazy(() => import('./pages/services/Design'));
const Technical   = lazy(() => import('./pages/services/Technical'));
const Development = lazy(() => import('./pages/services/Development'));
const IoT         = lazy(() => import('./pages/services/IoT'));

// ─── Lazy admin pages ──────────────────────────────────────────────────────
const Login       = lazy(() => import('./pages/admin/Login'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard   = lazy(() => import('./pages/admin/Dashboard'));
const Leads       = lazy(() => import('./pages/admin/leads/Leads'));
const LeadDetail  = lazy(() => import('./pages/admin/leads/LeadDetail'));
const AdminBlogs  = lazy(() => import('./pages/admin/blogs/Blogs'));
const BlogEdit    = lazy(() => import('./pages/admin/blogs/BlogEdit'));

// ─── Minimal fallback shown while chunks load ──────────────────────────────
const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ─── Public animated routes ────────────────────────────────────────────────
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"                       element={<PageTransition><Home /></PageTransition>} />
        <Route path="/about"                  element={<PageTransition><About /></PageTransition>} />
        <Route path="/services"               element={<PageTransition><Services /></PageTransition>} />
        <Route path="/services/consultancy"   element={<PageTransition><Consultancy /></PageTransition>} />
        <Route path="/services/marketing"     element={<PageTransition><Marketing /></PageTransition>} />
        <Route path="/services/design"        element={<PageTransition><Design /></PageTransition>} />
        <Route path="/services/technical"     element={<PageTransition><Technical /></PageTransition>} />
        <Route path="/services/development"   element={<PageTransition><Development /></PageTransition>} />
        <Route path="/services/iot"           element={<PageTransition><IoT /></PageTransition>} />
        <Route path="/strategy"               element={<PageTransition><Strategy /></PageTransition>} />
        <Route path="/electronics"            element={<PageTransition><Electronics /></PageTransition>} />
        <Route path="/blogs"                  element={<PageTransition><Blogs /></PageTransition>} />
        <Route path="/blog/:slug"             element={<PageTransition><BlogPost /></PageTransition>} />
        <Route path="/contact"                element={<PageTransition><Contact /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

// ─── Public app shell ──────────────────────────────────────────────────────
const PublicApp = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const splashPlayed = sessionStorage.getItem('splashPlayed');
    if (!splashPlayed) setShowSplash(true);
  }, []);

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 0.8, smoothWheel: true, wheelMultiplier: 1.0 }}>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div style={{ visibility: showSplash ? 'hidden' : 'visible' }}>
        <ScrollToTop />
        <CustomCursor />
        <Navbar />
        <main>
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
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
      <Suspense fallback={<PageLoader />}>
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
            <Route index         element={<Dashboard />} />
            <Route path="leads"  element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="blogs"  element={<AdminBlogs />} />
            <Route path="blogs/new" element={<BlogEdit />} />
            <Route path="blogs/:id" element={<BlogEdit />} />
          </Route>
        </Routes>
      </Suspense>
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
