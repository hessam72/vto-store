'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Vazirmatn } from 'next/font/google';
import styles from './page.module.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const CATEGORIES = ['گردنبند', 'گوشواره', 'انگشتر', 'ساعت'];

// ---- tweakables ----
const STORE_URL = '/store';
const SHOW_PARTICLES = true;
const PARTICLE_DENSITY = 64;
const GOLD = '#d4af37';

type Particle = {
  x: number;
  y: number;
  r: number;
  s: number;
  o: number;
  tw: number;
  ts: number;
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !SHOW_PARTICLES) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let parts: Particle[] = [];
    let raf = 0;

    const seed = () => {
      parts = Array.from({ length: PARTICLE_DENSITY }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        s: Math.random() * 0.25 + 0.04,
        o: Math.random() * 0.5 + 0.08,
        tw: Math.random() * Math.PI * 2,
        ts: Math.random() * 0.03 + 0.008,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!parts.length) seed();
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.s;
        p.tw += p.ts;
        if (p.y < -6) {
          p.y = h + 6;
          p.x = Math.random() * w;
        }
        const o = p.o * (0.55 + 0.45 * Math.sin(p.tw));
        ctx.globalAlpha = o;
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div dir="rtl" className={`${vazirmatn.className} ${styles.root}`}>
      {/* ambient gold glow */}
      <div className={styles.glow} />

      {/* particles */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* vignette */}
      <div className={styles.vignette} />

      {/* header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.mark} />
          <span className={styles.brand}>ویترین مجازی شهر امید</span>
        </div>
        <span className={styles.headerNote}>نمایشگاه سه‌بعدی جواهرات</span>
      </header>

      {/* hero */}
      <main className={styles.main}>
        <div className={styles.kicker}>به ویترین مجازی شهر امید خوش آمدید</div>

        <h1 className={styles.title}>
          زیبایی را پیش از خرید
          <br />
          تجربه کنید
        </h1>

        <p className={styles.subtitle}>
          نمایشگاه سه‌بعدی و امتحان مجازی جواهرات؛ هر قطعه را پیش از خرید، روی خود ببینید.
        </p>

        <Link href={STORE_URL} className={styles.cta}>
          <span>ورود به فروشگاه</span>
          <span className={styles.ctaArrow}>&#8592;</span>
        </Link>

        <div className={styles.cats}>
          {CATEGORIES.map((cat, i) => (
            <span key={cat} className={styles.catItem}>
              {i > 0 && <span className={styles.dot} />}
              <span className={styles.cat}>{cat}</span>
            </span>
          ))}
        </div>
      </main>

      {/* footer */}
      <footer className={styles.footer}>
        <div className={styles.rule} />
        <div className={styles.footerRow}>
          <span>© ۱۴۰۵ ویترین مجازی شهر امید — تمامی حقوق محفوظ است</span>
          <span className={styles.footerNote}>طراحی‌شده برای تجربه‌ای نوین از خرید جواهرات</span>
        </div>
      </footer>
    </div>
  );
}
