import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, User, Clock, ChevronRight, Search } from 'lucide-react';
import { WordSplitter } from '../components/animations/TextReveal';
import ScrollReveal from '../components/animations/ScrollReveal';
import BorderGlow from '../components/BorderGlow';


const BLOG_POSTS = [
  {
    id: 1,
    title: "The Future of Smart Automation in Digital Workflows",
    excerpt: "How AI and intelligent automation are reshaping how modern businesses handle complex digital operations.",
    author: "Airaf Adil",
    date: "April 20, 2026",
    readTime: "6 min read",
    category: "Automation",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800",
    featured: true
  },
  {
    id: 2,
    title: "Mastering UI/UX: Beyond Just Aesthetics",
    excerpt: "Understanding the psychological impact of design decisions on user retention and brand loyalty.",
    author: "Sharab Khan",
    date: "April 15, 2026",
    readTime: "5 min read",
    category: "Design",
    image: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 3,
    title: "Scaling IoT Solutions for Industrial Applications",
    excerpt: "The challenges and breakthroughs in deploying large-scale sensor networks in harsh environments.",
    author: "S.M. SAAD",
    date: "April 12, 2026",
    readTime: "8 min read",
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 4,
    title: "SEO in 2026: The Shift to Semantic Relevance",
    excerpt: "Why traditional keyword stuffing is dead and how to optimize for intent and context.",
    author: "Umar Siddiqui",
    date: "April 08, 2026",
    readTime: "4 min read",
    category: "Growth",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800"
  }
];

const CATEGORIES = ["All", "Automation", "Design", "Electronics", "Growth", "Agency"];

