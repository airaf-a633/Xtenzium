import { motion } from 'framer-motion';
import SEO from '../components/SEO';
import { easings } from '../theme';
import { Cpu, Database, Wrench } from 'lucide-react';
import { WordSplitter } from '../components/animations/TextReveal';
import ScrollReveal from '../components/animations/ScrollReveal';
import BorderGlow from '../components/BorderGlow';

const sectionHeaderVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easings.global } }
};

const Electronics = () => {
  return (
    <>
      <SEO
        title="IoT & Embedded Systems — PCB Design Company Karachi"
        url="/electronics"
        description="Xtenzium builds custom IoT devices, PCB designs, and embedded firmware for businesses in Pakistan and globally. Hardware and software engineering under one roof in Karachi."
      />
    <div className="main-wrapper" style={{ paddingTop: '100px', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>
      <ScrollReveal id="electronics" className="section-padding">
        <div className="container">
          <div className="section-header">
            <motion.span 
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
              variants={sectionHeaderVariants} className="section-subtitle" style={{ display: 'inline-block' }}
            >
              Precision Hardware
            </motion.span>
            <br/>
            <WordSplitter text="Electronics Division" className="h2-title" />
            <motion.p 
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0, transition: { duration: 0.65, delay: 0.2, ease: easings.global } }}
              viewport={{ once: true, amount: 0.15 }}
              className="text-body mt-4 text-center"
              style={{ maxWidth: '800px', margin: '1rem auto 0 auto' }}
            >
              Beyond software, we build the physical layer. Our electronics department is tasked with the design, assembly, and deployment of complex hardware systems.
            </motion.p>
          </div>

          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              visible: { transition: { staggerChildren: 0.05 } }
            }}
            className="electronics-grid"
          >
            {[
              { icon: Cpu, title: "Hardware Builds", desc: "We design and build custom electronics products, ensuring rigorous quality control and architectural integrity." },
              { icon: Database, title: "Database & Network", desc: "Analysis and maintenance of product databases and networks, keeping systems robust and connected." },
              { icon: Wrench, title: "Maintenance", desc: "Comprehensive on-site installation services and long-term hardware maintenance protocols." }
            ].map((service, idx) => (
              <motion.div 
                key={idx} 
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { 
                    opacity: 1, y: 0, 
                    transition: { duration: 0.4 } 
                  }
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
                  <div className="service-card-v2" style={{ border: 'none', background: 'transparent', padding: '2rem', height: '100%' }}>
                    <div className="service-card-icon-v2">
                      <service.icon color="var(--accent-light)" size={32} />
                    </div>
                    
                    <h4 className="service-card-title-v2" style={{ fontSize: '1.25rem' }}>{service.title}</h4>
                    <p className="service-card-desc-v2">{service.desc}</p>
                  </div>
                </BorderGlow>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </ScrollReveal>
    </div>
    </>
  );
};

export default Electronics;
