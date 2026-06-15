import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import styles from './Footer.module.css';

const ParticleNetwork = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;
    let particles: Array<{ x: number, y: number, vx: number, vy: number }> = [];

    const initParticles = () => {
      particles = [];
      const numParticles = Math.floor((width * height) / 15000);
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 144, 255, 0.4)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(30, 144, 255, ${0.15 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        }
      });

      requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);
    initParticles();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvasBackground} />;
};

const Footer = () => {
  return (
    <footer className={styles.footerWrapper}>
      <ParticleNetwork />
      
      <div className={styles.crystalContainer}>
        <div className={styles.radialGlow}></div>
      </div>

      <div className={styles.contentContainer}>
        <div className={styles.gridContainer}>
          
          {/* Column 1: Brand & Social */}
          <div className={styles.glassCard}>
            <div style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 10 }}>
              <img src="/logo.png" alt="Xtenzium Logo" style={{ height: '56px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
            </div>
            <p className={styles.brandDesc}>
              We partner with forward-thinking companies to navigate the complexities of digital evolution and hardware innovation.
            </p>
            <div className={styles.socialList}>
              <a href="https://www.linkedin.com/company/xtenzium/" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="https://www.instagram.com/xtenzium/" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="mailto:contact@xtenzium.com" className={styles.socialIcon} aria-label="Email">
                <Mail size={18} />
              </a>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className={styles.glassCard}>
            <h4 className={styles.columnTitle}>Explore</h4>
            <ul className={styles.linkList}>
              <li><Link to="/" className={styles.navLink}>Home</Link></li>
              <li><Link to="/about" className={styles.navLink}>About Us</Link></li>
              <li><Link to="/strategy" className={styles.navLink}>Our Strategy</Link></li>
              <li><Link to="/contact" className={styles.navLink}>Contact Us</Link></li>
            </ul>
          </div>

          {/* Column 3: Expertise */}
          <div className={styles.glassCard}>
            <h4 className={styles.columnTitle}>Expertise</h4>
            <ul className={styles.linkList}>
              <li><Link to="/services/design" className={styles.navLink}>UI/UX Design</Link></li>
              <li><Link to="/services/development" className={styles.navLink}>Web Solutions</Link></li>
              <li><Link to="/services/consultancy" className={styles.navLink}>Automation</Link></li>
              <li><Link to="/electronics" className={styles.navLink}>Electronics</Link></li>
            </ul>
          </div>

          {/* Column 4: Reach Out */}
          <div className={styles.glassCard}>
            <h4 className={styles.columnTitle}>Connect</h4>
            <div className={styles.connectItem}>
              <span className={styles.connectLabel}>Location</span>
              <span className={styles.connectText}>Karachi, Pakistan</span>
            </div>
            <div className={styles.connectItem}>
              <span className={styles.connectLabel}>Inquiries</span>
              <a href="mailto:contact@xtenzium.com" className={styles.connectLink}>
                contact@xtenzium.com
              </a>
            </div>
          </div>
          
        </div>

        {/* Sub-Footer */}
        <div className={styles.subFooterWrapper}>
          <div className={styles.subFooterCurve}></div>
          <div className={styles.subFooterContent}>
            <span>© 2026 Xtenzium. All rights reserved.</span>
            <span>Digital Transformation & Electronics Division</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
