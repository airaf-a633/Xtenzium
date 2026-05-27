import { motion } from 'framer-motion';
import { easings } from '../theme';
import { ArrowRight, Paintbrush, Code, Settings, BarChart } from 'lucide-react';

import { ClipReveal, WordSplitter, NumberCounter } from '../components/animations/TextReveal';
import ScrollReveal from '../components/animations/ScrollReveal';
import Hero3D from '../components/Hero3D';
import BorderGlow from '../components/BorderGlow';

const MarqueeTicker = () => {
  return (
    <div className="marquee-wrapper" style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '1rem 0', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <motion.div
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 35 }}
        style={{ display: 'flex', gap: '2rem' }}
        className="marquee-content"
      >
        {[...Array(4)].map((_, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.05em' }}>
            We Architect Long-Term Success ✦ Digital Agency ✦ Smart Automation ✦ UI/UX Design ✦ Web Development ✦ Electronics Division ✦ Karachi, Pakistan ✦
          </span>
        ))}
      </motion.div>
    </div>
  );
};

const Home = () => {
  return (
    <div className="main-wrapper">
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }}></div>
      
      {/* 1. Hero Section */}
      <ScrollReveal id="home" className="hero-section" style={{ position: 'relative' }}>
        <div className="container" style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="hero-content" style={{ textAlign: 'left', margin: 0, maxWidth: '600px', position: 'relative', zIndex: 10 }}>
            <div className="hero-title-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <ClipReveal delay={0.1}><h1 className="h1-super" style={{ color: 'var(--text-primary)' }}>We Architect</h1></ClipReveal>
              <ClipReveal delay={0.2}><h1 className="h1-super" style={{ color: 'var(--accent-blue)' }}>Long-Term</h1></ClipReveal>
              <ClipReveal delay={0.3}><h1 className="h1-super" style={{ color: 'var(--text-primary)' }}>Success.</h1></ClipReveal>
            </div>
            <motion.p 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-body hero-desc" style={{ marginTop: '1.5rem', marginLeft: 0 }}
            >
              Xtenzium is a full-service digital agency delivering end-to-end solutions in design, development, automation, and digital growth. Tailored to modern businesses.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}
              className="hero-actions" style={{ justifyContent: 'flex-start', marginTop: '2.5rem' }}
            >
              <a href="#about" className="btn-primary hero-cta-button">Discover Xtenzium <ArrowRight className="btn-icon" size={20} /></a>
            </motion.div>
          </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        >
          <Hero3D />
        </motion.div>
      </ScrollReveal>

      {/* Marquee Ticker */}
      <MarqueeTicker />

      {/* 2. Company Overview & Stats */}
      <ScrollReveal id="about" className="section-padding" style={{ background: 'var(--bg-primary)', position: 'relative', borderTop: '1px solid var(--border-divider)', borderBottom: '1px solid var(--border-divider)' }}>
        <div className="container">
          <motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }} className="split-layout">
            <div>
              <motion.div variants={{ hidden: { opacity: 0, scale: 1.02 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }}}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '8rem', fontWeight: 900, lineHeight: 1, color: 'var(--border-divider)', letterSpacing: '-0.05em', marginBottom: '-1.5rem', marginLeft: '-0.5rem' }}>2026</div>
              </motion.div>
              <WordSplitter text="Our Foundation" className="h2-title" />
              <motion.div variants={{ hidden: { scaleX: 0, opacity: 0 }, visible: { scaleX: 1, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }}} style={{ transformOrigin: 'left' }} className="divider mt-4"></motion.div>
              <motion.p variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }}} className="text-body mt-4">
                Xtenzium began with a simple mission: to eliminate the friction between design and technology, creating seamless digital experiences for modern businesses.
              </motion.p>
            </div>
            <motion.div 
              variants={{ hidden: { opacity: 0, scale: 0.98 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }}}
              style={{ width: '100%' }}
            >
              <BorderGlow
                edgeSensitivity={30}
                glowColor="40 80 80"
                backgroundColor="var(--bg-card)"
                borderRadius={28}
                glowRadius={40}
                glowIntensity={1}
                coneSpread={25}
                animated={false}
                colors={['#c084fc', '#f472b6', '#38bdf8']}
              >
                <div className="glass-panel" style={{ padding: '3rem', border: 'none', background: 'transparent' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                      <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}><NumberCounter to={65} suffix="+" /></div>
                      <div className="text-body" style={{ fontWeight: 500, marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Projects Delivered</div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-divider)', width: '100%' }}></div>
                    <div>
                      <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}><NumberCounter to={36} prefix="+" suffix="%" delay={0.1} /></div>
                      <div className="text-body" style={{ fontWeight: 500, marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Average Client ROI</div>
                    </div>
                  </div>
                </div>
              </BorderGlow>
            </motion.div>
          </motion.div>
        </div>
      </ScrollReveal>

      {/* 3. Services Grid */}
      <ScrollReveal id="strategy" className="section-padding" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle" style={{ display: 'inline-block' }}>WHAT WE DO</span><br/>
            <WordSplitter text="Our Services" className="h2-title" />
          </div>
          <motion.div 
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}
          >
            {[
              { icon: BarChart, title: 'Digital Marketing', desc: 'Driving targeted growth through data-driven insights and creative storytelling.' },
              { icon: Settings, title: 'Smart Automation', desc: 'Engineering data-driven workflows that eliminate repetitive tasks.' },
              { icon: Code, title: 'Web Development', desc: 'Building high-performance, scalable applications combining robust backend architecture.' },
              { icon: Paintbrush, title: 'UI/UX Design', desc: 'Crafting intuitive user interfaces and impactful visual identities.' }
            ].map((service, idx) => (
              <motion.div 
                key={`srv-${idx}`}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
                style={{ height: '100%' }}
              >
                <BorderGlow
                  edgeSensitivity={30}
                  glowColor="40 80 80"
                backgroundColor="var(--bg-card)"
                  borderRadius={16}
                  glowRadius={40}
                  glowIntensity={0.8}
                  coneSpread={25}
                  animated={false}
                  colors={['#c084fc', '#f472b6', '#38bdf8']}
                  className="h-full"
                >
                  <div className="service-card-v2" style={{ border: 'none', background: 'transparent', height: '100%' }}>
                    <div className="service-card-icon-v2"><service.icon color="var(--accent-blue)" size={32} /></div>
                    <h4 className="service-card-title-v2">{service.title}</h4>
                    <p className="service-card-desc-v2">{service.desc}</p>
                  </div>
                </BorderGlow>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </ScrollReveal>

      {/* 4. Mission and Vision */}
      <ScrollReveal id="electronics" className="section-padding" style={{ background: 'var(--bg-primary)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <motion.div 
              variants={{ hidden: { opacity: 0, x: -30 }, visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easings.global } }}}
              style={{ width: '100%' }}
            >
              <BorderGlow
                edgeSensitivity={30}
                glowColor="40 80 80"
                backgroundColor="var(--bg-card)"
                borderRadius={24}
                glowRadius={50}
                glowIntensity={1}
                coneSpread={25}
                animated={false}
                colors={['#c084fc', '#f472b6', '#38bdf8']}
                className="h-full"
              >
                <div style={{ background: 'transparent', padding: '3rem', color: 'var(--text-primary)', border: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>OUR MISSION</h3>
                  <p style={{ fontSize: '1.25rem', lineHeight: 1.6, fontWeight: 300, color: 'var(--text-secondary)' }}>To empower modern businesses by bridging the gap between creative design and intelligent automation. We deliver comprehensive digital solutions that drive measurable efficiency.</p>
                </div>
              </BorderGlow>
            </motion.div>
            <motion.div 
              variants={{ hidden: { opacity: 0, x: 30 }, visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easings.global } }}}
              style={{ width: '100%' }}
            >
              <BorderGlow
                edgeSensitivity={30}
                glowColor="40 80 80"
                backgroundColor="var(--bg-card)"
                borderRadius={24}
                glowRadius={50}
                glowIntensity={1}
                coneSpread={25}
                animated={false}
                colors={['#c084fc', '#f472b6', '#38bdf8']}
                className="h-full"
              >
                <div style={{ background: 'transparent', padding: '3rem', border: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent-blue)', marginBottom: '1.5rem' }}>OUR VISION</h3>
                  <p style={{ fontSize: '1.25rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>To become the leading catalyst for digital transformation globally — where technology seamlessly amplifies human potential for businesses of all sizes.</p>
                </div>
              </BorderGlow>
            </motion.div>
          </div>
        </div>
      </ScrollReveal>

      {/* 5. Blue CTA Banner */}
      <ScrollReveal style={{ position: 'relative', overflow: 'hidden' }}>
        <motion.div
          variants={{ hidden: { clipPath: 'inset(0 100% 0 0)' }, visible: { clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.7, ease: "easeOut" } } }}
          style={{ background: 'var(--accent-blue)', padding: '6rem 0', textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <div className="container">
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.3, ease: easings.global } } }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ffffff', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.1 }}>
                Ready To Build Something Remarkable?
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.25rem', marginBottom: '2.5rem' }}>Let's architect your long-term success together.</p>
              <a href="#contact" className="btn-white-cta">Let's Talk &rarr;</a>
            </motion.div>
          </div>
        </motion.div>
      </ScrollReveal>

    </div>
  );
};

export default Home;
