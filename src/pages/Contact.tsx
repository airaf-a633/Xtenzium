import React from 'react';
import { motion } from 'framer-motion';
import { Mail, MapPin, ArrowRight } from 'lucide-react';
import ScrollReveal from '../components/animations/ScrollReveal';

const Contact = () => {
  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', background: 'var(--bg-primary)', position: 'relative', minHeight: '100vh' }}>
      {/* Background Grid */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>
      
      <ScrollReveal className="section-padding" style={{ position: 'relative', zIndex: 10 }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '4rem', alignItems: 'flex-start' }}>
            
            {/* Left Column: Text & Info */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              {/* Badge */}
              <div>
                <span style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem', 
                  padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2rem',
                  fontSize: '0.85rem', color: '#e2e8f0'
                }}>
                  <div style={{ width: '8px', height: '8px', background: '#1E90FF', borderRadius: '50%', boxShadow: '0 0 10px #1E90FF' }}></div>
                  Let's talk
                </span>
              </div>

              {/* Headings */}
              <div>
                <h1 style={{ 
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', 
                  fontWeight: 800, lineHeight: 1.1, color: '#ffffff', letterSpacing: '-0.02em'
                }}>
                  Ready to build<br/>something great?
                </h1>
                <p style={{ marginTop: '1.5rem', fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '450px' }}>
                  We're selective about what we take on — but if your project fits, we move fast. Tell us what you're building.
                </p>
              </div>

              {/* Contact Blocks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    <Mail size={18} color="#1E90FF" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>Email</div>
                    <div style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: 500 }}>contact@xtenzium.com</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    <MapPin size={18} color="#f43f5e" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>Location</div>
                    <div style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: 500 }}>Karachi, Pakistan</div>
                  </div>
                </div>
              </div>

            </motion.div>

            {/* Right Column: Form */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  alert("Thank you! Your message has been sent successfully.");
                  e.currentTarget.reset();
                }}
                style={{ 
                  background: 'rgba(20, 20, 20, 0.4)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '24px', 
                  padding: 'clamp(1.5rem, 5vw, 3rem)',
                  display: 'flex', flexDirection: 'column', gap: '2rem'
                }}
              >
                {/* Grid for Name / Company */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Name *</label>
                    <input 
                      type="text" 
                      placeholder="Airaf Adil"
                      style={{ 
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px', padding: '0.8rem 1rem', color: '#ffffff',
                        outline: 'none', transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1E90FF'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Company</label>
                    <input 
                      type="text" 
                      placeholder="Xtenzium"
                      style={{ 
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px', padding: '0.8rem 1rem', color: '#ffffff',
                        outline: 'none', transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1E90FF'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>

                {/* Email */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Email *</label>
                  <input 
                    type="email" 
                    placeholder="you@company.com"
                    style={{ 
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px', padding: '0.8rem 1rem', color: '#ffffff',
                      outline: 'none', transition: 'border-color 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1E90FF'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>

                {/* Message */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>What are you building? *</label>
                  <textarea 
                    placeholder="Tell us about your project, timeline, and goals..."
                    rows={5}
                    style={{ 
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px', padding: '1rem', color: '#ffffff',
                      outline: 'none', transition: 'border-color 0.3s', resize: 'vertical'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1E90FF'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  ></textarea>
                </div>

                {/* Submit */}
                <button 
                  type="submit"
                  style={{ 
                    marginTop: '1rem', background: '#ffffff', color: '#000000', 
                    border: 'none', borderRadius: '8px', padding: '1rem',
                    fontSize: '1rem', fontWeight: 700, display: 'flex', 
                    justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                    cursor: 'pointer', transition: 'transform 0.2s, background 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  Send message <ArrowRight size={18} />
                </button>

              </form>
            </motion.div>

          </div>

        </div>
      </ScrollReveal>
    </div>
  );
};

export default Contact;
