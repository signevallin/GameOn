'use client';
import { useEffect } from 'react';
import ChatWidget from '@/components/ChatWidget';

/* ─────────────────────────────────────────────────────────────────
   Landing page markup — injected via dangerouslySetInnerHTML so we
   keep pure HTML/CSS without any JSX conversion.  All interactive
   JS (scroll reveal, counters, tilt, FAQ …) lives in the useEffect
   below and is cleaned up when the component unmounts.
───────────────────────────────────────────────────────────────── */
const MARKUP = `
<style>
/* ── Reset */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
img{display:block;max-width:100%;}
button{font-family:'Sora',sans-serif;cursor:pointer;}
::-webkit-scrollbar{width:6px;}
::-webkit-scrollbar-track{background:#0A1018;}
::-webkit-scrollbar-thumb{background:#263D57;border-radius:3px;}

/* ── Variables */
:root{
  --cyan:#7CBDD4;
  --blue:#A8D4E6;
  --bg:#0D1520;
  --card:#162030;
  --border:rgba(124,189,212,0.15);
  --text-muted:#8FA8C0;
  --text-dim:#4A6580;
}

/* ── Keyframes */
@keyframes float-y{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes float-y-slow{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes glow-pulse{0%,100%{opacity:.35}50%{opacity:.95}}
@keyframes cta-glow{
  0%,100%{box-shadow:0 0 28px rgba(124,189,212,.35),0 4px 24px rgba(0,0,0,.3)}
  50%{box-shadow:0 0 56px rgba(124,189,212,.65),0 4px 24px rgba(0,0,0,.3)}
}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes word-in{
  from{opacity:0;transform:translateY(.9em);filter:blur(6px)}
  to{opacity:1;transform:translateY(0);filter:blur(0)}
}
@keyframes badge-in{
  from{opacity:0;transform:translateY(-8px) scale(.92)}
  to{opacity:1;transform:translateY(0) scale(1)}
}

/* ── Word reveal */
.word{display:inline-block;opacity:0;animation:word-in .6s cubic-bezier(.16,1,.3,1) forwards;}

/* ── Scroll reveal */
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:translateY(0);}

/* ── Float */
.float-a{animation:float-y 4.2s ease-in-out infinite;}
.float-b{animation:float-y 5.6s ease-in-out infinite .5s;}
.float-c{animation:float-y-slow 7s ease-in-out infinite 1.1s;}

/* ── Glow orbs */
.glow-orb{animation:glow-pulse 4s ease-in-out infinite;}
.glow-orb-2{animation:glow-pulse 5.5s ease-in-out infinite 1.2s;}

/* ── Reduced motion */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}
  .reveal{opacity:1!important;transform:none!important;}
  .word{opacity:1!important;}
}

/* ══ NAV */
#nav{position:fixed;top:0;left:0;right:0;z-index:100;transition:background .35s,border-color .35s;border-bottom:1px solid transparent;}
#nav.scrolled{background:rgba(10,16,24,.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-color:rgba(124,189,212,.1);}
.nav-inner{max-width:1200px;margin:0 auto;padding:0 40px;height:72px;display:flex;align-items:center;gap:32px;}
.nav-logo{display:flex;align-items:center;flex-shrink:0;text-decoration:none;}
.nav-wordmark{font-size:24px;font-weight:800;letter-spacing:-.04em;color:#DCE4EE;display:inline-flex;align-items:baseline;gap:0;line-height:1;}
.nav-wordmark .wm-on{color:var(--cyan);}
.nav-wordmark svg{flex-shrink:0;display:inline-block;vertical-align:baseline;}
.nav-links{display:flex;gap:2px;margin-left:auto;}
.nav-link{color:var(--text-muted);text-decoration:none;font-size:14px;font-weight:600;padding:8px 14px;border-radius:8px;transition:color .15s,background .15s;}
.nav-link:hover{color:#DCE4EE;background:rgba(124,189,212,.07);}
.btn-primary{background:var(--cyan);color:#0D1520;border:none;padding:10px 22px;border-radius:999px;font-weight:800;font-size:14px;animation:cta-glow 2.8s ease-in-out infinite;transition:transform .15s,filter .15s;flex-shrink:0;text-decoration:none;display:inline-block;}
.btn-primary:hover{transform:translateY(-2px) scale(1.025);filter:brightness(1.1);animation-play-state:paused;}
.btn-ghost{background:transparent;color:#DCE4EE;border:1px solid rgba(124,189,212,.25);padding:17px 32px;border-radius:999px;font-weight:700;font-size:17px;transition:background .2s,border-color .2s,transform .15s;text-decoration:none;display:inline-block;}
.btn-ghost:hover{background:rgba(124,189,212,.08);border-color:rgba(124,189,212,.5);transform:translateY(-1px);}

/* ══ HERO */
#hero{position:relative;overflow:hidden;text-align:center;padding-top:72px;}
.hero-glow-1{position:absolute;top:-320px;left:50%;transform:translateX(-50%);width:960px;height:960px;border-radius:50%;background:radial-gradient(circle,rgba(124,189,212,.13) 0%,transparent 65%);pointer-events:none;}
.hero-glow-2{position:absolute;top:180px;right:-80px;width:440px;height:440px;border-radius:50%;background:radial-gradient(circle,rgba(168,212,230,.07) 0%,transparent 70%);pointer-events:none;}
.hero-glow-3{position:absolute;bottom:40px;left:-100px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(124,189,212,.08) 0%,transparent 70%);pointer-events:none;}
.hero-inner{max-width:1100px;margin:0 auto;padding:100px 40px 90px;position:relative;}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:999px;border:1px solid rgba(124,189,212,.3);background:rgba(124,189,212,.05);font-size:13px;font-weight:700;color:#C8E8F2;letter-spacing:.04em;animation:badge-in .5s cubic-bezier(.16,1,.3,1) .1s both;margin-bottom:32px;}
.hero-badge svg{flex-shrink:0;}
.hero-h1{font-size:clamp(46px,8.5vw,90px);font-weight:800;line-height:1.0;letter-spacing:-.04em;margin:0 0 30px;}
.hero-h1-line2{background:linear-gradient(135deg,var(--cyan) 0%,var(--blue) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.hero-sub{font-size:clamp(16px,2.2vw,20px);line-height:1.65;color:var(--text-muted);margin:0 auto 44px;max-width:580px;}
.hero-cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;align-items:center;}
.btn-primary-lg{background:var(--cyan);color:#0D1520;border:none;padding:17px 38px;border-radius:999px;font-weight:800;font-size:17px;animation:cta-glow 2.8s ease-in-out infinite;transition:transform .15s,filter .15s;text-decoration:none;display:inline-block;}
.btn-primary-lg:hover{transform:translateY(-2px) scale(1.025);filter:brightness(1.1);animation-play-state:paused;}
.hero-note{margin-top:18px;font-size:13px;color:var(--text-dim);}
.hero-mockups{margin-top:80px;position:relative;display:flex;justify-content:center;align-items:flex-end;gap:20px;}
.hero-mockup-glow{position:absolute;bottom:-60px;left:50%;transform:translateX(-50%);width:700px;height:200px;border-radius:50%;background:radial-gradient(ellipse,var(--cyan) 0%,transparent 70%);opacity:.08;pointer-events:none;}

/* ── App design tokens */
:root{
  --app-bg:#0a0e19;--app-surface:#111726;--app-card:#192033;--app-border:#283550;
  --app-accent:#75abc8;--app-gold:#debb6b;--app-green:#8cbf9b;--app-muted:#6e82a5;--app-text:#e0e7f3;
}
/* Phone */
.phone{width:210px;height:430px;border-radius:28px;flex-shrink:0;background:var(--app-bg);border:2px solid var(--app-border);box-shadow:0 40px 80px rgba(0,0,0,.7),0 0 0 1px rgba(117,171,200,.08),inset 0 1px 0 rgba(255,255,255,.04);position:relative;overflow:hidden;z-index:2;transform:translateY(18px);}
.phone-notch{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:65px;height:17px;border-radius:999px;background:#050810;z-index:10;}
.phone-nav{position:absolute;top:0;left:0;right:0;background:rgba(10,14,26,.9);border-bottom:1px solid var(--app-border);padding:28px 10px 8px;display:flex;align-items:center;justify-content:space-between;z-index:5;}
.phone-nav-logo{font-size:8px;font-weight:800;color:var(--app-accent);letter-spacing:1.5px;}
.phone-nav-score{font-size:9px;font-weight:800;color:var(--app-gold);}
.phone-screen{position:absolute;top:58px;left:0;right:0;bottom:0;padding:10px 10px 14px;display:flex;flex-direction:column;gap:5px;overflow:hidden;}
.phone-section-title{font-size:8.5px;font-weight:800;color:var(--app-accent);letter-spacing:.18em;text-transform:uppercase;margin-bottom:3px;}
.phone-lb-row{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:7px;}
.phone-lb-row-first{background:rgba(222,187,107,.06);border:1.5px solid var(--app-gold);}
.phone-lb-row-me{background:var(--app-card);border:1px solid var(--app-accent);}
.phone-lb-row-default{background:var(--app-card);border:1px solid var(--app-border);}
.phone-lb-rank{width:18px;text-align:center;font-size:10px;font-weight:800;flex-shrink:0;}
.phone-lb-info{flex:1;min-width:0;}
.phone-lb-name{font-size:8px;font-weight:700;color:var(--app-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.phone-lb-sub{font-size:6.5px;color:var(--app-muted);margin-top:1px;}
.phone-lb-bar{height:2px;background:var(--app-border);border-radius:2px;overflow:hidden;margin-top:3px;}
.phone-lb-bar-fill{height:100%;border-radius:2px;}
.phone-lb-score{font-size:10px;font-weight:800;flex-shrink:0;}
.phone-glow{position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);width:130px;height:80px;border-radius:50%;background:radial-gradient(circle,var(--app-accent) 0%,transparent 70%);opacity:.08;pointer-events:none;}
/* Dashboard */
.dashboard{background:var(--app-bg);border:1px solid var(--app-border);border-radius:12px;box-shadow:0 40px 80px rgba(0,0,0,.6);overflow:hidden;width:100%;max-width:500px;z-index:1;}
.db-nav{background:rgba(10,14,26,.9);border-bottom:1px solid var(--app-border);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;position:relative;}
.db-nav-logo{display:flex;align-items:center;gap:1px;}
.db-nav-logo-text{font-size:12px;font-weight:800;letter-spacing:-.5px;color:var(--app-text);}
.db-nav-logo-on{color:var(--app-accent);}
.db-nav-center{position:absolute;left:50%;transform:translateX(-50%);text-align:center;}
.db-nav-game-name{font-size:10px;font-weight:700;color:var(--app-text);letter-spacing:.5px;white-space:nowrap;}
.db-nav-timer{font-size:14px;font-weight:800;color:var(--app-green);letter-spacing:1.5px;line-height:1;}
.db-nav-btn{font-size:9px;font-weight:700;letter-spacing:.8px;padding:5px 10px;border-radius:5px;border:1px solid var(--app-border);background:transparent;color:var(--app-muted);cursor:pointer;}
.db-body{padding:16px 18px;}
.db-key-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.db-key-label{font-size:9px;font-weight:700;color:var(--app-muted);letter-spacing:.1em;text-transform:uppercase;}
.db-key-value{font-size:20px;font-weight:800;color:var(--app-accent);letter-spacing:3px;}
.db-status-badge{font-size:9px;font-weight:800;letter-spacing:.05em;padding:3px 8px;border-radius:4px;background:rgba(140,191,155,.12);border:1px solid rgba(140,191,155,.3);color:var(--app-green);}
.db-lb-row{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;margin-bottom:5px;}
.db-lb-row-first{background:rgba(222,187,107,.04);border:1px solid rgba(222,187,107,.2);}
.db-lb-row-default{background:var(--app-card);border:1px solid var(--app-border);}
.db-lb-rank{width:22px;font-size:12px;font-weight:800;text-align:center;flex-shrink:0;}
.db-lb-info{flex:1;min-width:0;}
.db-lb-name{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.db-lb-bar{height:2px;background:var(--app-border);border-radius:2px;overflow:hidden;margin-top:4px;}
.db-lb-bar-fill{height:100%;border-radius:2px;}
.db-lb-score{font-size:14px;font-weight:800;flex-shrink:0;}
.db-lb-meta{font-size:10px;color:var(--app-muted);flex-shrink:0;}
.db-footer{display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--app-border);}
.db-footer-btn{flex:1;padding:8px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.5px;border:none;cursor:pointer;text-align:center;}
.db-footer-btn-primary{background:var(--app-accent);color:var(--app-bg);}
.db-footer-btn-ghost{background:transparent;border:1px solid var(--app-border);color:var(--app-muted);}

/* ══ MARQUEE */
#marquee-section{padding:44px 0;border-top:1px solid rgba(124,189,212,.07);border-bottom:1px solid rgba(124,189,212,.07);}
.marquee-label{text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);letter-spacing:.18em;text-transform:uppercase;margin-bottom:26px;}
.marquee-wrap{overflow:hidden;mask-image:linear-gradient(90deg,transparent 0%,black 14%,black 86%,transparent 100%);-webkit-mask-image:linear-gradient(90deg,transparent 0%,black 14%,black 86%,transparent 100%);}
.marquee-track{display:flex;width:max-content;animation:marquee 32s linear infinite;}
.marquee-track:hover{animation-play-state:paused;}
.marquee-item{padding:0 44px;font-size:15px;font-weight:800;color:rgba(143,168,192,.38);letter-spacing:-.01em;white-space:nowrap;}

/* ══ STATS */
#stats{max-width:1100px;margin:0 auto;padding:88px 40px;}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.stat-item{text-align:center;}
.stat-number{font-size:clamp(36px,4vw,52px);font-weight:800;letter-spacing:-.04em;background:linear-gradient(135deg,var(--cyan),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.stat-label{font-size:12px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;margin-top:10px;}

/* ══ SECTIONS */
.section-inner{max-width:1100px;margin:0 auto;padding:90px 40px;}
.section-eyebrow{font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--cyan);margin-bottom:16px;}
.section-h2{font-size:clamp(34px,5vw,54px);font-weight:800;letter-spacing:-.035em;margin:0 0 14px;}
.section-sub{font-size:18px;color:var(--text-muted);margin:0;}

/* ══ FEATURES */
#features{position:relative;overflow:hidden;}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:56px;}
.feature-card{padding:32px;border-radius:20px;background:linear-gradient(160deg,rgba(22,36,56,.65),rgba(13,21,32,.45));border:1px solid rgba(124,189,212,.1);transform-style:preserve-3d;will-change:transform;transition:box-shadow .3s,border-color .25s,transform .2s;cursor:default;}
.feature-card:hover{box-shadow:0 24px 64px rgba(0,0,0,.55),0 0 50px rgba(124,189,212,.09);border-color:rgba(124,189,212,.35);}
.feature-icon{width:48px;height:48px;border-radius:14px;background:rgba(124,189,212,.08);border:1px solid rgba(124,189,212,.15);display:flex;align-items:center;justify-content:center;margin-bottom:20px;}
.feature-icon svg{stroke:var(--cyan);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.feature-title{font-size:18px;font-weight:800;color:#DCE4EE;margin-bottom:10px;}
.feature-desc{font-size:14px;line-height:1.65;color:var(--text-muted);}

/* ══ HOW IT WORKS */
#how{background:linear-gradient(180deg,transparent,rgba(124,189,212,.025),transparent);}
.steps-grid{display:flex;flex-direction:column;gap:0;margin-top:56px;}
.step-row{display:flex;align-items:flex-start;gap:28px;padding:32px 0;border-bottom:1px solid rgba(124,189,212,.07);}
.step-row:last-child{border-bottom:none;}
.step-num{width:52px;height:52px;border-radius:16px;flex-shrink:0;background:rgba(124,189,212,.07);border:1px solid rgba(124,189,212,.18);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600;color:var(--cyan);transition:box-shadow .25s,border-color .25s;}
.step-row:hover .step-num{border-color:rgba(124,189,212,.7);box-shadow:0 0 28px rgba(124,189,212,.22);}
.step-content{padding-top:4px;}
.step-title{font-size:20px;font-weight:800;color:#DCE4EE;margin-bottom:8px;}
.step-desc{font-size:15px;line-height:1.65;color:var(--text-muted);max-width:560px;}

/* ══ USE CASES */
#usecases{max-width:1100px;margin:0 auto;padding:90px 40px;}
.pills-wrap{display:flex;flex-wrap:wrap;gap:12px;margin-top:40px;}
.pill{display:inline-block;padding:11px 22px;border-radius:999px;background:rgba(124,189,212,.05);border:1px solid rgba(124,189,212,.18);font-size:14px;font-weight:700;color:#DCE4EE;transition:background .2s,border-color .2s,transform .15s;cursor:default;}
.pill:hover{background:rgba(124,189,212,.1);border-color:rgba(124,189,212,.4);transform:translateY(-2px);}

/* ══ TESTIMONIALS */
#testimonials{position:relative;overflow:hidden;}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:56px;}
.testimonial-card{padding:32px;border-radius:20px;background:linear-gradient(160deg,rgba(22,36,56,.65),rgba(13,21,32,.45));border:1px solid rgba(124,189,212,.1);transform-style:preserve-3d;will-change:transform;transition:box-shadow .3s,border-color .25s,transform .2s;}
.testimonial-card:hover{box-shadow:0 24px 64px rgba(0,0,0,.55),0 0 50px rgba(124,189,212,.09);border-color:rgba(124,189,212,.35);}
.testimonial-stars{display:flex;gap:3px;margin-bottom:20px;}
.star{color:#f5c518;font-size:14px;}
.testimonial-quote{font-size:15px;line-height:1.7;color:#DCE4EE;margin-bottom:24px;font-style:italic;}
.testimonial-name{font-size:14px;font-weight:800;color:#DCE4EE;}
.testimonial-role{font-size:12px;color:var(--text-dim);margin-top:2px;}

/* ══ PRICING */
#pricing-section{max-width:1100px;margin:0 auto;padding:90px 40px;text-align:center;}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch;text-align:left;margin-top:56px;}
.pricing-card{position:relative;height:100%;display:flex;flex-direction:column;border-radius:22px;padding:36px;overflow:hidden;transition:transform .22s,box-shadow .22s;}
.pricing-card:hover{transform:translateY(-5px);}
.pricing-card-default{background:linear-gradient(160deg,rgba(22,36,56,.6),rgba(13,21,32,.4));border:1px solid rgba(124,189,212,.12);}
.pricing-card-highlight{background:linear-gradient(160deg,rgba(124,189,212,.11),rgba(13,21,32,.5));border:1.5px solid var(--cyan);box-shadow:0 0 64px rgba(124,189,212,.17);}
.pricing-top-line{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);}
.pricing-popular{position:absolute;top:20px;right:20px;padding:4px 12px;border-radius:999px;background:rgba(124,189,212,.14);color:var(--cyan);font-size:11px;font-weight:800;letter-spacing:.06em;}
.pricing-name{font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:4px;}
.pricing-tag{font-size:12px;color:var(--text-dim);margin-bottom:24px;}
.pricing-price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:28px;}
.pricing-price{font-size:46px;font-weight:800;letter-spacing:-.03em;color:#DCE4EE;}
.pricing-unit{font-size:13px;color:var(--text-dim);font-weight:600;}
.pricing-features{display:flex;flex-direction:column;gap:13px;margin-bottom:30px;flex:1;}
.pricing-feature{display:flex;align-items:flex-start;gap:10px;font-size:15px;color:#DCE4EE;}
.pricing-feature svg{stroke:var(--cyan);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;margin-top:2px;}
.pricing-cta{width:100%;padding:15px;border-radius:999px;font-family:'Sora',sans-serif;font-weight:800;font-size:15px;transition:filter .18s,transform .15s,box-shadow .18s;text-decoration:none;display:block;text-align:center;}
.pricing-cta-default{background:transparent;border:1px solid rgba(124,189,212,.3);color:#DCE4EE;}
.pricing-cta-default:hover{filter:brightness(1.1);transform:translateY(-1px);}
.pricing-cta-highlight{background:var(--cyan);border:none;color:#0D1520;box-shadow:0 0 28px rgba(124,189,212,.38);}
.pricing-cta-highlight:hover{filter:brightness(1.1);transform:translateY(-1px);}
.launch-badge{display:inline-flex;align-items:center;gap:8px;padding:9px 20px;border-radius:999px;border:1px solid rgba(124,189,212,.3);background:rgba(124,189,212,.06);font-size:13px;font-weight:700;color:#C8E8F2;letter-spacing:.03em;margin-bottom:40px;}
.launch-badge-dot{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px rgba(124,189,212,.8);flex-shrink:0;}
.pricing-lock{font-size:11px;color:var(--text-dim);text-align:center;margin-top:12px;font-weight:600;letter-spacing:.02em;}
.billing-switch{display:inline-flex;gap:4px;padding:5px;border-radius:999px;border:1px solid rgba(124,189,212,.2);background:rgba(13,21,32,.5);margin-bottom:8px;}
.billing-opt{padding:9px 20px;border-radius:999px;border:none;background:transparent;color:var(--text-muted);font-family:'Sora',sans-serif;font-weight:700;font-size:14px;cursor:pointer;transition:background .18s,color .18s;display:inline-flex;align-items:center;gap:8px;}
.billing-opt.active{background:var(--cyan);color:#0D1520;}
.billing-save{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:rgba(124,189,212,.16);color:var(--cyan);letter-spacing:.02em;}
.billing-opt.active .billing-save{background:rgba(13,21,32,.18);color:#0D1520;}

/* ══ FAQ */
#faq-section{max-width:780px;margin:0 auto;padding:80px 40px;}
.faq-item{border-bottom:1px solid rgba(124,189,212,.1);padding:22px 0;}
.faq-btn{width:100%;background:none;border:none;display:flex;align-items:center;justify-content:space-between;gap:20px;text-align:left;padding:0;cursor:pointer;}
.faq-q{font-size:17px;font-weight:700;color:#DCE4EE;line-height:1.45;}
.faq-icon{color:var(--cyan);font-size:24px;line-height:1;flex-shrink:0;transition:transform .3s cubic-bezier(.16,1,.3,1);user-select:none;}
.faq-icon.open{transform:rotate(45deg);}
.faq-body{overflow:hidden;max-height:0;opacity:0;transition:max-height .4s cubic-bezier(.16,1,.3,1),opacity .3s ease;}
.faq-body.open{max-height:400px;opacity:1;}
.faq-a{font-size:15px;line-height:1.7;color:var(--text-muted);margin-top:14px;}

/* ══ FOOTER CTA */
#footer-cta{position:relative;overflow:hidden;}
.footer-cta-glow{position:absolute;bottom:-350px;left:50%;transform:translateX(-50%);width:960px;height:640px;border-radius:50%;background:radial-gradient(ellipse,rgba(124,189,212,.18) 0%,transparent 65%);pointer-events:none;}
.footer-cta-inner{max-width:1100px;margin:0 auto;padding:130px 40px;text-align:center;position:relative;}
.footer-cta-icon{width:76px;height:76px;border-radius:24px;margin:0 auto 30px;background:linear-gradient(135deg,var(--cyan),#4890aa);display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(124,189,212,.4);}
.footer-cta-icon svg{stroke:#0D1520;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.footer-cta-h2{font-size:clamp(36px,6vw,70px);font-weight:800;letter-spacing:-.04em;margin:0 0 20px;}
.footer-cta-sub{font-size:20px;color:var(--text-muted);margin:0 auto 48px;max-width:500px;}
.footer-cta-note{margin-top:22px;font-size:13px;color:var(--text-dim);}
.footer-cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;align-items:center;}

/* ══ FOOTER */
#footer{border-top:1px solid rgba(124,189,212,.08);padding:60px 40px;max-width:1200px;margin:0 auto;}
.footer-grid{display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap;}
.footer-logo{display:flex;align-items:center;}
.footer-wordmark{font-size:20px;font-weight:800;letter-spacing:-.04em;color:#DCE4EE;display:inline-flex;align-items:baseline;gap:0;line-height:1;}
.footer-wordmark .wm-on{color:var(--cyan);}
.footer-wordmark svg{flex-shrink:0;display:inline-block;vertical-align:baseline;}
.footer-copy{font-size:13px;color:var(--text-dim);}
.footer-links{display:flex;gap:24px;}
.footer-link{font-size:14px;font-weight:600;color:var(--text-muted);text-decoration:none;transition:color .15s;}
.footer-link:hover{color:#DCE4EE;}

/* ══ MOBILE */
@media(max-width:768px){
  /* Nav */
  .nav-inner{padding:0 20px;height:60px;gap:12px;}
  .nav-links{display:none;}
  .btn-primary{padding:8px 16px;font-size:13px;}

  /* Hero */
  .hero-inner{padding:70px 20px 60px;}
  .hero-sub{font-size:15px;}
  .hero-cta-row{flex-direction:column;align-items:stretch;gap:10px;}
  .btn-primary-lg{padding:15px 28px;font-size:15px;text-align:center;}
  .btn-ghost{padding:13px 28px;font-size:15px;text-align:center;}
  .hero-mockups{flex-direction:column;align-items:center;gap:0;margin-top:48px;}
  .dashboard{display:none;}
  .phone{transform:none;}
  .hero-mockup-glow{display:none;}

  /* Stats */
  #stats{padding:56px 20px;}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:32px 16px;}

  /* Sections */
  .section-inner{padding:64px 20px;}
  #usecases{padding:64px 20px;}
  #pricing-section{padding:64px 20px;}
  #faq-section{padding:56px 20px;}

  /* Features */
  .features-grid{grid-template-columns:1fr;gap:14px;margin-top:36px;}
  .feature-card{padding:24px;}

  /* Testimonials */
  .testimonials-grid{grid-template-columns:1fr;gap:14px;margin-top:36px;}
  .testimonial-card{padding:24px;}

  /* Pricing */
  .pricing-grid{grid-template-columns:1fr;gap:14px;margin-top:36px;}
  .pricing-card{padding:28px;}

  /* FAQ */
  .faq-q{font-size:15px;}

  /* Footer CTA */
  .footer-cta-inner{padding:80px 20px;}
  .footer-cta-row{flex-direction:column;align-items:stretch;gap:10px;}

  /* Footer */
  #footer{padding:40px 20px;}
  .footer-grid{flex-direction:column;align-items:flex-start;gap:20px;}
  .footer-links{flex-wrap:wrap;gap:16px;}
}
</style>

<!-- ══ NAV ══ -->
<nav id="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <span class="nav-wordmark">Game<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="var(--cyan)" stroke-width="2.6" stroke-linecap="round" style="margin-right:-2px"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg><span class="wm-on">n</span></span>
    </a>
    <nav class="nav-links">
      <a href="#features" class="nav-link">Features</a>
      <a href="#how" class="nav-link">How it works</a>
      <a href="#pricing-section" class="nav-link">Pricing</a>
      <a href="#faq-section" class="nav-link">FAQ</a>
    </nav>
    <a href="/play" class="btn-primary">Start for free</a>
  </div>
</nav>

<!-- ══ HERO ══ -->
<header id="hero">
  <div class="hero-glow-1 glow-orb" id="hero-glow-1"></div>
  <div class="hero-glow-2"></div>
  <div class="hero-glow-3 glow-orb-2"></div>
  <div class="hero-inner">
    <div style="display:flex;justify-content:center;margin-bottom:32px;">
      <div class="hero-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7CBDD4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg>
        Real-time team competition &middot; No app required
      </div>
    </div>
    <h1 class="hero-h1" id="hero-h1">
      <span id="hero-line1"></span><br>
      <span class="hero-h1-line2" id="hero-line2"></span>
    </h1>
    <div class="reveal" style="transition-delay:.55s">
      <p class="hero-sub">Real-time leaderboards, photo missions, power-ups and live drama &mdash;<br>all from your browser. Zero app downloads required.</p>
    </div>
    <div class="reveal" style="transition-delay:.7s">
      <div class="hero-cta-row">
        <a href="/play" class="btn-primary-lg">Start for free &rarr;</a>
        <a href="#how" class="btn-ghost">See how it works</a>
      </div>
      <p class="hero-note">No credit card required &middot; Live in under 10 minutes</p>
    </div>
    <div class="reveal" style="transition-delay:.9s">
      <div class="hero-mockups">
        <div class="hero-mockup-glow"></div>
        <div class="phone float-b">
          <div class="phone-notch"></div>
          <div class="phone-nav">
            <span class="phone-nav-logo">GAME<svg width="9" height="9" viewBox="0 0 24 22" fill="none" stroke="#75abc8" stroke-width="2.6" stroke-linecap="round" style="display:inline-block;vertical-align:baseline;margin:0 -1px"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg>N</span>
            <span class="phone-nav-score">1 490 p &middot; you</span>
          </div>
          <div class="phone-screen">
            <div class="phone-section-title">Leaderboard &middot; 14:32 left</div>
            <div class="phone-lb-row phone-lb-row-first">
              <span class="phone-lb-rank" style="font-size:13px">&#127942;</span>
              <div class="phone-lb-info"><div class="phone-lb-name" style="color:#debb6b">Team Alpha</div><div class="phone-lb-sub">8/12 missions</div><div class="phone-lb-bar"><div class="phone-lb-bar-fill" style="width:92%;background:#debb6b"></div></div></div>
              <span class="phone-lb-score" style="color:#debb6b">1 840</span>
            </div>
            <div class="phone-lb-row phone-lb-row-default">
              <span class="phone-lb-rank" style="font-size:13px">&#129352;</span>
              <div class="phone-lb-info"><div class="phone-lb-name">The Wolves</div><div class="phone-lb-sub">7/12 missions</div><div class="phone-lb-bar"><div class="phone-lb-bar-fill" style="width:81%;background:#a8b8c8"></div></div></div>
              <span class="phone-lb-score" style="color:#e0e7f3">1 620</span>
            </div>
            <div class="phone-lb-row phone-lb-row-me">
              <span class="phone-lb-rank" style="font-size:13px">&#129353;</span>
              <div class="phone-lb-info"><div class="phone-lb-name" style="color:#75abc8">Ctrl+Alt+Win &middot; you</div><div class="phone-lb-sub">6/12 missions</div><div class="phone-lb-bar"><div class="phone-lb-bar-fill" style="width:74%;background:#75abc8"></div></div></div>
              <span class="phone-lb-score" style="color:#75abc8">1 490</span>
            </div>
            <div class="phone-lb-row phone-lb-row-default">
              <span class="phone-lb-rank" style="color:#6e82a5">4</span>
              <div class="phone-lb-info"><div class="phone-lb-name" style="color:#6e82a5">No Idea</div><div class="phone-lb-sub">5/12 missions</div><div class="phone-lb-bar"><div class="phone-lb-bar-fill" style="width:61%;background:#283550"></div></div></div>
              <span class="phone-lb-score" style="color:#6e82a5">1 230</span>
            </div>
            <div class="phone-lb-row phone-lb-row-default">
              <span class="phone-lb-rank" style="color:#6e82a5">5</span>
              <div class="phone-lb-info"><div class="phone-lb-name" style="color:#6e82a5">Office Heroes</div><div class="phone-lb-sub">4/12 missions</div><div class="phone-lb-bar"><div class="phone-lb-bar-fill" style="width:49%;background:#283550"></div></div></div>
              <span class="phone-lb-score" style="color:#6e82a5">980</span>
            </div>
          </div>
          <div class="phone-glow"></div>
        </div>
        <div class="dashboard float-c">
          <div class="db-nav">
            <div class="db-nav-logo">
              <span class="db-nav-logo-text">Game</span>
              <svg width="13" height="12" viewBox="0 0 24 22" fill="none" stroke="#75abc8" stroke-width="2.6" stroke-linecap="round" style="display:inline-block;vertical-align:baseline;margin:0 -1px"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg>
              <span class="db-nav-logo-on">n</span>
            </div>
            <div class="db-nav-center">
              <div class="db-nav-game-name">Sommarkickoff 2026</div>
              <div class="db-nav-timer">&#9201; 14:32</div>
            </div>
            <button class="db-nav-btn">LOG OUT</button>
          </div>
          <div class="db-body">
            <div class="db-key-row">
              <div><div class="db-key-label">Game key</div><div class="db-key-value">KT4X2</div></div>
              <div class="db-status-badge">&#129001; Active</div>
            </div>
            <div class="db-lb-row db-lb-row-first"><span class="db-lb-rank">&#127942;</span><div class="db-lb-info"><div class="db-lb-name" style="color:#debb6b">Team Alpha</div><div class="db-lb-bar"><div class="db-lb-bar-fill" style="width:92%;background:#debb6b"></div></div></div><span class="db-lb-meta">8/12</span><span class="db-lb-score" style="color:#debb6b">1 840</span></div>
            <div class="db-lb-row db-lb-row-default"><span class="db-lb-rank" style="font-size:10px;color:#a8b8c8">&#129352;</span><div class="db-lb-info"><div class="db-lb-name" style="color:#e0e7f3">The Wolves</div><div class="db-lb-bar"><div class="db-lb-bar-fill" style="width:81%;background:#a8b8c8"></div></div></div><span class="db-lb-meta">7/12</span><span class="db-lb-score" style="color:#e0e7f3">1 620</span></div>
            <div class="db-lb-row db-lb-row-default"><span class="db-lb-rank" style="font-size:10px;color:#bf8450">&#129353;</span><div class="db-lb-info"><div class="db-lb-name" style="color:#e0e7f3">Ctrl+Alt+Win</div><div class="db-lb-bar"><div class="db-lb-bar-fill" style="width:74%;background:#75abc8"></div></div></div><span class="db-lb-meta">6/12</span><span class="db-lb-score" style="color:#e0e7f3">1 490</span></div>
            <div class="db-lb-row db-lb-row-default"><span class="db-lb-rank" style="color:#6e82a5;font-size:11px">4</span><div class="db-lb-info"><div class="db-lb-name" style="color:#6e82a5">No Idea</div><div class="db-lb-bar"><div class="db-lb-bar-fill" style="width:61%;background:#283550"></div></div></div><span class="db-lb-meta">5/12</span><span class="db-lb-score" style="color:#6e82a5">1 230</span></div>
            <div class="db-footer">
              <button class="db-footer-btn db-footer-btn-primary">STOP GAME</button>
              <button class="db-footer-btn db-footer-btn-ghost">QR CODE</button>
              <button class="db-footer-btn db-footer-btn-ghost">POWER-UPS</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

<!-- ══ MARQUEE ══ -->
<section id="marquee-section">
  <p class="marquee-label">Trusted by teams at</p>
  <div class="marquee-wrap"><div class="marquee-track" id="marquee-track"></div></div>
</section>

<!-- ══ STATS ══ -->
<section id="stats">
  <div class="stats-grid">
    <div class="stat-item reveal"><div class="stat-number"><span class="counter" data-to="10000" data-suffix="+">0+</span></div><div class="stat-label">Events played</div></div>
    <div class="stat-item reveal" style="transition-delay:.08s"><div class="stat-number"><span class="counter" data-to="200000" data-suffix="+">0+</span></div><div class="stat-label">Teams competed</div></div>
    <div class="stat-item reveal" style="transition-delay:.16s"><div class="stat-number"><span class="counter" data-prefix="4." data-to="9" data-suffix="/5&#9733;">4.0/5&#9733;</span></div><div class="stat-label">Average rating</div></div>
  </div>
</section>

<!-- ══ FEATURES ══ -->
<section id="features">
  <div style="position:absolute;top:-80px;left:-200px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(124,189,212,.07) 0%,transparent 70%);pointer-events:none;"></div>
  <div class="section-inner">
    <div class="reveal" style="text-align:center;">
      <div class="section-eyebrow">Features</div>
      <h2 class="section-h2">Everything you need to run epic games</h2>
      <p class="section-sub">From first join to final leaderboard &mdash; GameOn handles everything.</p>
    </div>
    <div class="features-grid">
      <div class="feature-card reveal tilt-card" style="transition-delay:.05s"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg></div><div class="feature-title">Live Leaderboard</div><div class="feature-desc">Standings update in real time for every team. The drama on that big screen is genuinely electric.</div></div>
      <div class="feature-card reveal tilt-card" style="transition-delay:.1s"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div><div class="feature-title">Photo Missions</div><div class="feature-desc">Teams submit photos you rate on the spot &mdash; or let AI score them automatically. Points awarded instantly, laughs guaranteed.</div></div>
      <div class="feature-card reveal tilt-card" style="transition-delay:.15s"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div class="feature-title">Power-Ups</div><div class="feature-desc">Freeze rivals. Double your score. Shield your lead. Hunt for AR mystery boxes hidden in the venue. No competitor has this &mdash; and your teams will never stop talking about it.</div></div>
      <div class="feature-card reveal tilt-card" style="transition-delay:.2s"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><div class="feature-title">Custom Missions</div><div class="feature-desc">Build missions for any brand, team, or theme in minutes. No limits on creativity.</div></div>
      <div class="feature-card reveal tilt-card" style="transition-delay:.25s"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><div class="feature-title">PDF Reports</div><div class="feature-desc">Auto-generated PDF with full standings, per-team scores, and the best photo from each team.</div></div>
      <div class="feature-card reveal tilt-card" style="transition-delay:.3s"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div><div class="feature-title">No App Needed</div><div class="feature-desc">Teams join from any phone browser with a 6-digit code. Zero downloads. Zero friction.</div></div>
    </div>
  </div>
</section>

<!-- ══ HOW IT WORKS ══ -->
<section id="how">
  <div class="section-inner">
    <div class="reveal" style="text-align:center;">
      <div class="section-eyebrow">How it works</div>
      <h2 class="section-h2">Up and running in minutes</h2>
      <p class="section-sub">No training, no manual, no support call needed.</p>
    </div>
    <div class="steps-grid">
      <div class="step-row reveal" style="transition-delay:.05s"><div class="step-num">01</div><div class="step-content"><div class="step-title">Create your game</div><div class="step-desc">Pick missions from the library or build your own, set the duration, and name your game. Takes about 2 minutes.</div></div></div>
      <div class="step-row reveal" style="transition-delay:.1s"><div class="step-num">02</div><div class="step-content"><div class="step-title">Share the code</div><div class="step-desc">Teams join from any smartphone by entering a 6-digit code or scanning a QR. No logins, no apps.</div></div></div>
      <div class="step-row reveal" style="transition-delay:.15s"><div class="step-num">03</div><div class="step-content"><div class="step-title">Play live</div><div class="step-desc">Watch real-time scoring, approve photo missions, and trigger power-ups from your admin dashboard.</div></div></div>
      <div class="step-row reveal" style="transition-delay:.2s"><div class="step-num">04</div><div class="step-content"><div class="step-title">End with a bang</div><div class="step-desc">Close the game and download a beautiful PDF report with full results, stats, and team photos.</div></div></div>
    </div>
  </div>
</section>

<!-- ══ USE CASES ══ -->
<section id="usecases">
  <div class="reveal" style="text-align:center;">
    <div class="section-eyebrow">Use cases</div>
    <h2 class="section-h2">Perfect for every occasion</h2>
    <p class="section-sub">One platform for any event where competition and fun belong together.</p>
  </div>
  <div class="pills-wrap reveal" style="justify-content:center;transition-delay:.1s">
    <span class="pill">Corporate Events</span><span class="pill">Team Building</span><span class="pill">Company Kickoffs</span>
    <span class="pill">Bachelor Parties</span><span class="pill">Birthday Parties</span><span class="pill">School Events</span>
    <span class="pill">Conferences</span><span class="pill">Sports Clubs</span><span class="pill">Office Games</span>
    <span class="pill">Holiday Parties</span><span class="pill">Onboarding Days</span><span class="pill">Hackathons</span>
    <span class="pill">Summer Kickoffs</span><span class="pill">Christmas Parties</span>
  </div>
</section>

<!-- ══ TESTIMONIALS ══ -->
<section id="testimonials">
  <div class="section-inner">
    <div class="reveal" style="text-align:center;">
      <div class="section-eyebrow">Testimonials</div>
      <h2 class="section-h2">The energy speaks for itself</h2>
      <p class="section-sub">From HR managers to conference organizers &mdash; everyone leaves happy.</p>
    </div>
    <div class="testimonials-grid">
      <div class="testimonial-card reveal tilt-card" style="transition-delay:.05s"><div class="testimonial-stars"><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span></div><p class="testimonial-quote">"Our annual company event has never been this electric. 12 teams, 45 minutes of pure chaos. Everyone&apos;s still talking about it weeks later."</p><div class="testimonial-name">Emma K.</div><div class="testimonial-role">HR Manager, Volvo Cars</div></div>
      <div class="testimonial-card reveal tilt-card" style="transition-delay:.1s"><div class="testimonial-stars"><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span></div><p class="testimonial-quote">"Setup took 2 minutes. The photo missions had everyone sprinting around the venue. Best team-building we&apos;ve ever organised."</p><div class="testimonial-name">Marcus L.</div><div class="testimonial-role">Event Coordinator, Spotify</div></div>
      <div class="testimonial-card reveal tilt-card" style="transition-delay:.15s"><div class="testimonial-stars"><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span><span class="star">&#9733;</span></div><p class="testimonial-quote">"We&apos;ve run GameOn at three conferences now. The live leaderboard on the big screen creates insane energy from the first minute."</p><div class="testimonial-name">Sofia A.</div><div class="testimonial-role">Conference Organizer, Summit Group</div></div>
    </div>
  </div>
</section>

<!-- ══ PRICING ══ -->
<section id="pricing-section">
  <div class="reveal">
    <div class="section-eyebrow">Pricing</div>
    <h2 class="section-h2">Pricing that fits how you run events.</h2>
    <p class="section-sub">Start free. Pay monthly for flexibility, or save two months with annual billing.</p>
  </div>
  <div class="reveal" style="text-align:center;">
    <div class="billing-switch">
      <button class="billing-opt active" data-interval="monthly" onclick="setBilling('monthly')">Monthly</button>
      <button class="billing-opt" data-interval="yearly" onclick="setBilling('yearly')">Annual <span class="billing-save">2 months free</span></button>
    </div>
  </div>
  <div class="pricing-grid">
    <div class="reveal" style="transition-delay:.0s"><div class="pricing-card pricing-card-default"><div class="pricing-name">Starter</div><div class="pricing-tag">Try it for free</div><div class="pricing-price-row"><span class="pricing-price">Free</span></div><div class="pricing-features"><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Up to 5 teams</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> 10 standard missions</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> 1 active game at a time</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Live leaderboard</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Basic stats</div></div><a href="/play" class="pricing-cta pricing-cta-default">Start for free</a></div></div>
    <div class="reveal" style="transition-delay:.09s"><div class="pricing-card pricing-card-highlight"><div class="pricing-top-line"></div><div class="pricing-popular">POPULAR</div><div class="pricing-name">Pro</div><div class="pricing-tag">Most popular</div><div class="pricing-price-row"><span class="pricing-price" data-price data-monthly="199" data-yearly="1 490">199</span><span class="pricing-unit" data-unit data-monthly="kr / month" data-yearly="kr / year">kr / month</span></div><div class="pricing-features"><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Unlimited teams</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> All mission types</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Power-ups included</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Custom mission builder</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> PDF reports</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Priority support</div></div><a href="/play?plan=pro&interval=monthly" class="pricing-cta pricing-cta-highlight" data-cta data-plan="pro">Get Pro</a><div class="pricing-lock">Cancel anytime</div></div></div>
    <div class="reveal" style="transition-delay:.18s"><div class="pricing-card pricing-card-default"><div class="pricing-name">Studio</div><div class="pricing-tag">For agencies &amp; large events</div><div class="pricing-price-row"><span class="pricing-price" data-price data-monthly="390" data-yearly="3 490">390</span><span class="pricing-unit" data-unit data-monthly="kr / month" data-yearly="kr / year">kr / month</span></div><div class="pricing-features"><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Everything in Pro</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Custom branding</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Bulk game creation</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Dedicated account support</div><div class="pricing-feature"><svg width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Early feature access</div></div><a href="/play?plan=studio&interval=monthly" class="pricing-cta pricing-cta-default" data-cta data-plan="studio">Get Studio</a><div class="pricing-lock">Cancel anytime · or <a href="mailto:hello@playgameon.app" style="color:var(--cyan);">talk to us</a></div></div></div>
  </div>
</section>

<!-- ══ FAQ ══ -->
<section id="faq-section">
  <div class="reveal" style="text-align:center;margin-bottom:50px;"><div class="section-eyebrow">FAQ</div><h2 class="section-h2">Questions, answered</h2></div>
  <div class="reveal" style="transition-delay:.1s">
    <div class="faq-item"><button class="faq-btn" onclick="toggleFaq(this)"><span class="faq-q">Do participants need to download an app?</span><span class="faq-icon open">+</span></button><div class="faq-body open"><p class="faq-a">No. Teams join through any web browser by entering a 6-digit code or scanning a QR code. No downloads, no accounts required for players.</p></div></div>
    <div class="faq-item"><button class="faq-btn" onclick="toggleFaq(this)"><span class="faq-q">How many teams can play at the same time?</span><span class="faq-icon">+</span></button><div class="faq-body"><p class="faq-a">The Starter plan supports up to 5 teams. Pro and Studio plans support unlimited teams &mdash; we&apos;ve run games with 100+ teams simultaneously without issues.</p></div></div>
    <div class="faq-item"><button class="faq-btn" onclick="toggleFaq(this)"><span class="faq-q">Can I create my own missions?</span><span class="faq-icon">+</span></button><div class="faq-body"><p class="faq-a">Yes! The custom mission builder (available on Pro and Studio) lets you create trivia, photo, true/false, timeline, and closest-answer missions tailored to your event theme.</p></div></div>
    <div class="faq-item"><button class="faq-btn" onclick="toggleFaq(this)"><span class="faq-q">How long does a typical game run?</span><span class="faq-icon">+</span></button><div class="faq-body"><p class="faq-a">Most events run 30&ndash;90 minutes. You set the duration when creating the game, and you can end it early at any time from your admin dashboard.</p></div></div>
    <div class="faq-item"><button class="faq-btn" onclick="toggleFaq(this)"><span class="faq-q">What happens after the game ends?</span><span class="faq-icon">+</span></button><div class="faq-body"><p class="faq-a">An auto-generated PDF report is ready immediately &mdash; full standings, per-team scores, mission breakdowns, fun stats, and the highest-rated photo from each team.</p></div></div>
    <div class="faq-item" style="border-bottom:none;"><button class="faq-btn" onclick="toggleFaq(this)"><span class="faq-q">What languages does GameOn support?</span><span class="faq-icon">+</span></button><div class="faq-body"><p class="faq-a">GameOn is available in Swedish, English, Danish, Norwegian, German, and French. Players see the interface in their chosen language automatically &mdash; no manual switching needed.</p></div></div>
  </div>
</section>

<!-- ══ FOOTER CTA ══ -->
<section id="footer-cta">
  <div class="footer-cta-glow glow-orb"></div>
  <div class="footer-cta-inner">
    <div class="reveal">
      <div class="float-a" style="display:inline-block;margin-bottom:30px;"><div class="footer-cta-icon"><svg width="36" height="36" viewBox="0 0 24 24"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg></div></div>
      <h2 class="footer-cta-h2">Ready to turn your<br><span style="background:linear-gradient(135deg,#7CBDD4,#A8D4E6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">next event epic?</span></h2>
      <p class="footer-cta-sub">Join thousands of organizers who&apos;ve already discovered the magic of GameOn.</p>
      <div class="footer-cta-row">
        <a href="/play" class="btn-primary-lg">Start for free &rarr;</a>
        <button class="btn-ghost" onclick="window.location.href='mailto:hello@playgameon.app'">Book a demo</button>
      </div>
      <p class="footer-cta-note">No credit card required &middot; Live in under 10 minutes &middot; Cancel anytime</p>
    </div>
  </div>
</section>

<!-- ══ FOOTER ══ -->
<footer>
  <div id="footer">
    <div class="footer-grid">
      <div class="footer-logo">
        <span class="footer-wordmark">Game<svg width="20" height="18" viewBox="0 0 24 22" fill="none" stroke="var(--cyan)" stroke-width="2.6" stroke-linecap="round" style="margin-right:-2px"><path d="M12 3v7"/><path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/></svg><span class="wm-on">n</span></span>
      </div>
      <p class="footer-copy">&copy; 2026 GameOn. All rights reserved.</p>
      <nav class="footer-links">
        <a href="/privacy" class="footer-link">Privacy Policy</a>
        <a href="/terms" class="footer-link">Terms</a>
        <a href="/dpa" class="footer-link">DPA</a>
        <a href="mailto:hello@playgameon.app" class="footer-link">Contact</a>
      </nav>
    </div>
  </div>
</footer>
`;

