'use client';
import Link from 'next/link';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import NeuralCanvas from '@/components/NeuralCanvas';
import TiltCard from '@/components/TiltCard';
import { staggerContainer, fadeUp, heroTextVariant, scaleIn } from '@/lib/animations';

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
  const mousePosX = useMotionValue(0.5);
  const mousePosY = useMotionValue(0.5);

  const blobX = useTransform(mousePosX, [0, 1], ['-30px', '30px']);
  const blobY = useTransform(mousePosY, [0, 1], ['-20px', '20px']);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosX.set(e.clientX / window.innerWidth);
      mousePosY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mousePosX, mousePosY]);

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '64px' }}>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section style={{ minHeight: '94vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
          {/* Neural particle field — deepest layer */}
          <NeuralCanvas opacity={0.22} count={50} connectionDistance={130} zIndex={0} position="absolute" />
          {/* Animated mesh gradient */}
          <div className="mesh-hero" />
          {/* Scan accent line */}
          <div className="scan-accent" style={{ top: '30%' }} />
          {/* Mouse-parallax blobs */}
          <motion.div style={{ x: blobX, y: blobY, position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div className="blob blob-green" style={{ width: 600, height: 600, top: '-15%', left: '20%', opacity: 0.18 }} />
            <div className="blob blob-blue" style={{ width: 400, height: 400, top: '40%', right: '5%', opacity: 0.12 }} />
            <div className="blob blob-purple" style={{ width: 300, height: 300, bottom: '10%', left: '5%', opacity: 0.10 }} />
          </motion.div>
          {/* Grid */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(rgba(0,210,106,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,106,0.025) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />

          <div style={{ position: 'relative', maxWidth: '840px', zIndex: 1 }}>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,210,106,0.08)', border: '1px solid rgba(0,210,106,0.25)', borderRadius: '999px', padding: '6px 18px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '28px' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
              🚀 AI-Powered Local Marketplace — Now Live
            </motion.div>

            {/* Headline */}
            <div style={{ overflow: 'hidden', marginBottom: '8px' }}>
              <motion.h1 custom={0} variants={heroTextVariant} initial="hidden" animate="visible" style={{ lineHeight: 1.1 }}>
                Shop smarter with
              </motion.h1>
            </div>
            <div style={{ overflow: 'hidden', marginBottom: '28px' }}>
              <motion.h1 custom={1} variants={heroTextVariant} initial="hidden" animate="visible" className="gradient-text" style={{ lineHeight: 1.1, fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}>
                AI that understands you
              </motion.h1>
            </div>

            {/* Subtitle */}
            <motion.p custom={2} variants={heroTextVariant} initial="hidden" animate="visible"
              style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto 44px', lineHeight: 1.7 }}>
              Don&apos;t search item by item. Tell us what you want to cook, your health needs, or your occasion — and we fill your cart from nearby shops automatically.
            </motion.p>

            {/* CTA */}
            <motion.div custom={3} variants={heroTextVariant} initial="hidden" animate="visible"
              style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link href="/register" className="btn btn-primary btn-lg btn-glow">Start Shopping →</Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link href="/register?role=seller" className="btn btn-secondary btn-lg">Sell on Platform</Link>
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div custom={4} variants={heroTextVariant} initial="hidden" animate="visible"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', marginTop: '52px' }}>
              {[['4', 'AI Models'], ['126+', 'Products'], ['3', 'Cities']].map(([val, lab]) => (
                <div key={lab} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{val}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{lab}</div>
                </div>
              ))}
            </motion.div>

            {/* Recommendation chips */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.8, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}
            >
              {[
                '🍕 Pizza ingredients nearby',
                '🥗 Healthy breakfast kit',
                '🛒 Groceries under ₹200',
              ].map((chip, i) => (
                <motion.a
                  key={chip}
                  href="/shop"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 3.0 + i * 0.13, ease: [0.34, 1.56, 0.64, 1] }}
                  className="rec-chip"
                >
                  {chip}
                </motion.a>
              ))}
            </motion.div>
          </div>

          {/* Floating ambient cards */}
          {[
            { emoji: '🍕', label: 'Pizza for 4', sub: 'AI added 6 items', top: '22%', right: '3%', delay: 0 },
            { emoji: '⚡', label: '18 min delivery', sub: 'Optimised route', top: '58%', right: '3%', delay: 1.4 },
            { emoji: '🧠', label: 'Intent matched', sub: 'Gemini · 3 ingredients', top: '40%', left: '1%', delay: 0.8 },
          ].map((card, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: card.left ? -40 : 40 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + i * 0.3, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="hero-float-card"
              style={{
                top: card.top,
                right: card.right,
                left: card.left,
                animation: `float ${6 + i * 2}s ease-in-out infinite`,
                animationDelay: `${card.delay * -1}s`,
              }}
            >
              <div className="hfc-emoji">{card.emoji}</div>
              <div>
                <div className="hfc-label">{card.label}</div>
                <div className="hfc-sub">{card.sub}</div>
              </div>
            </motion.div>
          ))}
        </section>

        {/* ── FEATURES ─────────────────────────────────────────── */}
        <section style={{ padding: '96px 24px', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }} className="ambient-section ambient-green">
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
              style={{ textAlign: 'center', marginBottom: '56px' }}>
              <div style={{ display: 'inline-block', background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)', borderRadius: '999px', padding: '4px 14px', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                Platform Features
              </div>
              <h2>Everything you need, <span className="text-accent">AI-powered</span></h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '14px', maxWidth: '480px', margin: '14px auto 0' }}>
                From intent-aware search to graph-based suggestions — every feature has intelligence built in.
              </p>
            </motion.div>

            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {features.map(f => (
                <motion.div key={f.title} variants={fadeUp}>
                  <TiltCard className="card feature-card depth-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}
                    intensity={6}>
                    <div className="feature-icon">{f.icon}</div>
                    <h3 style={{ fontSize: '1.05rem' }}>{f.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.65 }}>{f.desc}</p>
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── STAGES ───────────────────────────────────────────── */}
        <section style={{ padding: '96px 24px', position: 'relative', overflow: 'hidden' }} className="ambient-section ambient-blue">
          <div className="container">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              style={{ textAlign: 'center', marginBottom: '56px' }}>
              <h2>The 4-Stage Approach</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Built in progressive stages, each one smarter than the last.</p>
            </motion.div>
            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {stages.map(s => (
                <motion.div key={s.num} variants={fadeUp} whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, position: 'absolute', top: -4, right: 16, userSelect: 'none' as const }}>{s.num}</div>
                  <span className="badge badge-green" style={{ marginBottom: '12px' }}>Stage {s.num}</span>
                  <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{s.label}</h3>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {s.items.map(item => (
                      <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--accent)', fontSize: '0.7rem', flexShrink: 0 }}>▸</span> {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section style={{ padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(0,210,106,0.07), rgba(64,196,255,0.04))' }} />
          <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="container" style={{ textAlign: 'center', position: 'relative' }}>
            <div style={{ width: 72, height: 72, borderRadius: '22px', background: 'linear-gradient(135deg, var(--accent), var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(0,210,106,0.4)' }}>⚡</div>
            <h2>Ready to shop smarter?</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '16px auto 36px', maxWidth: '420px' }}>
              Join thousands of buyers and local sellers already using Smarter BlinkIt.
            </p>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/register" className="btn btn-primary btn-lg">Create Free Account →</Link>
            </motion.div>
          </motion.div>
        </section>

        <footer style={{ padding: '32px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '200px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,210,106,0.4), transparent)' }} />
          <div className="container">
            <p>⚡ SmarterBlinkit — AI Grocery Marketplace · Next.js · Express · Gemini AI · Neo4j</p>
          </div>
        </footer>
      </main>
    </>
  );
}
