import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WordSplitter } from './animations/TextReveal';
import ScrollReveal from './animations/ScrollReveal';
import { easings } from '../theme';
import { type ReactNode } from 'react';
import BorderGlow from './BorderGlow';

export interface ServiceItem {
  icon: any;
  title: string;
  desc: string;
}

export interface ServiceGroup {
  groupTitle?: string;
  items: ServiceItem[];
}

interface ServiceSubPageProps {
  title: string;
  subtitle: string;
  groups: ServiceGroup[];
  children?: ReactNode;
}

const ServiceSubPage = ({ title, subtitle, groups }: ServiceSubPageProps) => {
  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>
      {/* Back button */}
      <div className="container" style={{ paddingTop: '2rem' }}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: easings.global }}
        >
          <Link
            to="/services"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-light)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'none',
              transition: 'transform 0.2s ease'
            }}
            className="back-to-services"
          >
            <ArrowLeft size={18} /> Back to Services
          </Link>
        </motion.div>
      </div>

      {/* Hero */}
      <section className="section-padding" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
        <div className="container">
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easings.global }}
            className="section-subtitle"
          >
            OUR SERVICES
          </motion.span>
          <div style={{ marginTop: '0.5rem' }}>
            <WordSplitter text={title} className="h2-title" />
          </div>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-body"
            style={{ maxWidth: '600px', marginTop: '1rem' }}
          >
            {subtitle}
          </motion.p>
        </div>
      </section>

      {/* Service Groups */}
      {groups.map((group, gi) => (
        <ScrollReveal key={gi} className="section-padding-tight" style={{ background: gi % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
          <div className="container">
            {group.groupTitle && (
              <motion.h3
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easings.global }}
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '2rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-divider)'
                }}
              >
                {group.groupTitle}
              </motion.h3>
            )}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1.5rem'
              }}
            >
              {group.items.map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={{
                    hidden: { opacity: 0, y: 25, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: easings.global } }
                  }}
                  style={{ height: '100%' }}
                >
                  <BorderGlow
                    edgeSensitivity={30}
                    glowColor="40 80 80"
                    backgroundColor="var(--bg-card)"
                    borderRadius={16}
                    glowRadius={40}
                    glowIntensity={1}
                    coneSpread={25}
                    animated={false}
                    colors={['#c084fc', '#f472b6', '#38bdf8']}
                    className="h-full"
                  >
                    <div
                      className="service-card-detailed"
                      style={{ padding: '2rem', border: 'none', background: 'transparent', height: '100%' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                        <div
                          className="service-card-icon-v2"
                          style={{ background: 'rgba(41,121,255,0.1)' }}
                        >
                          <item.icon color="var(--accent-light)" size={26} />
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: '36px',
                          fontWeight: 800,
                          color: 'var(--card-number-color)',
                          lineHeight: 1
                        }}>
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <h4 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.75rem'
                      }}>
                        {item.title}
                      </h4>
                      <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem',
                        lineHeight: 1.7
                      }}>
                        {item.desc}
                      </p>
                    </div>
                  </BorderGlow>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </ScrollReveal>
      ))}

      {/* Blue CTA */}
      <ScrollReveal className="relative overflow-hidden">
        <motion.div
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ background: 'var(--accent-blue)', padding: '6rem 0', textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ffffff', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.1 }}>
                Ready To Get Started?
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.125rem', marginBottom: '2rem' }}>
                Let's build something remarkable together.
              </p>
              <a
                href="#contact"
                className="btn-white-cta"
              >
                Let's Talk <ArrowRight size={18} />
              </a>
            </motion.div>
          </div>
        </motion.div>
      </ScrollReveal>
    </div>
  );
};

export default ServiceSubPage;