const Blogs = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = BLOG_POSTS.filter(post => {
    const matchesCategory = activeCategory === 'All' || post.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPost = filteredPosts.find(p => p.featured);
  const regularPosts = filteredPosts.filter(p => !p.featured);

  return (
    <div className="main-wrapper" style={{ paddingTop: '100px', background: 'var(--bg-primary)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.03, pointerEvents: 'none' }}></div>

      {/* Hero Section */}
      <section className="section-padding relative z-10">
        <div className="container text-center">
          <motion.span 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="section-subtitle"
          >
            OUR JOURNAL
          </motion.span>
          <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
            <WordSplitter text="Insights & Innovation" className="h1-super" />
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-body mx-auto"
            style={{ maxWidth: '600px' }}
          >
            Deep dives into technology, design, and digital strategy from the experts at Xtenzium.
          </motion.p>
        </div>
      </section>

      {/* Category Filter & Search */}
      <section className="pb-12 relative z-10">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid var(--border-divider)', paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{ 
                      padding: '0.5rem 1.25rem', 
                      borderRadius: '2rem', 
                      border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      background: isActive ? 'var(--accent-blue)' : 'var(--bg-card)',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? '0 4px 12px rgba(41, 121, 255, 0.2)' : 'none'
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <input 
                type="text" 
                placeholder="Search articles..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem 1rem 0.75rem 2.5rem', 
                  borderRadius: '0.75rem', 
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      {featuredPost && (
        <ScrollReveal className="pb-20 relative z-10">
          <div className="container">
            <BorderGlow
              edgeSensitivity={30}
              glowColor="40 80 80"
              backgroundColor="var(--bg-card)"
              borderRadius={32}
              glowRadius={60}
              glowIntensity={1}
              coneSpread={25}
              animated={false}
              colors={['#c084fc', '#f472b6', '#38bdf8']}
            >
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  background: 'transparent', 
                  borderRadius: '2rem', 
                  overflow: 'hidden', 
                  border: 'none'
                }}
              >
                <div style={{ position: 'relative', height: '100%', minHeight: '400px', background: '#F1F5F9' }}>
                  <img src={featuredPost.image} alt={featuredPost.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ 
                    position: 'absolute', 
                    top: '1.5rem', 
                    left: '1.5rem', 
                    background: '#2979FF', 
                    color: 'white', 
                    padding: '0.5rem 1.25rem', 
                    borderRadius: '0.5rem', 
                    fontWeight: 700, 
                    fontSize: '0.875rem',
                    boxShadow: '0 4px 12px rgba(41, 121, 255, 0.3)'
                  }}>
                    FEATURED
                  </div>
                </div>
                <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', textTransform: 'uppercase' }}>{featuredPost.category}</div>
                  <h2 className="h2-title" style={{ marginBottom: '1.5rem', fontSize: '2.5rem', color: 'var(--text-primary)' }}>{featuredPost.title}</h2>
                  <p className="text-body" style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>{featuredPost.excerpt}</p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={16} color="var(--text-secondary)" />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{featuredPost.author}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{featuredPost.date}</span>
                    </div>
                  </div>

                  <motion.button 
                    whileHover={{ x: 5 }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      color: '#2979FF', 
                      fontWeight: 700, 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    Read Article <ChevronRight size={20} />
                  </motion.button>
                </div>
              </div>
            </BorderGlow>
          </div>
        </ScrollReveal>
      )}

      {/* Posts Grid */}
      <section className="section-padding relative z-10" style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-divider)' }}>
        <div className="container">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeCategory + searchQuery}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2.5rem' }}
            >
              {regularPosts.length > 0 ? regularPosts.map((post, i) => (
                <motion.div 
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
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
                    <div style={{ 
                      background: 'transparent', 
                      borderRadius: '1.5rem', 
                      overflow: 'hidden', 
                      border: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%'
                    }}>
                      <div style={{ height: '240px', position: 'relative', background: '#F1F5F9' }}>
                        <img src={post.image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ 
                          position: 'absolute', 
                          bottom: '1rem', 
                          left: '1rem', 
                          background: 'rgba(255,255,255,0.95)', 
                          backdropFilter: 'blur(10px)', 
                          padding: '0.35rem 0.85rem', 
                          borderRadius: '0.5rem', 
                          fontWeight: 700, 
                          fontSize: '0.75rem', 
                          color: '#2979FF',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          border: '1px solid rgba(41, 121, 255, 0.1)'
                        }}>
                          {post.category}
                        </div>
                      </div>
                      <div style={{ padding: '2rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                            <Calendar size={14} /> {post.date}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Clock size={14} /> {post.readTime}
                          </div>
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', lineHeight: 1.3, color: 'var(--text-primary)' }}>{post.title}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem', flexGrow: 1 }}>{post.excerpt}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2979FF', fontWeight: 700, cursor: 'pointer' }}>
                          Read Full Story <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  </BorderGlow>
                </motion.div>
              )) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem' }}>
                  <Search size={48} style={{ color: '#CBD5E1', marginBottom: '1.5rem' }} />
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>No articles found</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                    {searchQuery ? `No results for "${searchQuery}"` : `No articles in the ${activeCategory} category yet.`}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div style={{ marginTop: '5rem', textAlign: 'center' }}>
            <button className="btn-secondary">Load More Articles</button>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <ScrollReveal className="section-padding relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div className="container">
          <BorderGlow
            edgeSensitivity={30}
            glowColor="40 80 80"
            backgroundColor="var(--bg-card)"
            borderRadius={40}
            glowRadius={70}
            glowIntensity={1}
            coneSpread={25}
            animated={false}
            colors={['#c084fc', '#f472b6', '#38bdf8']}
          >
            <div style={{ background: 'transparent', border: 'none', borderRadius: '2.5rem', padding: '5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="grid-bg" style={{ opacity: 0.05 }}></div>
              <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                <h2 className="h2-title" style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Stay Ahead of the Curve</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>Get the latest insights on digital transformation and hardware innovation delivered directly to your inbox.</p>
                <form style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    style={{ 
                      flexGrow: 1, 
                      padding: '1rem 1.5rem', 
                      borderRadius: '3rem', 
                      border: '1px solid var(--border-divider)', 
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button type="submit" className="btn-primary" style={{ border: 'none' }}>Subscribe Now</button>
                </form>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>We respect your privacy. Unsubscribe at any time.</p>
              </div>
            </div>
          </BorderGlow>
        </div>
      </ScrollReveal>
    </div>
  );
};

export default Blogs;
