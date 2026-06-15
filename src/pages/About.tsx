import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { easings } from '../theme';
import { WordSplitter, NumberCounter } from '../components/animations/TextReveal';
import { ShieldCheck, Target, Compass, ArrowRight, Cpu, Layers, Zap, Globe, ShoppingCart, Factory, Stethoscope, Wallet } from 'lucide-react';
import ScrollReveal from '../components/animations/ScrollReveal';
import BorderGlow from '../components/BorderGlow';

const sectionHeaderVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easings.global } }
};

const About = () => {
  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Explicit Grid Overlay */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>
      
      {/* Content strictly pulled above the absolute grid background */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        
        {/* SECTION 1: Hero Banner */}
        <ScrollReveal id="about" className="section-padding" style={{ paddingBottom: '4rem', background: 'transparent' }}>
          <div className="container">
            <div className="section-header" style={{ maxWidth: '900px', margin: '0 auto 2rem auto' }}>
              <motion.span 
                initial="hidden" animate="visible"
                variants={sectionHeaderVariants} className="section-subtitle" style={{ display: 'inline-block' }}
              >
                WHO WE ARE
              </motion.span>
              <br/>
              <div style={{ padding: '0.5rem 0' }}>
                <WordSplitter text="More Than An Agency. We're Your Digital Partner." className="h1-super" />
              </div>
              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-body" style={{ marginTop: '1.5rem', fontSize: '1.25rem', maxWidth: '750px', marginInline: 'auto' }}
              >
                Xtenzium was built to eliminate the friction between creative design and intelligent automation — delivering scalable, high-performance digital ecosystems for modern businesses.
              </motion.p>
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 2: Company Story */}
        <ScrollReveal className="section-padding" style={{ background: 'var(--bg-secondary)', position: 'relative', borderTop: '1px solid var(--border-divider)', borderBottom: '1px solid var(--border-divider)' }}>
          <div className="container">
            <motion.div 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true, amount: 0.15 }}
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              className="split-layout"
            >
              {/* Left Column (Text & Big Number) */}
              <div>
                <motion.div variants={{ hidden: { opacity: 0, scale: 1.02 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }}}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '8rem', fontWeight: 900, lineHeight: 1, color: 'var(--border-divider)', letterSpacing: '-0.05em', marginBottom: '-1.5rem', marginLeft: '-0.5rem' }}>
                    2026
                  </div>
                </motion.div>
                <WordSplitter text="Our Foundation" className="h2-title" />
                <motion.div variants={{ hidden: { scaleX: 0, opacity: 0 }, visible: { scaleX: 1, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }}} style={{ transformOrigin: 'left' }} className="divider mt-4"></motion.div>
                <motion.p variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }}} className="text-body mt-4">
                  Xtenzium began with a simple mission: to eliminate the friction between design and technology, creating seamless digital experiences for modern businesses.
                </motion.p>
              </div>

              {/* Right Column (Stats Card) */}
              <motion.div 
                variants={{ hidden: { opacity: 0, scale: 0.98 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }}}
                style={{ width: '100%' }}
              >
                <BorderGlow
                  edgeSensitivity={30}
                  glowColor="40 80 80"
                  backgroundColor="var(--bg-card)"
                  borderRadius={28}
                  glowRadius={50}
                  glowIntensity={1}
                  coneSpread={25}
                  animated={false}
                  colors={['#c084fc', '#f472b6', '#38bdf8']}
                >
                  <div className="glass-panel" style={{ padding: '3rem', border: 'none', background: 'transparent' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div>
                        <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>
                          <NumberCounter to={65} suffix="+" />
                        </div>
                        <div className="text-body" style={{ fontWeight: 500, marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Projects Delivered</div>
                      </div>
                      <div style={{ height: '1px', background: 'var(--border-divider)', width: '100%' }}></div>
                      <div>
                        <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>
                          <NumberCounter to={36} prefix="+" suffix="%" delay={0.1} />
                        </div>
                        <div className="text-body" style={{ fontWeight: 500, marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Average Client ROI</div>
                      </div>
                      <div style={{ height: '1px', background: 'var(--border-divider)', width: '100%' }}></div>
                      <div>
                        <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>
                          <NumberCounter to={4} delay={0.2} />
                        </div>
                        <div className="text-body" style={{ fontWeight: 500, marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Expert Team Members</div>
                      </div>
                    </div>
                  </div>
                </BorderGlow>
              </motion.div>
            </motion.div>
          </div>
        </ScrollReveal>

        {/* SECTION 3: Mission & Vision */}
        <ScrollReveal className="section-padding" style={{ background: 'var(--bg-primary)' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.4 }}
                style={{ width: '100%', height: '100%' }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)' }}></div>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>OUR MISSION</h3>
                    </div>
                    <p style={{ fontSize: '1.25rem', lineHeight: 1.6, fontWeight: 300, color: 'var(--text-secondary)' }}>
                      To empower modern businesses by bridging the gap between creative design and intelligent automation. We deliver comprehensive digital solutions that drive measurable efficiency and sustainable growth.
                    </p>
                  </div>
                </BorderGlow>
              </motion.div>

              {/* Card 2: Vision (White) */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                style={{ width: '100%', height: '100%' }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)' }}></div>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent-blue)' }}>OUR VISION</h3>
                    </div>
                    <p className="text-body" style={{ fontSize: '1.25rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                      To become the leading catalyst for digital transformation globally — where technology seamlessly amplifies human potential for businesses of all sizes.
                    </p>
                  </div>
                </BorderGlow>
              </motion.div>

            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 4: Our Values */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-secondary)', position: 'relative' }}>
          <div className="container">
            <div className="section-header">
              <motion.span 
                initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
                variants={sectionHeaderVariants} className="section-subtitle" style={{ display: 'inline-block' }}
              >
                WHAT DRIVEs US
              </motion.span>
              <br/>
              <WordSplitter text="Our Core Values" className="h2-title" />
            </div>

            <motion.div 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true, amount: 0.15 }}
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}
            >
              {[
                { icon: ShieldCheck, title: "Core Commitments", text: "We maintain the highest standards of integrity and transparency in every digital project we undertake." },
                { icon: Target, title: "Pillars of Excellence", text: "Our work is founded on technical precision, innovative design, and a relentless focus on achieving client success." },
                { icon: Compass, title: "Guiding Principles", text: "We prioritize scalable solutions and user-centric experiences to ensure long-term digital growth for our partners." }
              ].map((val, idx) => (
                <motion.div 
                  key={`val-${idx}`}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
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
                    <div className="service-card-v2" style={{ padding: '2rem', border: 'none', background: 'transparent', height: '100%' }}>
                      <div className="service-card-icon-v2">
                        <val.icon size={28} color="var(--accent-blue)" />
                      </div>
                      <h4 className="service-card-title-v2" style={{ fontSize: '1.25rem' }}>{val.title}</h4>
                      <p className="service-card-desc-v2">{val.text}</p>
                    </div>
                  </BorderGlow>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </ScrollReveal>

        {/* SECTION 5: Services redirect (not duplicated here) */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-primary)' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <motion.span
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
              variants={sectionHeaderVariants} className="section-subtitle" style={{ display: 'inline-block' }}
            >
              WHAT WE DO
            </motion.span>
            <br />
            <WordSplitter text="Full-Spectrum Digital Services" className="h2-title" />
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-body"
              style={{ marginTop: '1.5rem', maxWidth: '580px', marginInline: 'auto' }}
            >
              UI/UX design, full-stack development, smart automation, digital marketing, IoT hardware — and everything in between.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              style={{ marginTop: '2.5rem' }}
            >
              <Link to="/services" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                Explore all services <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>
        </ScrollReveal>

        {/* SECTION 6: Electronics Highlight Feature */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-secondary)', position: 'relative', borderTop: '1px solid var(--border-divider)' }}>
          <div className="container">
            <div className="split-layout">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: easings.global }}
              >
                <span className="section-subtitle">PRECISION ENGINEERING</span>
                <h2 className="h2-title" style={{ marginTop: '1rem' }}>Electronics & Hardware Division</h2>
                <div className="divider mt-4"></div>
                <p className="text-body" style={{ marginTop: '2rem', fontSize: '1.2rem' }}>
                  Beyond software, Xtenzium builds the physical foundations of modern technology. Our electronics department specializes in the end-to-end lifecycle of hardware systems.
                </p>
                <ul className="text-body" style={{ marginTop: '1.5rem', listStyle: 'none', paddingLeft: 0, color: 'var(--text-secondary)' }}>
                  <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--accent-blue)', borderRadius: '50%' }}></div>
                    Custom PCB Design & Prototyping
                  </li>
                  <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--accent-blue)', borderRadius: '50%' }}></div>
                    Intelligent IoT Hardware Integration
                  </li>
                  <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--accent-blue)', borderRadius: '50%' }}></div>
                    Robust Network & Database Infrastructure
                  </li>
                  <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--accent-blue)', borderRadius: '50%' }}></div>
                    On-Site Technical Maintenance
                  </li>
                </ul>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ position: 'relative' }}
              >
                <div style={{ 
                  borderRadius: '2rem', 
                  overflow: 'hidden', 
                  border: '1px solid var(--border-divider)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  aspectRatio: '16/10',
                  background: 'var(--bg-card)'
                }}>
                  <img 
                    src="/electronics_precision_hardware_1776874620296.png" 
                    alt="Precision Electronics Hardware" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 7: Our Methodology */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-primary)' }}>
          <div className="container">
            <div className="section-header">
              <span className="section-subtitle">OUR PROCESS</span>
              <br/>
              <WordSplitter text="Architecting Your Success" className="h2-title" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', marginTop: '4rem' }}>
              {[
                { step: '01', title: 'Discovery & Audit', desc: 'We deep-dive into your business challenges, identifying friction points in your current digital and hardware infrastructure.' },
                { step: '02', title: 'Architecture & Design', desc: 'Our team engineers a custom-tailored ecosystem, bridging the gap between creative UI and intelligent automation.' },
                { step: '03', title: 'Deployment & Scale', desc: 'We launch resilient systems built for long-term growth, with ongoing support to ensure maximum operational ROI.' }
              ].map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05, duration: 0.4 }}
                  style={{ position: 'relative', padding: '2rem', borderLeft: '2px solid var(--border-divider)' }}
                >
                  <div style={{ position: 'absolute', left: '-1px', top: '2rem', width: '2px', height: '3rem', background: 'var(--accent-blue)' }}></div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-blue)', opacity: 0.6, marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>{item.step}</div>
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>{item.title}</h4>
                  <p className="text-body" style={{ fontSize: '1.1rem' }}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 8: Industries We Serve (NEW) */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-secondary)', position: 'relative' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <span className="section-subtitle">OUR IMPACT</span>
              <h2 className="h2-title" style={{ marginTop: '0.5rem' }}>Solutions Across Sectors</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
              {[
                { icon: ShoppingCart, title: 'E-Commerce', text: 'Scalable platforms and automated fulfillment systems designed for high-volume growth.' },
                { icon: Factory, title: 'Industrial IoT', text: 'Bridge the physical-digital gap with custom sensor integration and real-time monitoring.' },
                { icon: Stethoscope, title: 'Healthcare', text: 'Secure, resilient data architectures and intuitive patient-facing management tools.' },
                { icon: Wallet, title: 'Fintech Solutions', text: 'Highly secure transaction engines and data-rich dashboards for strategic oversight.' }
              ].map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05, duration: 0.4 }}
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
                    <div className="service-card-v2" style={{ padding: '2rem', border: 'none', background: 'transparent', height: '100%' }}>
                      <div className="service-card-icon-v2">
                        <item.icon color="var(--accent-blue)" size={32} />
                      </div>
                      <h4 className="service-card-title-v2" style={{ fontSize: '1.25rem' }}>{item.title}</h4>
                      <p className="service-card-desc-v2">{item.text}</p>
                    </div>
                  </BorderGlow>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 9: Digital-Physical Synergy */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', overflow: 'hidden' }}>
          <div className="container">
            <div className="split-layout">
              <motion.div 
                variants={{ hidden: { opacity: 0, scale: 0.98 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.6 } } }}
                style={{ width: '100%' }}
              >
                <BorderGlow
                  edgeSensitivity={30}
                  glowColor="40 80 80"
                  backgroundColor="var(--bg-card)"
                  borderRadius={24}
                  glowRadius={60}
                  glowIntensity={1}
                  coneSpread={25}
                  animated={false}
                  colors={['#c084fc', '#f472b6', '#38bdf8']}
                >
                  <div 
                    className="graphic-panel"
                    style={{ background: 'linear-gradient(135deg, rgba(41, 121, 255, 0.08) 0%, rgba(41, 121, 255, 0.01) 100%)', border: '1px solid rgba(41, 121, 255, 0.1)', height: '400px', borderRadius: '1.5rem', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                  >
                    {/* Background glow orb */}
                    <div style={{ position: 'absolute', width: '200px', height: '200px', background: 'var(--accent-blue)', opacity: 0.1, filter: 'blur(50px)', borderRadius: '50%' }}></div>
                    
                    <motion.div
                      animate={{ y: [-15, 15, -15] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
                        style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', filter: 'drop-shadow(0 0 25px rgba(41, 121, 255, 0.4))' }}
                      >
                        <Layers size={140} color="var(--accent-blue)" strokeWidth={1} style={{ position: 'absolute', opacity: 0.9 }} />
                        <div style={{ position: 'absolute', background: 'var(--bg-primary)', borderRadius: '16px', padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                          <Cpu size={56} color="var(--accent-light)" strokeWidth={1.5} style={{ opacity: 1, zIndex: 2 }} />
                        </div>
                      </motion.div>
                    </motion.div>
                    
                    <div style={{ position: 'absolute', bottom: '2.5rem', textAlign: 'center', width: '100%' }}>
                      <span style={{ fontSize: '0.85rem', letterSpacing: '0.3em', opacity: 0.8, color: 'var(--accent-light)', fontWeight: 600 }}>INTEGRATED SYSTEMS</span>
                    </div>
                  </div>
                </BorderGlow>
              </motion.div>

              <div style={{ padding: '2rem' }}>
                <span className="section-subtitle" style={{ color: 'var(--accent-blue)' }}>THE XTENZIUM EDGE</span>
                <h2 className="h2-title" style={{ color: 'var(--text-primary)', marginTop: '1rem' }}>Bridging The Digital-Physical Divide</h2>
                <div className="divider mt-4" style={{ background: 'var(--accent-blue)' }}></div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '1.1rem', lineHeight: 1.8 }}>
                  We don't just build apps or hardware; we architect integrated ecosystems. By combining high-performance software with custom-engineered hardware and data-driven strategy, we create solutions that are more than the sum of their parts.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2.5rem' }}>
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
                  >
                    <div className="service-card-v2" style={{ padding: '1.5rem', background: 'transparent', border: 'none' }}>
                      <Zap color="var(--accent-blue)" size={24} />
                      <h5 style={{ marginTop: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Agile Resilience</h5>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Built to withstand market shifts.</p>
                    </div>
                  </BorderGlow>
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
                  >
                    <div className="service-card-v2" style={{ padding: '1.5rem', background: 'transparent', border: 'none' }}>
                      <Globe color="var(--accent-blue)" size={24} />
                      <h5 style={{ marginTop: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Global Scalability</h5>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ready for worldwide deployment.</p>
                    </div>
                  </BorderGlow>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 9: Core Tech Stack (NEW) */}
        <ScrollReveal className="section-padding-tight" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <span className="section-subtitle">OUR FOUNDATION</span>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>Core Technologies We Master</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3rem', opacity: 0.6 }}>
              {['React', 'TypeScript', 'Node.js', 'Vite', 'Framer Motion', 'Three.js', 'Tailwind', 'Python', 'IoT / C++', 'Cloud Architecture'].map((tech, i) => (
                <motion.span 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  {tech}
                </motion.span>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 11: Full-width CTA Banner (Always Visible) */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--accent-blue)' }}>
          <motion.div
            initial={{ opacity: 1 }}
            style={{ padding: '8rem 0', textAlign: 'center', position: 'relative', zIndex: 1 }}
          >
            <div className="container">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.4 }}
              >
                <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ffffff', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.1 }}>
                  Ready To Build Something Remarkable?
                </h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.25rem', marginBottom: '3rem', maxWidth: '600px', marginInline: 'auto' }}>
                  Let's architect your long-term success together with cutting-edge software and hardware innovation.
                </p>
                <Link to="/contact" className="btn-white-cta hero-cta-button">
                  Start A Conversation &rarr;
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default About;
