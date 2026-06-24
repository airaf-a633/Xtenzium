import { motion } from 'framer-motion';
import SEO from '../components/SEO';
import { easings } from '../theme';
import { ShieldCheck, Network, Zap, AlertCircle, Compass, Eye, Target } from 'lucide-react';
import { WordSplitter } from '../components/animations/TextReveal';
import ScrollReveal from '../components/animations/ScrollReveal';
import BorderGlow from '../components/BorderGlow';
import OrbitalStrategy from '../components/OrbitalStrategy';

const sectionHeaderVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easings.global } }
};

const Strategy = () => {
  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', background: 'var(--bg-primary)', position: 'relative' }}>
      <SEO
        title="Our Strategy"
        url="/strategy"
        description="Xtenzium's strategy bridges abstract vision with market reality. Rigorous analysis, intelligent execution, and data-driven systems built for long-term resilience."
      />
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>
      
      {/* 6. Strategy Split Layout */}
      <ScrollReveal id="strategy" className="section-padding" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          {/* We stagger the text side and image side simultaneously */}
          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              visible: { transition: { staggerChildren: 0.1 } }
            }}
            className="split-layout"
          >
            {/* Text Side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <motion.span variants={sectionHeaderVariants} className="section-subtitle">Our Strategy</motion.span>
              <WordSplitter text="Bridging Abstract Vision & Market Reality" className="h2-title" />
              
              <motion.div 
                variants={{ hidden: { scaleX: 0, opacity: 0 }, visible: { scaleX: 1, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } } }}
                style={{ originX: 0 }}
                className="divider"
              ></motion.div>
              
              <motion.p variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }} className="text-body" style={{ marginBottom: '1.5rem' }}>
                At Xtenzium, we don't just execute tasks. Our strategy is built on a deep understanding of your market dynamics and internal operations.
              </motion.p>
              
              <div className="features-grid">
                <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }} style={{ height: '100%' }}>
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
                    <div className="service-card-v2" style={{ padding: '2rem', border: 'none', background: 'transparent' }}>
                      <ShieldCheck color="var(--accent-light)" size={32} style={{ marginBottom: '1rem' }} />
                      <h4 className="service-card-title-v2" style={{ fontSize: '1.25rem' }}>Rigorous Analysis</h4>
                      <p className="service-card-desc-v2">Real-time metrics to ensure maximum ROI.</p>
                    </div>
                  </BorderGlow>
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }} style={{ height: '100%' }}>
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
                    <div className="service-card-v2" style={{ padding: '2rem', border: 'none', background: 'transparent' }}>
                      <Network color="var(--accent-light)" size={32} style={{ marginBottom: '1rem' }} />
                      <h4 className="service-card-title-v2" style={{ fontSize: '1.25rem' }}>Intelligent Execution</h4>
                      <p className="service-card-desc-v2">Systems built for long-term resilience.</p>
                    </div>
                  </BorderGlow>
                </motion.div>
              </div>
            </div>
            
            {/* Image/Graphic Side */}
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
                <OrbitalStrategy />
              </BorderGlow>
            </motion.div>
          </motion.div>
        </div>
      </ScrollReveal>

      {/* 3. Mission, Vision */}
      <ScrollReveal className="section-padding" style={{ background: 'var(--bg-primary)' }}>
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="swot-grid">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
              variants={{ hidden: { opacity: 0, y: 20, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6 } } }} 
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
                <div className="swot-card" style={{ background: 'transparent', border: 'none', padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <h4 className="swot-title"><Eye size={24} /> Our Vision</h4>
                  <p className="text-body">To become the leading catalyst for digital transformation globally. We envision a future where technology seamlessly amplifies human potential.</p>
                </div>
              </BorderGlow>
            </motion.div>
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
              variants={{ hidden: { opacity: 0, y: 20, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, delay: 0.15 } } }} 
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
                <div className="swot-card" style={{ background: 'transparent', border: 'none', padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <h4 className="swot-title"><Target size={24} /> Our Mission</h4>
                  <p className="text-body">To empower modern businesses by bridging the gap between creative design and intelligent automation. We deliver comprehensive digital solutions solving complex operational problems.</p>
                </div>
              </BorderGlow>
            </motion.div>
          </div>
        </div>
      </ScrollReveal>

      {/* 7. S.W.O.T */}
      <ScrollReveal id="swot" className="section-padding" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <motion.span 
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
              variants={sectionHeaderVariants} className="section-subtitle" style={{ display: 'inline-block' }}
            >
              Analysis
            </motion.span>
            <br/>
            <WordSplitter text="S.W.O.T Market Analysis" className="h2-title" />
          </div>
          
          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, amount: 0.15 }}
            variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
            className="swot-grid"
          >
            {[
              { icon: Zap, title: "Strengths", items: ["Bridging creative design and automation securely.", "Leveraging AI-driven workflows to redefine efficiency.", "High-performance systems built for future growth."] },
              { icon: AlertCircle, title: "Weaknesses", items: ["Scaling specialized talent effectively during rapid growth.", "Maintaining signature quality standards through transitions."] },
              { icon: Compass, title: "Opportunities", items: ["Expanding global brand reach across new demographics.", "Launching next-gen enterprise automation tools.", "Adapting digital assets to meet shifting tech trends."] },
              { icon: ShieldCheck, title: "Threats", items: ["Navigating rapid industry shifts and high competition.", "Continuous necessity for agility and innovation."] }
            ].map((quadrant, idx) => (
              <motion.div 
                key={idx}
                variants={{
                  hidden: { opacity: 0, scale: 0.95, y: 20 },
                  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: easings.global } }
                }}
                style={{ height: '100%' }}
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
                  <div className="swot-card" style={{ background: 'transparent', border: 'none', padding: '2rem', height: '100%' }}>
                    <h4 className="swot-title">
                      <motion.div
                        variants={{ hidden: { scale: 0 }, visible: { scale: 1, transition: { delay: 0.2, duration: 0.4 } } }}
                        style={{ background: 'rgba(41,121,255,0.2)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <quadrant.icon size={24} color="var(--accent-light)" />
                      </motion.div>
                      {quadrant.title}
                    </h4>
                    <ul className="text-body" style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0 }}>
                      {quadrant.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </BorderGlow>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </ScrollReveal>

    </div>
  );
};

export default Strategy;
