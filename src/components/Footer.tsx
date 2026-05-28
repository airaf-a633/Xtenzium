import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Footer = () => {
  const { theme } = useTheme();
  return (
    <footer className="footer-section">
      <div className="container">
        <div className="footer-grid">
          {/* Column 1: Brand & Social */}
          <div className="footer-column">
            <div className="footer-brand-logo" style={{ marginBottom: '1.5rem' }}>
              <img src="/logo.png" alt="Xtenzium Logo" style={{ height: '56px', width: 'auto' }} />
            </div>
            <p className="footer-desc">
              We partner with forward-thinking companies to navigate the complexities of digital evolution and hardware innovation.
            </p>
            <div className="footer-social-links">
              <a href="https://www.linkedin.com/company/xtenzium/" target="_blank" rel="noopener noreferrer" className="footer-social-icon" aria-label="LinkedIn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="https://www.instagram.com/xtenzium/" target="_blank" rel="noopener noreferrer" className="footer-social-icon" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="mailto:contact@xtenzium.com" className="footer-social-icon" aria-label="Email">
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className="footer-column">
            <h4 className="footer-label">Explore</h4>
            <ul className="footer-link-list">
              <li><Link to="/" className="footer-nav-link">Home</Link></li>
              <li><Link to="/about" className="footer-nav-link">About Us</Link></li>
              <li><Link to="/strategy" className="footer-nav-link">Our Strategy</Link></li>
              <li><Link to="/team" className="footer-nav-link">Meet The Team</Link></li>
            </ul>
          </div>

          {/* Column 3: Expertise */}
          <div className="footer-column">
            <h4 className="footer-label">Expertise</h4>
            <ul className="footer-link-list">
              <li><Link to="/services/design" className="footer-nav-link">UI/UX Design</Link></li>
              <li><Link to="/services/development" className="footer-nav-link">Web Solutions</Link></li>
              <li><Link to="/services/consultancy" className="footer-nav-link">Automation</Link></li>
              <li><Link to="/electronics" className="footer-nav-link">Electronics</Link></li>
            </ul>
          </div>

          {/* Column 4: Reach Out */}
          <div className="footer-column">
            <h4 className="footer-label">Connect</h4>
            <div className="footer-contact">
              <div className="footer-contact-item">
                <span className="footer-text" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>LOCATION</span>
                <span className="footer-text">Karachi, Pakistan</span>
              </div>
              <div className="footer-contact-item">
                <span className="footer-text" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>INQUIRIES</span>
                <a href="mailto:contact@xtenzium.com" className="footer-nav-link" style={{ transition: 'all 0.3s' }}
                   onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                   onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  contact@xtenzium.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Massive Typographic Footer Logo */}
        <div className="footer-bottom">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6rem', opacity: 0.1, pointerEvents: 'none' }}>
            <img src="/logo.png" alt="Xtenzium" style={{ height: '180px', width: 'auto', filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)' }} />
          </div>
          <div className="footer-legal" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid var(--border-divider)', paddingTop: '2rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>© 2026 Xtenzium. All rights reserved.</span>
            <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Digital Transformation & Electronics Division</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
