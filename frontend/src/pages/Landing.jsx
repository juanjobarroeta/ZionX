import React from "react";
import { Link } from "react-router-dom";
import "./Landing.css";

// Decorative pixel-cross mark used throughout the design
const PixelMark = ({ size = 14, fill = "#F2F3F1", style }) => (
  <svg width={size} height={size} viewBox="0 0 3 3" aria-hidden="true" style={style}>
    <rect x="0" y="0" width="1" height="1" fill={fill} />
    <rect x="2" y="0" width="1" height="1" fill={fill} />
    <rect x="1" y="1" width="1" height="1" fill={fill} />
    <rect x="0" y="2" width="1" height="1" fill={fill} />
    <rect x="2" y="2" width="1" height="1" fill={fill} />
  </svg>
);

const CONTACT_EMAIL = "hola@zionx.mx";

const SERVICES = [
  { img: "planet", title: "Strategy", body: "Positioning, brand voice and go-to-market plans grounded in research — not guesswork." },
  { img: "camera", title: "Content & production", body: "Photo, video and design produced in-house, built for the channels where your audience lives." },
  { img: "shuttle", title: "Campaign launches", body: "Paid and organic campaigns launched with a countdown: clear goals, budgets and timelines." },
  { img: "coffee", title: "Always-on social", body: "Calendars, community and daily publishing — the steady drip that keeps brands present." },
];

const MARQUEE_ITEMS = ["Strategy", "Content", "Production", "Campaigns", "Reporting"];

const PLATFORM_FEATURES = [
  { n: "01", label: "Creative briefs", body: " — every project starts with a shared, approved plan." },
  { n: "02", label: "Content planning", body: " — calendars and approvals in one view, no spreadsheet chaos." },
  { n: "03", label: "Live reporting", body: " — budgets and results, visible to your whole crew." },
];

const MarqueeGroup = () => (
  <div className="zx-marquee-group">
    {MARQUEE_ITEMS.map((item, i) => (
      <React.Fragment key={i}>
        <span>{item}</span>
        <span>✕</span>
      </React.Fragment>
    ))}
  </div>
);

const Landing = () => {
  return (
    <div className="zx-landing" id="top">
      {/* ============ NAV ============ */}
      <header className="zx-nav">
        <a href="#top" style={{ display: "flex", alignItems: "center" }}>
          <img src="/landing/logo-wordmark-white.png" alt="ZIONX" style={{ height: 22, display: "block" }} />
        </a>
        <nav className="zx-nav-links zx-nav-desktop">
          <a href="#services">Services</a>
          <a href="#platform">Platform</a>
          <a href="#contact">Contact</a>
          <Link to="/auth">Log in</Link>
          <a className="zx-btn-solid" href={`mailto:${CONTACT_EMAIL}`}>Start a project</a>
        </nav>
        {/* Mobile: keep a single always-visible entry point */}
        <Link className="zx-btn-solid zx-nav-mobile" to="/auth">Log in</Link>
      </header>

      {/* ============ HERO ============ */}
      <section className="zx-hero">
        <div style={{ display: "flex", flexDirection: "column", gap: 26, position: "relative", zIndex: 2 }}>
          <div className="zx-eyebrow">
            <PixelMark size={14} />
            <span>Creative &amp; marketing studio</span>
          </div>
          <h1 className="zx-h1">
            We take brands <span className="zx-serif">into orbit.</span>
          </h1>
          <p className="zx-lead">
            Strategy, content and campaigns — planned, produced and reported from one mission control.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <a className="zx-btn-solid" style={{ padding: "16px 32px", fontSize: 16 }} href={`mailto:${CONTACT_EMAIL}`}>Start a project</a>
            <a className="zx-link-underline" href="#services">See what we do</a>
          </div>
        </div>
        <div className="zx-hero-art">
          <img className="zx-planet" src="/landing/planet.png" alt="" />
          <img className="zx-astronaut" src="/landing/astronaut.png" alt="Floating astronaut" />
          <PixelMark size={18} style={{ position: "absolute", top: "12%", left: "8%", opacity: 0.35 }} />
          <PixelMark size={10} style={{ position: "absolute", bottom: "18%", left: "20%", opacity: 0.25 }} />
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="zx-marquee">
        <div className="zx-marquee-track">
          <MarqueeGroup />
          <MarqueeGroup />
        </div>
      </div>

      {/* ============ SERVICES ============ */}
      <section id="services" className="zx-section-light">
        <div className="zx-container">
          <div className="zx-section-head">
            <h2 className="zx-h2">What we <span className="zx-serif">do</span></h2>
            <p style={{ margin: 0, fontSize: 16, opacity: 0.6, maxWidth: "38ch" }}>
              Four disciplines, one crew. Everything a brand needs to leave the ground.
            </p>
          </div>
          <div className="zx-grid">
            {SERVICES.map((s) => (
              <div className="zx-card" key={s.title}>
                <img src={`/landing/${s.img}.png`} alt={s.title} />
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PLATFORM ============ */}
      <section id="platform" className="zx-section-dark">
        <div className="zx-platform-grid">
          <div className="zx-platform-art">
            <img className="zx-mac" src="/landing/mac.png" alt="Retro Macintosh computer" />
            <img className="zx-ufo" src="/landing/ufo.png" alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div className="zx-eyebrow">
              <PixelMark size={14} />
              <span>Mission control</span>
            </div>
            <h2 className="zx-h2">One platform runs <span className="zx-serif">every mission.</span></h2>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.65, opacity: 0.72, maxWidth: "52ch" }}>
              Briefs, content calendars, budgets and reporting live in the ZIONX platform — so you always know
              what's flying, when, and how it performed.
            </p>
            <div style={{ marginTop: 8 }}>
              {PLATFORM_FEATURES.map((f) => (
                <div className="zx-feature" key={f.n}>
                  <span className="num">{f.n}</span>
                  <div>
                    <strong style={{ fontWeight: 600, fontSize: 17 }}>{f.label}</strong>
                    <span style={{ opacity: 0.6, fontSize: 15.5 }}>{f.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section id="contact" className="zx-cta">
        <div className="zx-cta-inner">
          <h2>
            <span>hey</span>
            <img className="zx-cta-astro" src="/landing/astronaut.png" alt="Astronaut" />
            <span>there<span className="zx-serif">!</span></span>
          </h2>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.6, opacity: 0.65, maxWidth: "44ch" }}>
            Tell us about your next launch. We'll bring the countdown.
          </p>
          <a className="zx-btn-ink" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="zx-footer">
        <img src="/landing/logo-zx-white.png" alt="ZX" style={{ height: 88, margin: -18 }} />
        <nav>
          <a href="#services">Services</a>
          <a href="#platform">Platform</a>
          <a href="#contact">Contact</a>
          <Link to="/auth" style={{ color: "#F2F3F1", opacity: 0.6, textDecoration: "none" }}>Log in</Link>
        </nav>
        <span style={{ fontSize: 13, opacity: 0.4 }}>© 2026 ZIONX. All systems nominal.</span>
      </footer>
    </div>
  );
};

export default Landing;
