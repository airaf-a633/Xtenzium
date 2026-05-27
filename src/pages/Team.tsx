import { motion } from 'framer-motion';
import { easings } from '../theme';
import { WordSplitter } from '../components/animations/TextReveal';
import ScrollReveal from '../components/animations/ScrollReveal';
import BorderGlow from '../components/BorderGlow';
const sectionHeaderVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easings.global } }
};

const Team = () => {
  const teamMembers = [
    {
      img: '/Airaf.png',
      name: 'M. Airaf Adil',
      title: 'CEO',
      quote: '"We act as your long-term strategic partner, dedicating ourselves to driving sustainable growth and pushing the boundaries of digital innovation for your business."',
      flip: false
    },
    {
      img: '/sharab.png',
      name: 'Sharab Khan',
      title: 'COO',
      quote: '"Our entire team is dedicated to a deep-dive understanding of your unique business challenges, ensuring seamless execution and operational excellence at every stage."',
      flip: false
    },
    {
      img: '/Umar.png',
      name: 'Umar Siddiqui',
      title: 'CMO',
      quote: '"We combine creative design with intelligent automation to streamline your operations, crafting compelling brand narratives that perfectly resonate with your target audience."',
      flip: true
    },
    {
      img: '/Saad.png',
      name: 'S.M.SAAD',
      title: 'Electronics Lead Engineer',
      quote: '"Leading the Electronics Division, S.M.SAAD brings unparalleled expertise to intelligent hardware design and robust network integration."',
      flip: false
    }
  ];

  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>
      <ScrollReveal id="team" className="section-padding" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <motion.span 
              initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}
              variants={sectionHeaderVariants} className="section-subtitle" style={{ display: 'inline-block' }}
            >
              Leadership
            </motion.span>
            <br/>
            <WordSplitter text="Meet The Team" className="h2-title" />
          </div>

          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              visible: { transition: { staggerChildren: 0.05 } } 
            }}
            className="team-grid"
            style={{ alignItems: 'stretch' }}
          >
            {teamMembers.map((member, idx) => (
              <motion.div 
                key={idx} 
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
                  borderRadius={24}
                  glowRadius={40}
                  glowIntensity={1}
                  coneSpread={25}
                  animated={false}
                  colors={['#c084fc', '#f472b6', '#38bdf8']}
                  className="h-full"
                >
                  <div className="service-card-v2 team-card-v2" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'transparent', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* 1. Photo Wrap */}
                    <div className="team-img-wrapper" style={{ position: 'relative', height: '300px' }}>
                      <motion.div
                        variants={{
                          hidden: { clipPath: 'inset(100% 0 0 0)' },
                          visible: { clipPath: 'inset(0% 0 0 0)', transition: { duration: 0.6, ease: "easeOut" } }
                        }}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <img 
                          src={member.img} 
                          alt={`${member.name} - ${member.title}`} 
                          className={member.flip ? 'flip-horizontal' : ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </motion.div>
                    </div>

                    <div className="team-info" style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      {/* 2. Name */}
                      <h4 className="service-card-title-v2" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{member.name}</h4>
                      
                      {/* 3. Role */}
                      <div style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                        {member.title}
                      </div>
                      
                      {/* 4. Quote */}
                      <div className="team-quote-v2" style={{ flexGrow: 1 }}>
                        <q>{member.quote.replace(/"/g, '')}</q>
                      </div>
                    </div>
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

export default Team;
