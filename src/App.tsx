import { ReactLenis } from 'lenis/react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CustomCursor from './components/CustomCursor';
import PageTransition from './components/PageTransition';
import ScrollToTop from './components/ScrollToTop';

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

import { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import { ThemeProvider } from './context/ThemeContext';

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
        <Route path="/team" element={<PageTransition><Team /></PageTransition>} />
        <Route path="/about" element={<PageTransition><About /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const splashPlayed = sessionStorage.getItem('splashPlayed');
    if (!splashPlayed) {
      setShowSplash(true);
    }
  }, []);

  return (
    <ThemeProvider>
      <ReactLenis root options={{ lerp: 0.1, duration: 0.8, smoothWheel: true, wheelMultiplier: 1.0 }}>
        <Router>
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
        </Router>
      </ReactLenis>
    </ThemeProvider>
  );
}

export default App;
