import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, Check, ChevronRight, ArrowLeft, Palette } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { easings } from '../theme';
import { useTheme } from '../context/ThemeContext';

const menuVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0.95, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3, delay: 0.2 } }
};

const itemContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  exit: { opacity: 1, transition: { staggerChildren: 0.03, staggerDirection: -1 } }
};

const itemVariants = {
  hidden: { y: 40, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: easings.global } },
  exit: { y: -30, opacity: 0, transition: { duration: 0.3, ease: easings.global } }
};

const NAVBAR_LINKS = [
  { name: 'Home', path: '/', id: 'home' },
  { name: 'About', path: '/about', id: 'about' },
  { name: 'Services', path: '/services', id: 'services' },
  { name: 'Strategy', path: '/strategy', id: 'strategy' },
  { name: 'Electronics', path: '/electronics', id: 'electronics' },
  { name: 'Blogs', path: '/blogs', id: 'blogs' },
  { name: 'Contact', path: '/contact', id: 'contact' }
];

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<'main' | 'theme'>('main');
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  const closeMenu = () => {
    setIsOpen(false);
    setIsThemeOpen(false);
    setTimeout(() => setActiveSubMenu('main'), 300);
  };

  const toggleThemeMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isThemeOpen) {
      setActiveSubMenu('main');
    }
    setIsThemeOpen(!isThemeOpen);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: easings.global }}
        className={`navbar-header ${isScrolled ? 'scrolled' : ''}`}
      >
        <div className="navbar-container" style={{ position: 'relative' }}>
          <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center' }} onClick={closeMenu}>
            <img src="/logo.png" alt="Xtenzium Logo" style={{ height: '48px', width: 'auto' }} />
          </Link>

          <nav className="desktop-nav-links">
            {NAVBAR_LINKS.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <motion.span
                    className="nav-item-text"
                    animate={isActive ? { color: 'var(--accent-blue)' } : { color: 'var(--text-primary)' }}
                    transition={{ duration: 0.2 }}
                  >
                    {link.name}
                  </motion.span>
                </Link>
              );
            })}
          </nav>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="theme-dropdown-wrapper" style={{ position: 'relative' }}>
              <button 
                onClick={toggleThemeMenu}
                className={`theme-dropdown-btn ${isThemeOpen ? 'active' : ''}`}
                aria-label="Theme Options"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'none', 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--text-primary)',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease'
                }}
              >
                <Menu size={20} />
              </button>

              <AnimatePresence>
                {isThemeOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsThemeOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 100, cursor: 'none' }}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: easings.global }}
                      className="theme-dropdown-menu"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '0.75rem',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '0.5rem',
                        minWidth: '180px',
                        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(12px)',
                        zIndex: 110,
                        overflow: 'hidden'
                      }}
                    >
                      <AnimatePresence mode="wait">
                        {activeSubMenu === 'main' ? (
                          <motion.div
                            key="main-menu"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <button 
                              className="theme-dropdown-item"
                              onClick={(e) => { e.stopPropagation(); setActiveSubMenu('theme'); }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                borderRadius: '8px',
                                cursor: 'none',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Palette size={16} />
                                <span>Theme</span>
                              </div>
                              <ChevronRight size={14} opacity={0.5} />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="theme-menu"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <button 
                              className="theme-dropdown-back"
                              onClick={(e) => { e.stopPropagation(); setActiveSubMenu('main'); }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.5rem 1rem',
                                marginBottom: '0.5rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: 'none',
                                textAlign: 'left'
                              }}
                            >
                              <ArrowLeft size={12} />
                              Back
                            </button>
                            <button 
                              className={`theme-dropdown-item ${theme === 'light' ? 'active' : ''}`}
                              onClick={() => { setTheme('light'); setIsThemeOpen(false); }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                borderRadius: '8px',
                                cursor: 'none',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Sun size={16} />
                                <span>Light</span>
                              </div>
                              {theme === 'light' && <Check size={14} />}
                            </button>
                            <button 
                              className={`theme-dropdown-item ${theme === 'dark' ? 'active' : ''}`}
                              onClick={() => { setTheme('dark'); setIsThemeOpen(false); }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                borderRadius: '8px',
                                cursor: 'none',
                                textAlign: 'left'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Moon size={16} />
                                <span>Dark</span>
                              </div>
                              {theme === 'dark' && <Check size={14} />}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <Link to="/contact" className="btn-white-cta navbar-cta max-[768px]:!hidden" style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', borderRadius: '2rem' }}>Let's Talk</Link>
            <button 
              className="navbar-toggle"
              onClick={() => { setIsOpen(!isOpen); setIsThemeOpen(false); }}
              style={{ zIndex: 60, position: 'relative' }}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </motion.header>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mega-menu-overlay"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div 
              className="mega-menu-content"
              variants={itemContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {NAVBAR_LINKS.map((link) => (
                <motion.div key={link.name} variants={itemVariants} className="mega-menu-item-wrapper">
                  <Link 
                    to={link.path} 
                    className={`mega-menu-link ${location.pathname === link.path ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
