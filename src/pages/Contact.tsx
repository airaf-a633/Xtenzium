import { useState } from 'react';
import SEO from '../components/SEO';
import { motion } from 'framer-motion';
import { Mail, MapPin, ArrowRight } from 'lucide-react';
import ScrollReveal from '../components/animations/ScrollReveal';
import { supabase } from '../lib/supabase';

interface FormState {
  name: string;
  email: string;
  company: string;
  message: string;
}

const INITIAL: FormState = { name: '', email: '', company: '', message: '' };

const Contact = () => {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const { error } = await supabase.from('leads').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim() || null,
      message: form.message.trim(),
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again or email us directly.');
    } else {
      setStatus('success');
      setForm(INITIAL);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '0.8rem 1rem',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.3s',
    width: '100%',
    fontSize: '1rem',
    fontFamily: 'inherit',
  };

  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', background: 'var(--bg-primary)', position: 'relative', minHeight: '100vh' }}>
      <SEO
        title="Contact — Hire Web Developers in Karachi, Pakistan"
        url="/contact"
        description="Hire web developers, UI/UX designers, and IoT engineers in Karachi. Start a project with Xtenzium — Pakistan's full-service digital agency. Free consultation."
      />
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03 }}></div>

      <ScrollReveal className="section-padding" style={{ position: 'relative', zIndex: 10 }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '4rem', alignItems: 'flex-start' }}>

            {/* Left Column */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2rem',
                  fontSize: '0.85rem', color: '#e2e8f0',
                }}>
                  <div style={{ width: '8px', height: '8px', background: '#1E90FF', borderRadius: '50%', boxShadow: '0 0 10px #1E90FF' }}></div>
                  Let's talk
                </span>
              </div>

              <div>
                <h1 style={{
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                  fontWeight: 800, lineHeight: 1.1, color: '#ffffff', letterSpacing: '-0.02em',
                }}>
                  Ready to build<br/>something great?
                </h1>
                <p style={{ marginTop: '1.5rem', fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '450px' }}>
                  We're selective about what we take on — but if your project fits, we move fast. Tell us what you're building.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <Mail size={18} color="#1E90FF" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>Email</div>
                    <a href="mailto:contact@xtenzium.com" style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: 500, textDecoration: 'none' }}>contact@xtenzium.com</a>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <MapPin size={18} color="#f43f5e" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>Location</div>
                    <div style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: 500 }}>Karachi, Pakistan</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Column — Form */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {status === 'success' ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '24px', padding: '3rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
                  <h3 style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Message received</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                    We'll review your message and get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    style={{ marginTop: '1.5rem', padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Send another
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  style={{ background: 'rgba(20,20,20,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: 'clamp(1.5rem,5vw,3rem)', display: 'flex', flexDirection: 'column', gap: '2rem' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Name *</label>
                      <input type="text" value={form.name} onChange={set('name')} required placeholder="Airaf Adil" style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Company</label>
                      <input type="text" value={form.company} onChange={set('company')} placeholder="Xtenzium" style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Email *</label>
                    <input type="email" value={form.email} onChange={set('email')} required placeholder="you@company.com" style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>What are you building? *</label>
                    <textarea value={form.message} onChange={set('message')} required rows={5}
                      placeholder="Tell us about your project, timeline, and goals..."
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                      onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                    />
                  </div>

                  {status === 'error' && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    style={{ marginTop: '0.5rem', background: status === 'loading' ? 'rgba(255,255,255,0.1)' : '#ffffff', color: status === 'loading' ? '#666' : '#000000', border: 'none', borderRadius: '8px', padding: '1rem', fontSize: '1rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: status === 'loading' ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                  >
                    {status === 'loading' ? 'Sending…' : <><span>Send message</span> <ArrowRight size={18} /></>}
                  </button>
                </form>
              )}
            </motion.div>

          </div>
        </div>
      </ScrollReveal>
    </div>
  );
};

export default Contact;
