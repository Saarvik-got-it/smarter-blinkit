'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

const features = [
  { icon: '🧠', title: 'AI Recipe Agent', desc: 'Type "Make pizza for 4" — AI fills your cart automatically with all ingredients from nearby shops.' },
  { icon: '🔍', title: 'Intent Search', desc: 'Search "I have a cold" and get Honey, Ginger Tea & Vitamin C — not just keyword matches.' },
  { icon: '📦', title: 'Barcode Inventory', desc: 'Sellers scan barcodes to instantly update stock. No manual typing needed.' },
  { icon: '🗺', title: 'Local First', desc: 'Orders auto-routed to the closest open shop for fast, cheap delivery.' },
  { icon: '🔗', title: 'Smart Suggestions', desc: 'Graph-powered "Bought Together" using Neo4j — like Netflix recommendations for groceries.' },
  { icon: '🪪', title: 'Face ID Login', desc: 'Secure face recognition login using your device camera, powered by face-api.js.' },
];

const stages = [
  { num: '01', label: 'Foundation', items: ['Dual login (Buyer & Seller)', 'Intent search', 'Barcode scanner', 'Mock payments'] },
  { num: '02', label: 'The Automator', items: ['AI Recipe Agent (Gemini)', 'Similar items (Neo4j graph)', 'Smart suggestions'] },
  { num: '03', label: 'Orchestrator', items: ['Smart cart splitting', 'Live storeboard', 'Real-time Socket.io'] },
  { num: '04', label: 'God Mode', items: ['Money Map heatmap', 'AI product pairing'] },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '64px' }}>
        {/* Hero */}
        <section style={{ minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,210,106,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', maxWidth: '800px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-full)', padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '24px' }}>
              🚀 AI-Powered Local Marketplace
            </div>
            <h1 style={{ marginBottom: '24px' }}>
              Shop smarter with<br /><span className="gradient-text">AI that understands you</span>
            </h1>
            <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '560px', margin: '0 auto 40px' }}>
              Don't search item by item. Tell us what you want to cook, your health needs, or your occasion — and we fill your cart from nearby shops automatically.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn btn-primary btn-lg">Start Shopping →</Link>
              <Link href="/register?role=seller" className="btn btn-secondary btn-lg">Sell on Platform</Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: '80px 24px', background: 'var(--bg-secondary)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <h2>Everything you need, <span className="text-accent">AI-powered</span></h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px', maxWidth: '480px', margin: '12px auto 0' }}>From intent-aware search to graph-based suggestions — every feature has intelligence built in.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {features.map(f => (
                <div key={f.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '2.2rem' }}>{f.icon}</div>
                  <h3 style={{ fontSize: '1.05rem' }}>{f.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stages */}
        <section style={{ padding: '80px 24px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <h2>The 4-Stage Approach</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Built in progressive stages, each one smarter than the last.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {stages.map(s => (
                <div key={s.num} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--bg-elevated)', lineHeight: 1, position: 'absolute', top: -4, right: 16, userSelect: 'none' }}>{s.num}</div>
                  <div className="badge badge-green" style={{ marginBottom: '12px' }}>Stage {s.num}</div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{s.label}</h3>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {s.items.map(i => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>▸</span> {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg, rgba(0,210,106,0.06), rgba(64,196,255,0.04))' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h2>Ready to shop smarter?</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '16px auto 36px', maxWidth: '420px' }}>Join thousands of buyers and local sellers already using Smarter BlinkIt.</p>
            <Link href="/register" className="btn btn-primary btn-lg">Create Free Account →</Link>
          </div>
        </section>

        <footer style={{ padding: '32px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <div className="container">
            <p>⚡ SmarterBlinkit — AI Grocery Marketplace · Built with Next.js, Express, Gemini AI, Neo4j</p>
          </div>
        </footer>
      </main>
    </>
  );
}