export default function LandingPage() {
  useEffect(() => {
    // ── Body styles
    const prev = { bg: document.body.style.background, color: document.body.style.color, overflow: document.body.style.overflowX };
    document.body.style.background = '#0D1520';
    document.body.style.color      = '#DCE4EE';
    document.body.style.overflowX  = 'hidden';

    // ── Word reveal
    function buildWordReveal(el: HTMLElement, text: string, base: number, stagger: number) {
      el.innerHTML = '';
      text.split(' ').forEach((word, i) => {
        const s = document.createElement('span');
        s.className = 'word';
        s.textContent = word;
        s.style.animationDelay = (base + i * stagger) + 's';
        el.appendChild(s);
        if (i < text.split(' ').length - 1) el.appendChild(document.createTextNode(' '));
      });
    }
    const l1 = document.getElementById('hero-line1');
    const l2 = document.getElementById('hero-line2');
    if (l1) buildWordReveal(l1, 'Turn any event', 0.15, 0.09);
    if (l2) buildWordReveal(l2, 'into an epic game', 0.42, 0.09);

    // ── Marquee
    const track = document.getElementById('marquee-track');
    if (track) {
      const orgs = ['Volvo','Spotify','IKEA','Ericsson','H&M','Klarna','King','Mojang','iZettle','Bambora','Voi','Dustin'];
      [...orgs, ...orgs].forEach(o => { const d = document.createElement('div'); d.className = 'marquee-item'; d.textContent = o; track.appendChild(d); });
    }

    // ── Scroll reveal
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const delayMap = new WeakMap<HTMLElement, number>();
    reveals.forEach(el => { delayMap.set(el, parseFloat(el.style.transitionDelay || '0') * 1000); el.style.transitionDelay = '0s'; });
    const revObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { const el = e.target as HTMLElement; setTimeout(() => el.classList.add('visible'), delayMap.get(el) ?? 0); revObs.unobserve(el); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => revObs.observe(el));
    setTimeout(() => reveals.forEach(el => { if (el.getBoundingClientRect().top < window.innerHeight * 0.95) setTimeout(() => el.classList.add('visible'), delayMap.get(el) ?? 0); }), 80);

    // ── Counters
    function animCounter(el: HTMLElement) {
      const to = parseInt(el.dataset.to ?? '0'), suf = el.dataset.suffix ?? '', pre = el.dataset.prefix ?? '';
      const t0 = performance.now(), dur = 1800, ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => { const p = Math.min((now - t0) / dur, 1); el.textContent = pre + Math.round(ease(p) * to).toLocaleString() + suf; if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    const cntObs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { animCounter(e.target as HTMLElement); cntObs.unobserve(e.target); } }), { threshold: 0.4 });
    document.querySelectorAll('.counter').forEach(el => cntObs.observe(el));

    // ── Nav scroll
    const navEl = document.getElementById('nav');
    const onScroll = () => navEl?.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── Parallax
    const g1 = document.getElementById('hero-glow-1');
    const onMove = (e: MouseEvent) => { if (!g1) return; const x = (e.clientX/window.innerWidth-.5)*2, y = (e.clientY/window.innerHeight-.5)*2; g1.style.marginLeft=x*9+'px'; g1.style.marginTop=y*6+'px'; };
    window.addEventListener('mousemove', onMove, { passive: true });

    // ── 3D tilt
    document.querySelectorAll<HTMLElement>('.tilt-card').forEach(card => {
      card.addEventListener('mousemove', e => { const r = card.getBoundingClientRect(), x = (e.clientX-r.left)/r.width-.5, y = (e.clientY-r.top)/r.height-.5; card.style.transform = `perspective(900px) rotateX(${-y*10}deg) rotateY(${x*10}deg) translateZ(8px)`; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)'; });
    });

    // ── Pricing monthly/annual toggle
    (window as any).setBilling = (interval: 'monthly' | 'yearly') => {
      document.querySelectorAll<HTMLElement>('.billing-opt').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-interval') === interval));
      document.querySelectorAll<HTMLElement>('[data-price],[data-unit]').forEach(el => {
        const v = el.getAttribute('data-' + interval);
        if (v !== null) el.textContent = v;
      });
      document.querySelectorAll<HTMLAnchorElement>('[data-cta]').forEach(a => {
        const plan = a.getAttribute('data-plan');
        a.setAttribute('href', `/play?plan=${plan}&interval=${interval}`);
      });
    };

    // ── FAQ
    (window as any).toggleFaq = (btn: HTMLButtonElement) => {
      const icon = btn.querySelector<HTMLElement>('.faq-icon'), body = btn.nextElementSibling as HTMLElement, was = body.classList.contains('open');
      document.querySelectorAll('.faq-body.open').forEach(b => b.classList.remove('open'));
      document.querySelectorAll('.faq-icon.open').forEach(i => i.classList.remove('open'));
      if (!was) { body.classList.add('open'); icon?.classList.add('open'); }
    };

    return () => {
      document.body.style.background = prev.bg;
      document.body.style.color      = prev.color;
      document.body.style.overflowX  = prev.overflow;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
      revObs.disconnect(); cntObs.disconnect();
      delete (window as any).toggleFaq;
      delete (window as any).setBilling;
    };
  }, []);

  return (
    <>
      <div style={{ fontFamily: "'Sora', sans-serif", minHeight: '100vh' }} dangerouslySetInnerHTML={{ __html: MARKUP }} />
      <ChatWidget />
    </>
  );
}
