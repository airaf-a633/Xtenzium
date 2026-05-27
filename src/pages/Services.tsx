import { motion } from 'framer-motion';
import { 
  ArrowRight,
  Briefcase,
  TrendingUp,
  Palette,
  Settings,
  Code,
  Cpu
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ScrollReveal from '../components/animations/ScrollReveal';
import { easings } from '../theme';
import BorderGlow from '../components/BorderGlow';

interface AccordionCard {
  id: string;
  title: string;
  tagline: string;
  pills: string[];
  totalCount: number;
  link: string;
  icon: any;
}

const servicesData: AccordionCard[] = [
  {
    id: '01',
    title: 'Consultancy',
    tagline: 'Get a full overview of our consultancy services',
    icon: Briefcase,
    pills: ['Digital Transformation', 'AI Consultancy', 'Market Research'],
    totalCount: 7,
    link: '/services/consultancy'
  },
  {
    id: '02',
    title: 'Marketing',
    tagline: 'Get a full overview of our marketing services',
    icon: TrendingUp,
    pills: ['Marketing Strategy', 'SEO', 'Paid Advertising'],
    totalCount: 9,
    link: '/services/marketing'
  },
  {
    id: '03',
    title: 'Design',
    tagline: 'Get a full overview of our design services',
    icon: Palette,
    pills: ['Web Design', 'Graphic Design', 'Branding'],
    totalCount: 5,
    link: '/services/design'
  },
  {
    id: '04',
    title: 'Technical',
    tagline: 'Get a full overview of our technical services',
    icon: Settings,
    pills: ['Managed IT Services', 'Cloud Services', 'Cyber Security'],
    totalCount: 8,
    link: '/services/technical'
  },
  {
    id: '05',
    title: 'Development',
    tagline: 'Get a full overview of our development services',
    icon: Code,
    pills: ['Web Development', 'Software Development', 'eCommerce'],
    totalCount: 11,
    link: '/services/development'
  },
  {
    id: '06',
    title: 'IoT & Embedded Systems',
    tagline: 'Beyond software, we build the physical layer',
    icon: Cpu,
    pills: ['PCB Design & Layout', 'Embedded Firmware Development', 'Smart Home Automation'],
    totalCount: 28,
    link: '/services/iot'
  }
];

const ServiceCard = ({ card, index }: { card: AccordionCard; index: number }) => {
  const moreCount = card.totalCount - card.pills.length;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: easings.global }}
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
          className="accordion-card"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '40px 32px',
            boxShadow: 'none',
            minHeight: '420px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            height: '100%'
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ 
              width: '3.5rem', 
              height: '3.5rem', 
              background: 'rgba(41, 121, 255, 0.1)', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--accent-light)'
            }}>
              <card.icon size={28} />
            </div>
            
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '36px',
              fontWeight: 800,
              color: 'var(--card-number-color)',
              lineHeight: 1
            }}>
              {card.id}
            </span>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px'
            }}>
              {card.title}
            </h3>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              margin: 0
            }}>
              {card.tagline}
            </p>
          </div>

          {/* Visible Content */}
          <div style={{ flexGrow: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '1rem' }}>
              {card.pills.map((pill, pi) => (
                <span
                  key={pi}
                  style={{
                    background: 'rgba(41, 121, 255, 0.15)',
                    color: 'var(--accent-light)',
                    borderRadius: '20px',
                    fontSize: '12px',
                    padding: '6px 14px',
                    fontWeight: 500,
                    margin: '4px',
                    border: '1px solid rgba(41, 121, 255, 0.3)'
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
            {moreCount > 0 && (
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text-muted)', 
                fontStyle: 'italic',
                margin: '0 0 1.5rem 4px'
              }}>
                +{moreCount} more services
              </p>
            )}
          </div>

          {/* View All link */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
            <Link
              to={card.link}
              className="accordion-view-all"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: '2rem',
                padding: '10px 24px',
                transition: 'all 0.3s ease',
                cursor: 'none'
              }}
            >
              View All <ArrowRight size={16} className="accordion-arrow" />
            </Link>
          </div>
        </div>
      </BorderGlow>
    </motion.div>
  );
};

const Services = () => {
  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', background: 'var(--bg-primary)' }}>
      {/* Section: Hero Banner */}
      <section className="section-padding" style={{ padding: '100px 0' }}>
        <div className="container">
          <div className="max-width-800">
            <span className="section-subtitle">WHAT WE OFFER</span>
            <h1 className="h1-title" style={{ marginTop: '1rem', fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Services Built For <span style={{ color: 'var(--accent-blue)' }}>The Digital Age.</span>
            </h1>
            <p className="text-body mt-6" style={{ maxWidth: '650px', fontSize: '1.25rem', color: 'var(--text-secondary)' }}>
              From code to content, hardware to design — Xtenzium delivers end-to-end digital solutions tailored to your business goals.
            </p>
          </div>
        </div>
      </section>

      {/* Section 1: Full Service Catalogue */}
      <section className="section-padding" style={{ background: 'var(--bg-secondary)', padding: '100px 0' }}>
        <div className="container">
          <div className="section-header" style={{ textAlign: 'left', margin: '0 0 4rem 0' }}>
            <span className="section-subtitle">FULL SERVICE CATALOGUE</span>
            <h2 className="h2-title" style={{ fontSize: '2.5rem', fontWeight: 800 }}>Every Solution Under One Roof</h2>
            <p className="text-body" style={{ marginTop: '1rem', maxWidth: '600px', color: 'var(--text-secondary)' }}>
              From digital marketing to embedded hardware — we cover every dimension of your business needs.
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '1.5rem',
            alignItems: 'stretch'
          }}>
            {servicesData.map((card, idx) => (
              <ServiceCard
                key={card.id}
                card={card}
                index={idx}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Blue CTA Banner */}
      <ScrollReveal className="relative overflow-hidden">
        <motion.div
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ background: 'var(--accent-blue)', padding: '8rem 0', textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ffffff', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.1 }}>
                Ready To Get Started?
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.25rem', marginBottom: '2.5rem', fontWeight: 300 }}>
                Let's build something remarkable together.
              </p>
              <a
                href="#contact"
                className="btn-white-cta"
              >
                Let's Talk &rarr;
              </a>
            </motion.div>
          </div>
        </motion.div>
      </ScrollReveal>
    </div>
  );
};

export default Services;
