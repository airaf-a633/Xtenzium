import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface FormState {
  name: string;
  email: string;
  company: string;
  message: string;
}

const INITIAL: FormState = { name: '', email: '', company: '', message: '' };

const ContactSection = () => {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 8,
    letterSpacing: 0.2,
  };

  return (
    <section
      id="contact"
      style={{
        padding: '100px 24px',
        background: '#080808',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '80px',
          alignItems: 'start',
        }}
        className="contact-grid"
        >
          {/* Left — copy */}
          <div>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 24,
              letterSpacing: 0.5,
            }}>
              Let's talk
            </div>

            <h2 style={{
              color: '#ffffff',
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              margin: '0 0 20px',
            }}>
              Ready to build<br />something great?
            </h2>

            <p style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16,
              lineHeight: 1.7,
              margin: '0 0 40px',
              maxWidth: 400,
            }}>
              We're selective about what we take on — but if your project fits,
              we move fast. Tell us what you're building.
            </p>

            {/* Contact details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: '📧', label: 'Email', value: 'contact@xtenzium.com', href: 'mailto:contact@xtenzium.com' },
                { icon: '📍', label: 'Location', value: 'Karachi, Pakistan', href: null },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{item.label}</div>
                    {item.href ? (
                      <a href={item.href} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>
                        {item.value}
                      </a>
                    ) : (
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{item.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div>
            {status === 'success' ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 16,
                padding: '48px 32px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
                <h3 style={{ color: '#10b981', fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>
                  Message received
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: 0, lineHeight: 1.6 }}>
                  We'll review your message and get back to you within 24 hours.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  style={{
                    marginTop: 24,
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="contact-form-inner"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16,
                  padding: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      required
                      placeholder="Airaf Adil"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={set('company')}
                      placeholder="Xtenzium"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    required
                    placeholder="you@company.com"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>

                <div>
                  <label style={labelStyle}>What are you building? *</label>
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    required
                    rows={5}
                    placeholder="Tell us about your project, timeline, and goals…"
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>

                {status === 'error' && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8,
                    color: '#f87171',
                    fontSize: 14,
                  }}>
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  style={{
                    padding: '14px',
                    background: status === 'loading' ? 'rgba(255,255,255,0.1)' : '#ffffff',
                    color: status === 'loading' ? '#666' : '#0a0a0a',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    letterSpacing: -0.2,
                  }}
                >
                  {status === 'loading' ? 'Sending…' : 'Send message →'}
                </button>

                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: 0, textAlign: 'center' }}>
                  No spam, no cold pitches. We respond to every real inquiry.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
          .contact-form-inner {
            padding: 24px !important;
          }
        }
      `}</style>
    </section>
  );
};

export default ContactSection;
