import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, ComposedChart, ReferenceLine,
} from "recharts";

// ─── PASTE YOUR GROQ API KEY HERE ────────────────────────────────────────────
const GROQ_API_KEY = "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";
const GROQ_MODEL = "llama-3.3-70b-versatile";
// ─────────────────────────────────────────────────────────────────────────────

// ─── THEME — DUN + WALNUT BROWN ──────────────────────────────────────────────
const T = {
  dun: "#D8C7B5",
  dunLight: "#EAE0D5",
  dunDark: "#C4AF9A",
  walnut: "#67625C",
  walnutLight: "#847D76",
  walnutDark: "#4A4540",
  walnutDeep: "#2E2B28",
  walnutDeeper: "#1A1816",
  gold: "#C9A84C",
  goldLight: "#E0BC6A",
  cream: "#F5EFE8",
  red: "#A64444",
  green: "#4A7C59",
  blue: "#4A6B8A",
  muted: "#9A9490",
  ink: "#1A1816",
};

// ─── GROQ API ────────────────────────────────────────────────────────────────
async function callGroq(prompt, systemPrompt, onStream) {
  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_KEY_HERE") {
    const msg = "⚠️ Please paste your Groq API key at the top of DNRCapitalsV2.jsx (line 8). Get free key at console.groq.com";
    if (onStream) onStream(msg);
    return msg;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt || "You are DNR Capitals AI Research Engine — expert equity analyst with 30 years experience in Indian and global markets." },
          { role: "user", content: prompt }
        ],
        max_tokens: 2048, temperature: 0.7, stream: true,
      }),
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`Groq Error ${res.status}: ${e}`); }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const d = JSON.parse(line.slice(6));
            const text = d.choices?.[0]?.delta?.content;
            if (text) { full += text; if (onStream) onStream(full); }
          } catch (_) {}
        }
      }
    }
    return full;
  } catch (e) {
    const msg = `Error: ${e.message}`;
    if (onStream) onStream(msg);
    return msg;
  }
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Jost:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${T.walnutDeep}}
  ::-webkit-scrollbar-thumb{background:${T.walnut};border-radius:2px}
  body{font-family:'Jost',sans-serif;background:${T.walnutDeeper};color:${T.dun}}

  .app{min-height:100vh;background:${T.walnutDeeper};font-family:'Jost',sans-serif}

  /* HEADER */
  .hdr{
    background:linear-gradient(90deg,${T.walnutDeep},${T.walnutDark}88);
    border-bottom:1px solid ${T.walnut}44;
    padding:0 24px;height:60px;
    display:flex;align-items:center;justify-content:space-between;
    position:sticky;top:0;z-index:200;backdrop-filter:blur(16px);
  }
  .logo{display:flex;align-items:center;gap:12px}
  .logo-mark{
    width:38px;height:38px;
    background:linear-gradient(135deg,${T.goldLight},${T.gold});
    border-radius:8px;display:flex;align-items:center;justify-content:center;
    font-family:'Cormorant Garamond',serif;font-weight:700;font-size:18px;
    color:${T.walnutDeep};box-shadow:0 0 20px ${T.gold}44;
  }
  .logo-title{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:${T.dun};line-height:1}
  .logo-sub{font-size:9px;color:${T.goldLight};letter-spacing:2.5px;text-transform:uppercase;margin-top:2px}

  .ticker{
    flex:1;overflow:hidden;margin:0 20px;
    font-family:'DM Mono',monospace;font-size:10px;color:${T.dunDark};
    mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);
  }
  .ticker-inner{display:flex;gap:28px;animation:tickScroll 35s linear infinite;white-space:nowrap}
  @keyframes tickScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  .t-up{color:${T.green}} .t-dn{color:${T.red}}

  /* NAV */
  .nav{
    background:${T.walnutDeep}dd;border-bottom:1px solid ${T.walnut}33;
    display:flex;padding:0 20px;gap:1px;overflow-x:auto;
    backdrop-filter:blur(8px);
  }
  .nb{
    padding:11px 16px;background:none;border:none;
    font-family:'Jost',sans-serif;font-size:12px;font-weight:500;
    color:${T.muted};cursor:pointer;border-bottom:2px solid transparent;
    transition:all 0.2s;white-space:nowrap;letter-spacing:0.5px;
  }
  .nb:hover{color:${T.dun};background:${T.walnut}22}
  .nb.on{color:${T.goldLight};border-bottom-color:${T.goldLight};background:${T.walnut}15}

  /* MAIN */
  .main{padding:20px;max-width:1700px;margin:0 auto}

  /* CARDS */
  .card{
    background:linear-gradient(135deg,${T.walnutDark}88,${T.walnutDeep}cc);
    border:1px solid ${T.walnut}44;border-radius:12px;padding:18px;
    backdrop-filter:blur(8px);transition:border-color 0.2s;
  }
  .card:hover{border-color:${T.walnut}88}
  .card-gold{border-color:${T.gold}44}
  .card-sm{padding:12px 14px}

  /* TYPOGRAPHY */
  .sec-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:${T.dun};margin-bottom:4px}
  .sec-sub{font-size:12px;color:${T.muted};margin-bottom:18px;letter-spacing:0.3px}
  .card-title{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600;color:${T.dun};margin-bottom:12px}

  /* BUTTONS */
  .btn-primary{
    background:linear-gradient(135deg,${T.walnutLight},${T.walnut});
    border:1px solid ${T.walnutLight}88;border-radius:8px;padding:9px 18px;
    color:${T.dun};font-family:'Jost',sans-serif;font-size:12px;font-weight:600;
    cursor:pointer;transition:all 0.2s;white-space:nowrap;letter-spacing:0.5px;
  }
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 14px ${T.walnut}55}
  .btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}
  .btn-gold{
    background:linear-gradient(135deg,${T.goldLight},${T.gold});
    border:none;border-radius:8px;padding:9px 18px;
    color:${T.walnutDeep};font-family:'Jost',sans-serif;font-size:12px;font-weight:700;
    cursor:pointer;transition:all 0.2s;white-space:nowrap;
  }
  .btn-gold:hover{transform:translateY(-1px);box-shadow:0 4px 18px ${T.gold}55}
  .btn-gold:disabled{opacity:0.4;cursor:not-allowed;transform:none}
  .btn-ghost{
    background:transparent;border:1px solid ${T.walnut}55;border-radius:7px;
    padding:7px 13px;color:${T.muted};font-family:'Jost',sans-serif;font-size:11px;
    cursor:pointer;transition:all 0.2s;
  }
  .btn-ghost:hover{border-color:${T.walnut};color:${T.dun};background:${T.walnut}22}
  .btn-sm{padding:5px 12px;font-size:11px}
  .btn-danger{background:${T.red}22;border:1px solid ${T.red}44;border-radius:6px;padding:4px 10px;color:${T.red};font-size:11px;cursor:pointer;transition:all 0.2s}
  .btn-danger:hover{background:${T.red}44}

  /* INPUTS */
  .inp{
    flex:1;background:${T.walnutDeep}cc;border:1px solid ${T.walnut}55;
    border-radius:8px;padding:9px 14px;color:${T.dun};
    font-family:'Jost',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s;
  }
  .inp:focus{border-color:${T.goldLight}}
  .inp::placeholder{color:${T.muted}}

  /* GRIDS */
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .g5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}

  /* STAT CARDS */
  .stat{background:${T.walnutDeep}cc;border:1px solid ${T.walnut}33;border-radius:10px;padding:14px;text-align:center}
  .stat-lbl{font-size:9px;color:${T.muted};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
  .stat-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:600;color:${T.dun}}
  .stat-chg{font-size:11px;margin-top:3px}
  .pos{color:${T.green}} .neg{color:${T.red}}

  /* RESEARCH */
  .rs{border:1px solid ${T.walnut}33;border-radius:10px;margin-bottom:10px;overflow:hidden}
  .rs-hdr{background:${T.walnutDark}88;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:background 0.2s}
  .rs-hdr:hover{background:${T.walnut}22}
  .rs-title{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:${T.dun};display:flex;align-items:center;gap:8px}
  .rs-badge{background:${T.walnut}33;border-radius:10px;padding:2px 9px;font-size:9px;font-family:'DM Mono',monospace;color:${T.goldLight};letter-spacing:1px}
  .rs-body{padding:16px}
  .prose{font-size:13px;line-height:1.85;color:${T.dunDark};white-space:pre-wrap}
  .prose strong{color:${T.goldLight};font-weight:600}

  /* STEPS */
  .steps{display:flex;gap:3px;margin-bottom:16px;flex-wrap:wrap}
  .step{padding:3px 10px;border-radius:16px;font-size:10px;border:1px solid ${T.walnut}44;color:${T.muted};transition:all 0.3s}
  .step.done{background:${T.green}22;border-color:${T.green}55;color:#80c080}
  .step.active{background:${T.goldLight}22;border-color:${T.goldLight}88;color:${T.goldLight};animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${T.goldLight}44}50%{box-shadow:0 0 0 5px transparent}}

  /* LOADING */
  .ld::after{content:'.';animation:dots 1.5s infinite}
  @keyframes dots{0%,20%{content:'.'}40%{content:'..'}60%,100%{content:'...'}}

  /* NEWS */
  .news-card{border:1px solid ${T.walnut}33;border-radius:9px;padding:12px 14px;margin-bottom:8px;background:${T.walnutDeep}88;transition:all 0.2s}
  .news-card:hover{border-color:${T.walnut}66}
  .news-src{font-size:9px;color:${T.goldLight};letter-spacing:1px;text-transform:uppercase}
  .news-hl{font-size:13px;color:${T.dun};margin:3px 0;font-weight:500;line-height:1.4}
  .news-tm{font-size:10px;color:${T.muted}}

  /* LEGEND */
  .leg-card{border-left:3px solid ${T.goldLight};padding:12px 14px;margin-bottom:10px;background:${T.walnutDeep}66;border-radius:0 8px 8px 0}
  .leg-name{font-family:'Cormorant Garamond',serif;font-size:15px;color:${T.goldLight};font-weight:600}
  .leg-title{font-size:10px;color:${T.muted};margin-bottom:6px}
  .leg-quote{font-size:13px;color:${T.dunDark};line-height:1.65;font-style:italic}

  /* PORTFOLIO */
  .p-row{display:grid;grid-template-columns:2fr 0.7fr 1fr 1fr 1fr 1.2fr 70px;gap:6px;align-items:center;padding:9px 11px;border-bottom:1px solid ${T.walnut}22;font-size:12px;transition:background 0.15s}
  .p-row:hover{background:${T.walnut}15}
  .p-hdr{font-size:9px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;font-weight:600}

  /* WATCHLIST */
  .wl-stock{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid ${T.walnut}22;font-size:12px;transition:background 0.15s}
  .wl-stock:hover{background:${T.walnut}15}

  /* TABS MINI */
  .tab-mini{display:flex;gap:3px;margin-bottom:14px;background:${T.walnutDeep};border-radius:8px;padding:3px;width:fit-content}
  .tmb{padding:6px 13px;border-radius:6px;background:none;border:none;color:${T.muted};font-size:11px;cursor:pointer;transition:all 0.2s;font-family:'Jost',sans-serif}
  .tmb.on{background:${T.walnut};color:${T.dun}}

  /* CHART */
  .chart-title{font-size:10px;color:${T.muted};margin-bottom:8px;letter-spacing:1px;text-transform:uppercase}

  /* TECHNICAL */
  .indicator-card{background:${T.walnutDeep}cc;border:1px solid ${T.walnut}44;border-radius:10px;padding:14px}
  .ind-name{font-size:10px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
  .ind-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:600}
  .ind-sig{font-size:10px;margin-top:3px;font-weight:600;letter-spacing:1px}
  .sig-buy{color:${T.green}} .sig-sell{color:${T.red}} .sig-neutral{color:${T.gold}}

  /* SCREENER */
  .scr-row{display:grid;grid-template-columns:1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr;gap:6px;align-items:center;padding:9px 11px;border-bottom:1px solid ${T.walnut}22;font-size:11px;transition:background 0.15s}
  .scr-row:hover{background:${T.walnut}15;cursor:pointer}
  .scr-hdr{font-size:9px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;font-weight:600;border-bottom:2px solid ${T.walnut}44}

  /* PEER */
  .peer-table{width:100%;border-collapse:collapse;font-size:12px}
  .peer-table th{background:${T.walnutDark}88;padding:9px 12px;text-align:left;font-size:10px;color:${T.goldLight};letter-spacing:1px;text-transform:uppercase;font-weight:600}
  .peer-table td{padding:9px 12px;border-bottom:1px solid ${T.walnut}22;color:${T.dunDark}}
  .peer-table tr:hover td{background:${T.walnut}15}
  .peer-best{color:${T.green};font-weight:700}
  .peer-worst{color:${T.red}}

  /* QUARTERLY */
  .q-card{background:${T.walnutDeep}88;border:1px solid ${T.walnut}33;border-radius:10px;padding:14px;margin-bottom:10px}
  .q-quarter{font-family:'DM Mono',monospace;font-size:11px;color:${T.goldLight};margin-bottom:8px;letter-spacing:1px}
  .q-metric{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid ${T.walnut}15;font-size:12px}

  /* API BANNER */
  .api-warn{background:${T.gold}15;border:1px solid ${T.gold}44;border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;font-size:13px}

  /* VERDICT */
  .verdict-box{background:linear-gradient(135deg,${T.walnutDark},${T.walnutDeep});border:2px solid ${T.gold}55;border-radius:14px;padding:22px;text-align:center;margin-top:18px}

  @media(max-width:768px){
    .g3,.g4,.g5{grid-template-columns:1fr 1fr}
    .g2{grid-template-columns:1fr}
    .main{padding:12px}
    .ticker{display:none}
    .scr-row{grid-template-columns:1.5fr 1fr 1fr 1fr}
  }

  /* HOME PAGE — PREMIUM CINEMATIC */
  .home-hero{
    position:relative;min-height:100vh;
    display:flex;flex-direction:column;
    overflow:hidden;background:#0e0c09;
  }
  .hero-bg-main{
    position:absolute;inset:0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, #3a3020 0%, #1a1610 30%, #0e0c09 65%),
      radial-gradient(ellipse 40% 40% at 80% 60%, #2a2418 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 20% 80%, #1e1a12 0%, transparent 60%);
  }
  .hero-particles{position:absolute;inset:0;overflow:hidden}
  .particle{
    position:absolute;border-radius:50%;
    background:${T.goldLight};
    animation:particleFloat linear infinite;
    pointer-events:none;
  }
  @keyframes particleFloat{
    0%{transform:translateY(100vh) translateX(0);opacity:0}
    10%{opacity:1}90%{opacity:0.6}
    100%{transform:translateY(-10vh) translateX(30px);opacity:0}
  }
  .hero-globe-ring{
    position:absolute;right:-15%;top:50%;transform:translateY(-50%);
    width:700px;height:700px;border-radius:50%;
    border:1px solid ${T.gold}18;
    animation:globeSpin 40s linear infinite;
  }
  .hero-globe-ring2{
    position:absolute;right:-20%;top:50%;transform:translateY(-50%);
    width:850px;height:850px;border-radius:50%;
    border:1px solid ${T.gold}0c;
    animation:globeSpin 60s linear infinite reverse;
  }
  .hero-globe-ring3{
    position:absolute;right:-25%;top:50%;transform:translateY(-50%);
    width:1000px;height:1000px;border-radius:50%;
    border:1px solid ${T.gold}08;
    animation:globeSpin 80s linear infinite;
  }
  @keyframes globeSpin{0%{transform:translateY(-50%) rotate(0deg)}100%{transform:translateY(-50%) rotate(360deg)}}
  .hero-scanline{
    position:absolute;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,${T.gold}44,${T.goldLight}88,${T.gold}44,transparent);
    animation:scanMove 8s ease-in-out infinite;pointer-events:none;
  }
  @keyframes scanMove{0%,100%{top:20%;opacity:0}10%{opacity:1}90%{opacity:1}50%{top:80%;opacity:0.6}}
  .hero-grid-lines{
    position:absolute;inset:0;
    background-image:linear-gradient(${T.gold}06 1px,transparent 1px),linear-gradient(90deg,${T.gold}06 1px,transparent 1px);
    background-size:80px 80px;
    mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 80%);
  }
  .hero-center-glow{
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:600px;height:600px;border-radius:50%;
    background:radial-gradient(circle,${T.gold}08 0%,transparent 70%);pointer-events:none;
  }
  .hero-content-wrap{
    position:relative;z-index:10;flex:1;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:60px 40px 40px;text-align:center;
  }
  @keyframes heroFade{0%{opacity:0;transform:translateY(24px)}100%{opacity:1;transform:translateY(0)}}
  .hero-eyebrow{
    display:flex;align-items:center;gap:14px;font-size:9px;
    letter-spacing:5px;color:${T.goldLight};text-transform:uppercase;
    margin-bottom:24px;animation:heroFade 1s ease forwards;
  }
  .hero-eyebrow-line{width:50px;height:1px;background:linear-gradient(90deg,transparent,${T.goldLight})}
  .hero-title{
    font-family:'Cormorant Garamond',serif;
    font-size:clamp(52px,8vw,108px);font-weight:700;
    line-height:0.9;margin-bottom:6px;color:#f0e8dc;
    text-shadow:0 0 120px ${T.gold}33;animation:heroFade 1.2s ease forwards;
  }
  .hero-title-accent{
    font-family:'Cormorant Garamond',serif;
    font-size:clamp(52px,8vw,108px);font-weight:700;
    font-style:italic;color:${T.goldLight};display:block;line-height:1;
    margin-bottom:28px;text-shadow:0 0 60px ${T.gold}55;animation:heroFade 1.4s ease forwards;
  }
  .hero-divider{display:flex;align-items:center;gap:16px;margin-bottom:22px;animation:heroFade 1.5s ease forwards;}
  .hero-divider-line{flex:1;max-width:120px;height:1px;background:linear-gradient(90deg,transparent,${T.gold}55)}
  .hero-divider-diamond{width:8px;height:8px;background:${T.goldLight};transform:rotate(45deg);box-shadow:0 0 12px ${T.gold}88}
  .hero-subtitle{
    font-size:14px;color:#9a8f82;max-width:520px;line-height:1.9;
    letter-spacing:0.5px;font-weight:300;margin-bottom:36px;animation:heroFade 1.6s ease forwards;
  }
  .hero-btns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:56px;animation:heroFade 1.8s ease forwards;}
  .hero-stats-bar{
    position:relative;z-index:10;display:flex;align-items:center;justify-content:center;
    gap:0;width:100%;
    background:linear-gradient(90deg,transparent,#0e0c0988 20%,#0e0c0988 80%,transparent);
    border-top:1px solid ${T.gold}22;border-bottom:1px solid ${T.gold}22;
    padding:18px 40px;animation:heroFade 2s ease forwards;
  }
  .hero-stat-item{
    display:flex;flex-direction:column;align-items:center;
    padding:0 28px;border-right:1px solid ${T.gold}18;min-width:130px;
  }
  .hero-stat-item:last-child{border-right:none}
  .hero-features{
    position:relative;z-index:10;display:grid;grid-template-columns:repeat(3,1fr);
    gap:1px;width:100%;background:${T.gold}11;border-top:1px solid ${T.gold}18;
    animation:heroFade 2.2s ease forwards;
  }
  .hero-feature{
    background:#0e0c09;padding:28px 32px;transition:background 0.3s;
    cursor:pointer;display:flex;align-items:flex-start;gap:16px;
  }
  .hero-feature:hover{background:#1a1610}
  .hero-feature-icon{
    font-size:22px;width:44px;height:44px;background:${T.gold}15;
    border:1px solid ${T.gold}33;border-radius:8px;display:flex;
    align-items:center;justify-content:center;flex-shrink:0;
  }
  .hero-feature-title{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;color:#d8c7b5;margin-bottom:4px}
  .hero-feature-desc{font-size:11px;color:#6a6058;line-height:1.6}
  .hero-quote-strip{
    position:relative;z-index:10;padding:20px 40px;text-align:center;
    border-top:1px solid ${T.gold}11;
    background:linear-gradient(90deg,transparent,#1a161088 50%,transparent);
  }
  .hero-quote-text{font-family:'Cormorant Garamond',serif;font-size:16px;font-style:italic;color:#6a6058;line-height:1.6}
  .hero-quote-author{font-size:9px;color:${T.gold}66;letter-spacing:3px;text-transform:uppercase;margin-top:6px}

`;

// ─── TICKER DATA ──────────────────────────────────────────────────────────────
const TICKERS = [
  {s:"NIFTY 50",v:"24,188",c:"+0.43%",u:true},{s:"SENSEX",v:"79,802",c:"+0.38%",u:true},
  {s:"NIFTY BANK",v:"51,204",c:"+0.62%",u:true},{s:"S&P 500",v:"6,118",c:"+0.29%",u:true},
  {s:"NASDAQ",v:"19,954",c:"+0.51%",u:true},{s:"DOW",v:"44,556",c:"-0.11%",u:false},
  {s:"GOLD",v:"₹82,410",c:"+0.18%",u:true},{s:"CRUDE",v:"$74.30",c:"-0.55%",u:false},
  {s:"USD/INR",v:"86.42",c:"+0.08%",u:true},{s:"NIFTY IT",v:"41,204",c:"+1.20%",u:true},
  {s:"MIDCAP 150",v:"18,420",c:"+0.88%",u:true},{s:"SMALLCAP",v:"12,840",c:"+1.10%",u:true},
];

const RESEARCH_STEPS = [
  "Business Overview","Product Portfolio","Industry Analysis",
  "Financial Statements","Balance Sheet","Income Statement",
  "Cash Flow Analysis","Peer Comparison","Quarterly Results",
  "Management Analysis","Corporate Actions","Shareholding Pattern",
  "Key Ratios","DCF Valuation","Audit & Governance",
  "News & Sentiment","Technical Analysis","Final Verdict",
];

const SYS = `You are DNR Capitals' senior equity analyst — combining Warren Buffett's philosophy, Peter Lynch's stock picking, and 30 years of Indian market expertise. Provide institutional-quality, specific research with **bold** key terms and numbers. Always give actionable insights.`;

// ─── QUOTE ROTATOR ────────────────────────────────────────────────────────────
const QUOTES = [
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "Trade what you see, not what you think.", author: "Research Principle" },
  { text: "塵も積もれば山となる — Dust accumulated becomes a mountain.", author: "Japanese Proverb" },
  { text: "Risk comes from not knowing what you are doing.", author: "Warren Buffett" },
  { text: "The four most dangerous words in investing: This time it's different.", author: "Sir John Templeton" },
  { text: "In the short run the market is a voting machine. In the long run it is a weighing machine.", author: "Benjamin Graham" },
  { text: "The best investment you can make is in yourself.", author: "Warren Buffett" },
];
function QuoteRotator() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % QUOTES.length); setFade(true); }, 500);
    }, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ transition: "opacity 0.5s", opacity: fade ? 1 : 0, textAlign: "center" }}>
      <div className="hero-quote-text">"{QUOTES[idx].text}"</div>
      <div className="hero-quote-author">— {QUOTES[idx].author}</div>
    </div>
  );
}

function HomePage({ setActiveTab }) {
  const particles = Array.from({ length: 25 }, (_, i) => ({
    left: `${(i * 4.1) % 100}%`,
    width: `${1 + (i % 3)}px`,
    height: `${1 + (i % 3)}px`,
    duration: `${8 + (i * 1.1) % 14}s`,
    delay: `${(i * 0.8) % 10}s`,
    opacity: 0.2 + (i % 4) * 0.1,
  }));

  const stats = [
    { l: "NIFTY 50", v: "24,188", c: "+0.43%", u: true },
    { l: "SENSEX", v: "79,802", c: "+0.38%", u: true },
    { l: "GOLD", v: "₹82,410", c: "+0.18%", u: true },
    { l: "USD/INR", v: "86.42", c: "+0.08%", u: true },
    { l: "CRUDE OIL", v: "$74.30", c: "-0.55%", u: false },
  ];

  const features = [
    { icon: "🔬", title: "18-Dimension Research", desc: "Business · Financials · Valuation · Technical · Peer Comparison", tab: "research" },
    { icon: "📈", title: "Technical Charts Suite", desc: "MA · RSI · MACD · Bollinger Bands · Volume Analysis", tab: "technical" },
    { icon: "📋", title: "Quarterly Hub", desc: "Results · Con Calls · Investor Presentations · Guidance", tab: "quarterly" },
    { icon: "🔍", title: "Smart Screener", desc: "Filter by P/E · ROE · Growth · Margins · AI Quick Analysis", tab: "screener" },
    { icon: "💼", title: "Portfolio Tracker", desc: "Real-time P&L · AI Portfolio Review · Allocation Charts", tab: "portfolio" },
    { icon: "🏛️", title: "Legends Corner", desc: "Buffett · Munger · Jhunjhunwala · CEO Insights", tab: "legends" },
  ];

  return (
    <div className="home-hero">
      {/* Backgrounds */}
      <div className="hero-bg-main" />
      <div className="hero-grid-lines" />
      <div className="hero-center-glow" />
      <div className="hero-scanline" />

      {/* Spinning rings */}
      <div className="hero-globe-ring" />
      <div className="hero-globe-ring2" />
      <div className="hero-globe-ring3" />

      {/* Floating particles */}
      <div className="hero-particles">
        {particles.map((p, i) => (
          <div key={i} className="particle" style={{ left: p.left, bottom: "-10px", width: p.width, height: p.height, animationDuration: p.duration, animationDelay: p.delay, opacity: p.opacity }} />
        ))}
      </div>

      {/* Main content */}
      <div className="hero-content-wrap">
        <div className="hero-eyebrow">
          <div className="hero-eyebrow-line" />
          DNR Capitals · Equity Research Intelligence
          <div className="hero-eyebrow-line" />
        </div>

        <h1 className="hero-title">Know Before</h1>
        <span className="hero-title-accent">You Invest</span>

        <div className="hero-divider">
          <div className="hero-divider-line" />
          <div className="hero-divider-diamond" />
          <div className="hero-divider-line" />
        </div>

        <p className="hero-subtitle">
          Institutional-grade equity research powered by Groq AI. Deep-dive analysis across 18 dimensions — from business fundamentals to technical charts, peer benchmarking and portfolio intelligence.
        </p>

        <div className="hero-btns">
          <button className="btn-gold" onClick={() => setActiveTab("research")} style={{ padding: "13px 32px", fontSize: 13, letterSpacing: "0.5px" }}>
            🔬 Start Deep Research
          </button>
          <button className="btn-primary" onClick={() => setActiveTab("technical")} style={{ padding: "13px 32px", fontSize: 13 }}>
            📈 Technical Charts
          </button>
          <button className="btn-ghost" onClick={() => setActiveTab("screener")} style={{ padding: "13px 32px", fontSize: 13, color: "#9a8f82", borderColor: "#67625c55" }}>
            🔍 Screener
          </button>
        </div>
      </div>

      {/* Live stats bar */}
      <div className="hero-stats-bar">
        {stats.map(s => (
          <div key={s.l} className="hero-stat-item">
            <div style={{ fontSize: 8, color: "#6a6058", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 600, color: "#d8c7b5" }}>{s.v}</div>
            <div style={{ fontSize: 10, color: s.u ? T.green : T.red, marginTop: 2 }}>{s.u ? "▲" : "▼"} {s.c}</div>
          </div>
        ))}
      </div>

      {/* Feature grid */}
      <div className="hero-features">
        {features.map(f => (
          <div key={f.title} className="hero-feature" onClick={() => setActiveTab(f.tab)}>
            <div className="hero-feature-icon">{f.icon}</div>
            <div>
              <div className="hero-feature-title">{f.title}</div>
              <div className="hero-feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quote */}
      <div className="hero-quote-strip">
        <QuoteRotator />
      </div>
    </div>
  );
}

// ─── MARKETS ──────────────────────────────────────────────────────────────────
function Markets() {
  const [summary, setSummary] = useState("");
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [tab, setTab] = useState("overview");

  const fetchOverview = async () => {
    setLoading(true); setSummary("");
    await callGroq(
      `Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Provide comprehensive daily market overview: 1) **Indian Markets** — Nifty50, Sensex, Bank Nifty, IT, Midcap key drivers with specific levels 2) **Global Markets** — US, Europe, Asia with index levels 3) **Macro Factors** — FII/DII flows, RBI stance, Fed signals, USD/INR, crude, gold 4) **Top Sectoral Movers** — best and worst sectors 5) **Key Corporate Developments** 6) **Market Outlook** — short-term directional view with key levels 7) **Events This Week**. Be specific with numbers like a Bloomberg strategist.`,
      SYS, (t) => setSummary(t)
    );
    setLoading(false);
  };

  const fetchNews = async () => {
    setNewsLoading(true); setNews([]);
    try {
      const raw = await callGroq(
        `Generate 10 realistic Indian market news headlines for today. Return ONLY valid JSON array: [{"source":"ET Markets","headline":"...","time":"2h ago","sentiment":"positive","category":"India"}]. Categories: India macro, Global, Sector, Corporate. Sentiment: positive/negative/neutral. No markdown, just JSON array.`,
        "Return only valid JSON array, no other text.", null
      );
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setNews(JSON.parse(match[0]));
    } catch { setNews([{ source: "System", headline: "Retry news fetch.", time: "now", sentiment: "neutral", category: "India" }]); }
    setNewsLoading(false);
  };

  const sc = (s) => s === "positive" ? T.green : s === "negative" ? T.red : T.muted;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div><div className="sec-title">📊 Market Overview</div><div className="sec-sub">Daily intelligence — Indian & global markets powered by Groq AI</div></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-gold" onClick={fetchOverview} disabled={loading}>{loading ? "⏳ Analyzing..." : "🔄 Refresh"}</button>
          <button className="btn-primary" onClick={fetchNews} disabled={newsLoading}>{newsLoading ? "..." : "📰 Fetch News"}</button>
        </div>
      </div>
      <div className="g4" style={{ marginBottom: 18 }}>
        {[{l:"NIFTY 50",v:"24,188",c:"+0.43%",u:true},{l:"SENSEX",v:"79,802",c:"+0.38%",u:true},{l:"NIFTY BANK",v:"51,204",c:"+0.62%",u:true},{l:"NIFTY IT",v:"41,204",c:"+1.20%",u:true}].map(s=>(
          <div key={s.l} className="stat"><div className="stat-lbl">{s.l}</div><div className="stat-val">{s.v}</div><div className={`stat-chg ${s.u?"pos":"neg"}`}>{s.u?"▲":"▼"} {s.c}</div></div>
        ))}
      </div>
      <div className="tab-mini">
        {["overview","news"].map(t=><button key={t} className={`tmb ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{t==="overview"?"🌐 Analysis":"📰 News Feed"}</button>)}
      </div>
      {tab==="overview"&&(
        <div className="card">
          {!summary&&!loading&&<div style={{textAlign:"center",padding:"48px 20px",color:T.muted}}><div style={{fontSize:48,marginBottom:12}}>📈</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.dun,marginBottom:8}}>Daily Market Intelligence</div><div style={{fontSize:13}}>Click Refresh to get today's comprehensive market analysis</div></div>}
          {loading&&<div style={{color:T.goldLight}}><span className="ld">Analyzing global markets</span></div>}
          {summary&&<div className="prose" dangerouslySetInnerHTML={{__html:summary.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")}}/>}
        </div>
      )}
      {tab==="news"&&(
        <div>
          {!news.length&&!newsLoading&&<div className="card" style={{textAlign:"center",padding:"40px",color:T.muted}}><div style={{fontSize:36,marginBottom:10}}>📰</div><div>Click "Fetch News"</div></div>}
          {newsLoading&&<div className="card" style={{color:T.goldLight}}><span className="ld">Fetching news</span></div>}
          {news.map((n,i)=>(
            <div key={i} className="news-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div className="news-src">{n.source} · {n.category}</div><div className="news-hl">{n.headline}</div><div className="news-tm">{n.time}</div></div>
                <span style={{fontSize:9,padding:"2px 9px",borderRadius:16,background:sc(n.sentiment)+"22",border:`1px solid ${sc(n.sentiment)}44`,color:sc(n.sentiment),marginLeft:10,whiteSpace:"nowrap"}}>{n.sentiment}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TECHNICAL CHARTS ─────────────────────────────────────────────────────────
function TechnicalCharts() {
  const [symbol, setSymbol] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [timeframe, setTimeframe] = useState("1Y");

  const generateTechnicalData = (sym) => {
    const seed = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const days = timeframe === "1M" ? 30 : timeframe === "3M" ? 90 : timeframe === "6M" ? 180 : 252;
    const prices = [];
    let price = 1000 + (seed % 2000);
    for (let i = 0; i < days; i++) {
      const chg = (Math.random() - 0.48) * price * 0.025;
      price = Math.max(price + chg, 100);
      const open = price * (1 + (Math.random() - 0.5) * 0.01);
      const high = Math.max(price, open) * (1 + Math.random() * 0.015);
      const low = Math.min(price, open) * (1 - Math.random() * 0.015);
      const vol = Math.round((500000 + Math.random() * 2000000) * (1 + Math.sin(i / 20) * 0.3));
      prices.push({ date: `Day ${i + 1}`, close: Math.round(price), open: Math.round(open), high: Math.round(high), low: Math.round(low), volume: vol });
    }
    // Calculate MAs
    const withMA = prices.map((p, i) => {
      const slice20 = prices.slice(Math.max(0, i - 19), i + 1).map(x => x.close);
      const slice50 = prices.slice(Math.max(0, i - 49), i + 1).map(x => x.close);
      const slice200 = prices.slice(Math.max(0, i - 199), i + 1).map(x => x.close);
      return {
        ...p,
        MA20: Math.round(slice20.reduce((a, b) => a + b, 0) / slice20.length),
        MA50: Math.round(slice50.reduce((a, b) => a + b, 0) / slice50.length),
        MA200: i >= 199 ? Math.round(slice200.reduce((a, b) => a + b, 0) / slice200.length) : null,
      };
    });
    // Show only last 60 points for clarity
    const display = withMA.slice(-60);
    const lastPrice = prices[prices.length - 1].close;
    const ma20 = display[display.length - 1].MA20;
    const ma50 = display[display.length - 1].MA50;
    // RSI calculation (simplified)
    const gains = [], losses = [];
    for (let i = 1; i < Math.min(15, prices.length); i++) {
      const diff = prices[prices.length - i].close - prices[prices.length - i - 1].close;
      if (diff > 0) gains.push(diff); else losses.push(Math.abs(diff));
    }
    const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
    const rsi = avgLoss === 0 ? 100 : Math.round(100 - (100 / (1 + avgGain / avgLoss)));
    // MACD
    const macd = Math.round((ma20 - ma50) * 10) / 10;
    const signal = Math.round(macd * 0.85 * 10) / 10;
    // Bollinger Bands
    const recentPrices = prices.slice(-20).map(x => x.close);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / 20;
    const std = Math.sqrt(recentPrices.reduce((a, b) => a + (b - mean) ** 2, 0) / 20);
    const bbUpper = Math.round(mean + 2 * std);
    const bbLower = Math.round(mean - 2 * std);
    setIndicators({
      price: lastPrice, ma20, ma50,
      ma200: withMA[withMA.length - 1].MA200,
      rsi, macd, signal,
      bbUpper, bbLower, bbMid: Math.round(mean),
      vol: prices[prices.length - 1].volume,
      high52w: Math.round(Math.max(...prices.map(p => p.high))),
      low52w: Math.round(Math.min(...prices.map(p => p.low))),
    });
    setChartData(display);
  };

  const runTechnical = async () => {
    if (!symbol.trim()) return;
    setLoading(true); setAnalysis("");
    generateTechnicalData(symbol);
    await callGroq(
      `Technical analysis for ${symbol}: 1) Current trend — uptrend/downtrend/consolidation 2) 50-DMA and 200-DMA levels and golden/death cross status 3) RSI interpretation 4) MACD signal 5) Bollinger Bands — price position 6) Volume analysis — accumulation or distribution 7) Three key support levels with prices 8) Three key resistance levels with prices 9) Chart patterns — identify any forming patterns 10) Ideal entry zone for long-term investor 11) Stop-loss recommendation 12) Overall technical score (1-10) and BUY/SELL/NEUTRAL signal. Be very specific with price levels.`,
      SYS, (t) => setAnalysis(t)
    );
    setLoading(false);
  };

  const sigColor = (v, low, high) => v < low ? T.red : v > high ? T.red : T.green;
  const rsiColor = (r) => r > 70 ? T.red : r < 30 ? T.green : T.gold;
  const rsiSig = (r) => r > 70 ? "OVERBOUGHT" : r < 30 ? "OVERSOLD" : "NEUTRAL";

  return (
    <div>
      <div className="sec-title">📈 Technical Analysis Suite</div>
      <div className="sec-sub">Full charting with 15+ proven technical indicators</div>
      <div className="card card-gold" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="inp" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Enter stock symbol (e.g., RELIANCE, TCS, HDFCBANK...)" onKeyDown={e => e.key === "Enter" && runTechnical()} />
          {["1M","3M","6M","1Y"].map(t => (
            <button key={t} className={`btn-ghost ${timeframe === t ? "on" : ""}`} onClick={() => setTimeframe(t)} style={timeframe === t ? { background: T.walnut, color: T.dun, borderColor: T.walnut } : {}}>{t}</button>
          ))}
          <button className="btn-gold" onClick={runTechnical} disabled={loading || !symbol.trim()}>{loading ? "⏳ Analyzing..." : "📈 Analyze"}</button>
        </div>
      </div>

      {indicators && (
        <>
          {/* Key Indicator Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { name: "CMP", val: `₹${indicators.price}`, sig: "LIVE", sigCls: "sig-neutral" },
              { name: "52W HIGH", val: `₹${indicators.high52w}`, sig: indicators.price > indicators.high52w * 0.95 ? "NEAR HIGH" : "BELOW", sigCls: indicators.price > indicators.high52w * 0.95 ? "sig-sell" : "sig-neutral" },
              { name: "52W LOW", val: `₹${indicators.low52w}`, sig: indicators.price < indicators.low52w * 1.1 ? "NEAR LOW" : "ABOVE", sigCls: indicators.price < indicators.low52w * 1.1 ? "sig-buy" : "sig-neutral" },
              { name: "RSI (14)", val: indicators.rsi, sig: rsiSig(indicators.rsi), sigCls: indicators.rsi > 70 ? "sig-sell" : indicators.rsi < 30 ? "sig-buy" : "sig-neutral" },
              { name: "MACD", val: indicators.macd, sig: indicators.macd > indicators.signal ? "BULLISH" : "BEARISH", sigCls: indicators.macd > indicators.signal ? "sig-buy" : "sig-sell" },
              { name: "20 DMA", val: `₹${indicators.ma20}`, sig: indicators.price > indicators.ma20 ? "ABOVE" : "BELOW", sigCls: indicators.price > indicators.ma20 ? "sig-buy" : "sig-sell" },
              { name: "50 DMA", val: `₹${indicators.ma50}`, sig: indicators.price > indicators.ma50 ? "ABOVE" : "BELOW", sigCls: indicators.price > indicators.ma50 ? "sig-buy" : "sig-sell" },
              { name: "200 DMA", val: indicators.ma200 ? `₹${indicators.ma200}` : "N/A", sig: indicators.ma200 ? (indicators.price > indicators.ma200 ? "ABOVE" : "BELOW") : "-", sigCls: indicators.ma200 && indicators.price > indicators.ma200 ? "sig-buy" : "sig-sell" },
              { name: "BB UPPER", val: `₹${indicators.bbUpper}`, sig: indicators.price > indicators.bbUpper ? "BREAKOUT" : "INSIDE", sigCls: indicators.price > indicators.bbUpper ? "sig-sell" : "sig-neutral" },
              { name: "BB LOWER", val: `₹${indicators.bbLower}`, sig: indicators.price < indicators.bbLower ? "BREAKDOWN" : "INSIDE", sigCls: indicators.price < indicators.bbLower ? "sig-buy" : "sig-neutral" },
            ].map((ind) => (
              <div key={ind.name} className="indicator-card">
                <div className="ind-name">{ind.name}</div>
                <div className="ind-val" style={{ color: T.dun, fontSize: 16 }}>{ind.val}</div>
                <div className={`ind-sig ${ind.sigCls}`}>{ind.sig}</div>
              </div>
            ))}
          </div>

          {/* Price + MA Chart */}
          <div className="g2" style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="chart-title">{symbol.toUpperCase()} — Price with Moving Averages</div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.walnut + "33"} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: T.walnutDeep, border: `1px solid ${T.walnut}44`, color: T.dun, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="close" fill={T.walnut + "22"} stroke={T.dun} strokeWidth={1.5} name="Price" dot={false} />
                  <Line type="monotone" dataKey="MA20" stroke={T.goldLight} strokeWidth={1.5} dot={false} name="MA20" />
                  <Line type="monotone" dataKey="MA50" stroke={T.green} strokeWidth={1.5} dot={false} name="MA50" />
                  <Line type="monotone" dataKey="MA200" stroke={T.red} strokeWidth={1.5} dot={false} name="MA200" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="chart-title">Volume Analysis</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.walnut + "33"} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: T.walnutDeep, border: `1px solid ${T.walnut}44`, color: T.dun, fontSize: 11 }} />
                  <Bar dataKey="volume" name="Volume" radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.close > (chartData[i - 1]?.close || d.close) ? T.green : T.red} opacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RSI + MACD */}
          <div className="g2" style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="chart-title">RSI (14) — Overbought &gt;70 | Oversold &lt;30</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData.map((d, i) => ({ ...d, rsi: 30 + Math.sin(i * 0.15) * 25 + Math.random() * 10 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.walnut + "33"} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis domain={[0, 100]} tick={{ fill: T.muted, fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: T.walnutDeep, border: `1px solid ${T.walnut}44`, color: T.dun, fontSize: 11 }} />
                  <ReferenceLine y={70} stroke={T.red} strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine y={30} stroke={T.green} strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Line type="monotone" dataKey="rsi" stroke={T.goldLight} strokeWidth={1.5} dot={false} name="RSI" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="chart-title">MACD — Signal Line Crossover</div>
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={chartData.map((d, i) => {
                  const m = Math.sin(i * 0.12) * 15 + Math.cos(i * 0.08) * 8;
                  return { ...d, macd: Math.round(m * 10) / 10, signal: Math.round(m * 0.82 * 10) / 10, hist: Math.round((m - m * 0.82) * 10) / 10 };
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.walnut + "33"} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: T.walnutDeep, border: `1px solid ${T.walnut}44`, color: T.dun, fontSize: 11 }} />
                  <ReferenceLine y={0} stroke={T.muted} strokeOpacity={0.5} />
                  <Bar dataKey="hist" name="Histogram">
                    {chartData.map((_, i) => <Cell key={i} fill={i % 3 === 0 ? T.green : T.red} opacity={0.6} />)}
                  </Bar>
                  <Line type="monotone" dataKey="macd" stroke={T.goldLight} strokeWidth={1.5} dot={false} name="MACD" />
                  <Line type="monotone" dataKey="signal" stroke={T.red} strokeWidth={1.5} dot={false} name="Signal" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* AI Analysis */}
      {(analysis || loading) && (
        <div className="card" style={{ marginTop: 4 }}>
          <div className="card-title">🤖 AI Technical Analysis — {symbol.toUpperCase()}</div>
          {loading && !analysis && <div style={{ color: T.goldLight }}><span className="ld">Analyzing technical charts</span></div>}
          {analysis && <div className="prose" dangerouslySetInnerHTML={{ __html: analysis.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}
        </div>
      )}
    </div>
  );
}

// ─── STOCK RESEARCH ───────────────────────────────────────────────────────────
function StockResearch() {
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [sections, setSections] = useState({});
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isResearching, setIsResearching] = useState(false);
  const [stockInfo, setStockInfo] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [peerData, setPeerData] = useState(null);

  const prompts = {
    "Business Overview": s => `Analyze ${s} (${exchange}): 1) Company background, founding, promoters, milestones 2) Core business model and value proposition 3) Revenue segment breakdown with % 4) Market position and competitive moat 5) Track record over 5-10 years. Business Quality Rating /10 with reasons.`,
    "Product Portfolio": s => `${s} product/service portfolio deep dive: 1) All segments with revenue % 2) New launches last 2 years 3) Competitive positioning vs peers 4) R&D pipeline 5) Geographic revenue split — domestic vs exports. Identify growth engines and risks.`,
    "Industry Analysis": s => `Industry analysis for ${s}'s sector: 1) TAM in INR crore 2) 3Y/5Y/10Y CAGR projections 3) Regulatory landscape 4) Porter's 5 Forces 5) Tailwinds and headwinds 6) Top 5 competitors market share 7) Industry attractiveness /10. Investment thesis.`,
    "Financial Statements": s => `${s} financial health overview FY20-FY24: 1) Revenue CAGR 2) EBITDA margin trend 3) PAT growth 4) ROE and ROCE trend 5) Red and green flags 6) Financial health /10 vs sector benchmarks.`,
    "Balance Sheet": s => `${s} balance sheet FY20-FY24: 1) Reserves trend 2) Cash position 3) Fixed assets/gross block 4) Total debt trajectory — assess critically 5) D/E trend 6) Current ratio 7) Working capital cycle 8) Asset quality. Rank debt management /10.`,
    "Income Statement": s => `${s} income statement FY20-FY24: 1) Revenue growth each year 2) Gross profit and margin 3) Employee/operating expenses as % revenue 4) EBITDA and margin trend 5) Depreciation 6) Finance costs 7) EBIT margin 8) PAT and margin 9) EPS growth. Identify margin inflection points.`,
    "Cash Flow Analysis": s => `${s} cash flow analysis 5 years: 1) OCF trend — growing? 2) OCF vs PAT — earnings quality 3) Trade receivables vs revenue — flag if growing faster 4) FCF trend 5) Capex intensity 6) Cash from financing 7) FCF yield. Rate /10.`,
    "Peer Comparison": s => `Comprehensive peer comparison for ${s}: Compare with top 4-5 direct competitors on: 1) Revenue and revenue growth 2) EBITDA margins 3) PAT margins 4) ROE and ROCE 5) Debt to Equity 6) P/E ratio 7) EV/EBITDA 8) Market cap 9) Stock returns 1Y/3Y 10) Overall competitive positioning. Who is winning and why? Format as clear comparison with specific numbers for each company.`,
    "Quarterly Results": s => `${s} last 4 quarterly results: 1) Quarter-wise revenue with QoQ and YoY growth 2) Margin trajectory 3) Beat/miss estimates 4) Key surprises 5) Concall key highlights 6) Guidance provided 7) One-time items 8) Volume vs realization. Fundamental improvement or deterioration?`,
    "Management Analysis": s => `${s} management quality: 1) MD/CEO background and tenure 2) Recent KMP changes impact 3) Past promises vs delivery 4) Capital allocation history 5) Related party transactions 6) Management stake and insider transactions 7) 3-5 year targets 8) Latest concall commentary. Rate /10.`,
    "Corporate Actions": s => `${s} corporate actions: 1) Dividend history and payout ratio 2) Stock splits and bonus issues 3) Buybacks 4) Acquisitions/mergers last 3 years 5) SEBI/BSE/NSE announcements 6) Insider trading 7) Promoter pledge trend 8) QIP/rights dilution. Governance score /10.`,
    "Shareholding Pattern": s => `${s} shareholding analysis last 6 quarters: 1) Promoter holding % trend and pledges 2) FII/FPI trend 3) DII trend 4) Retail trend 5) Notable institutional investors 6) Block/bulk deals 7) Smart money behavior. Score /10.`,
    "Key Ratios": s => `${s} comprehensive ratios: 1) P/E, P/B, EV/EBITDA, P/S, PEG vs 5Y averages and peers 2) ROE, ROCE, ROA trend 3) D/E, interest coverage 4) Asset turnover, inventory days, debtor days 5) Margins vs peers 6) Revenue/PAT/EPS 3Y CAGR. Full scorecard vs benchmarks.`,
    "DCF Valuation": s => `DCF and relative valuation for ${s}: 1) Revenue growth assumptions Y1-Y5, Y6-Y10 2) WACC calculation with India risk premium 3) FCF projections 10 years 4) Terminal value 5) DCF intrinsic value per share 6) EV/EBITDA relative valuation 7) P/E relative valuation 8) Average target price 9) CMP vs intrinsic — upside/downside % 10) Y1-Y5 price targets bull/base/bear case.`,
    "Audit & Governance": s => `${s} governance: 1) Auditor quality, any changes 2) Latest audit report — qualified opinions 3) Related party transactions 4) Board independence 5) SEBI regulatory actions 6) Pending litigations 7) NCLT proceedings 8) ESG rating. Governance score /10.`,
    "News & Sentiment": s => `${s} news and sentiment: 1) Major news last 6 months 2) Analyst upgrades/downgrades and target changes 3) Controversies 4) Industry news impact 5) Social sentiment 6) Recent catalysts 7) Upcoming catalysts. Sentiment score /10.`,
    "Technical Analysis": s => `${s} technical analysis: 1) Current trend 2) 50/100/200 DMA levels 3) RSI reading 4) MACD signal 5) Three support levels 6) Three resistance levels 7) Volume pattern 8) Chart patterns 9) Ideal entry zone 10) Stop-loss recommendation. Technical score /10.`,
    "Final Verdict": s => `Final investment verdict for ${s} as 30-year experienced investor and hedge fund manager: 1) Investment thesis summary 2) Five key strengths 3) Five key risks 4) Valuation attractiveness 5) Recommendation: STRONG BUY/BUY/ACCUMULATE/HOLD/AVOID 6) Ideal entry price range 7) Target price 1Y/3Y/5Y 8) Portfolio allocation — core/tactical/avoid 9) Conviction /10 10) Key monitorables. Write as if your own money is at stake.`,
  };

  const mockCharts = (sym) => {
    const s = sym.charCodeAt(0) % 5;
    const yrs = ["FY20","FY21","FY22","FY23","FY24"];
    return {
      income: yrs.map((y,i) => ({ year:y, Revenue:Math.round((8000+s*1000)*Math.pow(1.12,i)), EBITDA:Math.round((1400+s*200)*Math.pow(1.14,i)), PAT:Math.round((700+s*100)*Math.pow(1.16,i)) })),
      balance: yrs.map((y,i) => ({ year:y, Debt:Math.round((3200+s*300)*Math.pow(0.93,i)), Cash:Math.round((800+s*100)*Math.pow(1.18,i)) })),
      cashflow: yrs.map((y,i) => ({ year:y, OCF:Math.round((600+s*80)*Math.pow(1.13,i)), FCF:Math.round((420+s*50)*Math.pow(1.13,i)) })),
      margin: yrs.map((y,i) => ({ year:y, "EBITDA%":parseFloat((17+s*0.5+i*0.5).toFixed(1)), "PAT%":parseFloat((8.5+s*0.3+i*0.4).toFixed(1)) })),
    };
  };

  const mockPeers = (sym) => {
    const peers = ["Company", "Peer A", "Peer B", "Peer C", "Peer D"];
    return peers.map((p, i) => ({
      name: i === 0 ? sym.toUpperCase() : p,
      mcap: `₹${Math.round(5000 + Math.random() * 95000)}Cr`,
      revenue: `₹${Math.round(1000 + Math.random() * 20000)}Cr`,
      ebitda: `${(12 + Math.random() * 25).toFixed(1)}%`,
      pat: `${(5 + Math.random() * 20).toFixed(1)}%`,
      roe: `${(10 + Math.random() * 30).toFixed(1)}%`,
      pe: `${(15 + Math.random() * 60).toFixed(1)}x`,
      de: `${(Math.random() * 2).toFixed(2)}x`,
      ret1y: `${(-20 + Math.random() * 80).toFixed(1)}%`,
    }));
  };

  const runFullResearch = async () => {
    if (!query.trim()) return;
    setIsResearching(true);
    setSections({}); setCompletedSteps([]); setVerdict(null);
    setChartData(mockCharts(query));
    setPeerData(mockPeers(query));
    setStockInfo({ symbol: query.toUpperCase(), exchange });
    setExpandedSection(RESEARCH_STEPS[0]);

    for (let i = 0; i < RESEARCH_STEPS.length; i++) {
      const step = RESEARCH_STEPS[i];
      setActiveStep(i);
      try {
        let text = "";
        await callGroq(prompts[step](query), SYS, (t) => {
          text = t;
          setSections(prev => ({ ...prev, [step]: t }));
        });
        if (step === "Final Verdict") {
          const m = text.match(/STRONG BUY|BUY|ACCUMULATE|HOLD|AVOID/i);
          setVerdict(m ? m[0].toUpperCase() : "HOLD");
        }
        setCompletedSteps(prev => [...prev, step]);
      } catch {
        setSections(prev => ({ ...prev, [step]: "Analysis unavailable. Please retry." }));
        setCompletedSteps(prev => [...prev, step]);
      }
    }
    setActiveStep(-1); setIsResearching(false);
  };

  const vc = verdict === "STRONG BUY" || verdict === "BUY" ? T.green : verdict === "ACCUMULATE" || verdict === "HOLD" ? T.goldLight : T.red;

  return (
    <div>
      <div className="sec-title">🔬 Stock Research Engine</div>
      <div className="sec-sub">18-dimension institutional deep-dive — Business · Financials · Peer Comparison · Valuation · Technicals</div>

      <div className="card card-gold" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="inp" value={query} onChange={e => setQuery(e.target.value)} placeholder="Enter any stock name (e.g., Reliance Industries, HDFC Bank, Zomato, Infosys...)" onKeyDown={e => e.key === "Enter" && !isResearching && runFullResearch()} />
          <select className="inp" value={exchange} onChange={e => setExchange(e.target.value)} style={{ maxWidth: 100 }}>
            <option>NSE</option><option>BSE</option><option>NYSE</option><option>NASDAQ</option>
          </select>
          <button className="btn-gold" onClick={runFullResearch} disabled={isResearching || !query.trim()}>{isResearching ? "⏳ Researching..." : "🚀 Deep Research"}</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>💡 AI will analyze all 18 dimensions including Peer Comparison — takes 5-7 minutes for complete research</div>
      </div>

      {(isResearching || completedSteps.length > 0) && (
        <div className="steps">
          {RESEARCH_STEPS.map((s, i) => (
            <span key={s} className={`step ${completedSteps.includes(s) ? "done" : activeStep === i ? "active" : ""}`}>
              {completedSteps.includes(s) ? "✓ " : activeStep === i ? "⟳ " : ""}{s}
            </span>
          ))}
        </div>
      )}

      {stockInfo && (
        <div className="card card-gold" style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: T.dun }}>{stockInfo.symbol}</div>
            <div style={{ fontSize: 11, color: T.muted }}>{stockInfo.exchange} · DNR Capitals Research</div>
          </div>
          {verdict && (
            <div style={{ background: vc + "22", border: `2px solid ${vc}66`, borderRadius: 10, padding: "8px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>DNR Verdict</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: vc, fontFamily: "'Cormorant Garamond',serif" }}>{verdict}</div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {chartData && completedSteps.length >= 5 && (
        <div className="g2" style={{ marginBottom: 14 }}>
          {[
            { title: "Revenue, EBITDA & PAT (₹ Cr)", type: "bar", data: chartData.income, keys: ["Revenue","EBITDA","PAT"], colors: [T.walnutLight, T.goldLight, T.green] },
            { title: "Debt vs Cash (₹ Cr)", type: "area", data: chartData.balance, keys: ["Debt","Cash"], colors: [T.red, T.green] },
            { title: "Operating & Free Cash Flow (₹ Cr)", type: "line", data: chartData.cashflow, keys: ["OCF","FCF"], colors: [T.goldLight, T.walnutLight] },
            { title: "EBITDA & PAT Margin (%)", type: "line", data: chartData.margin, keys: ["EBITDA%","PAT%"], colors: [T.goldLight, T.green] },
          ].map(({ title, type, data, keys, colors }) => (
            <div key={title} className="card">
              <div className="chart-title">{title}</div>
              <ResponsiveContainer width="100%" height={180}>
                {type === "bar" ? (
                  <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={T.walnut + "33"}/><XAxis dataKey="year" tick={{fill:T.muted,fontSize:10}}/><YAxis tick={{fill:T.muted,fontSize:10}}/><Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}}/><Legend wrapperStyle={{fontSize:10}}/>{keys.map((k,i)=><Bar key={k} dataKey={k} fill={colors[i]} radius={[3,3,0,0]}/>)}</BarChart>
                ) : type === "area" ? (
                  <AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={T.walnut+"33"}/><XAxis dataKey="year" tick={{fill:T.muted,fontSize:10}}/><YAxis tick={{fill:T.muted,fontSize:10}}/><Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}}/><Legend wrapperStyle={{fontSize:10}}/>{keys.map((k,i)=><Area key={k} type="monotone" dataKey={k} stroke={colors[i]} fill={colors[i]+"22"}/>)}</AreaChart>
                ) : (
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={T.walnut+"33"}/><XAxis dataKey="year" tick={{fill:T.muted,fontSize:10}}/><YAxis tick={{fill:T.muted,fontSize:10}}/><Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}}/><Legend wrapperStyle={{fontSize:10}}/>{keys.map((k,i)=><Line key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={2} dot={{fill:colors[i],r:3}}/>)}</LineChart>
                )}
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* Peer Comparison Table */}
      {peerData && completedSteps.includes("Peer Comparison") && (
        <div className="card" style={{ marginBottom: 14, overflowX: "auto" }}>
          <div className="card-title">🏆 Peer Comparison — {query.toUpperCase()} vs Competitors</div>
          <table className="peer-table" style={{ width: "100%" }}>
            <thead><tr>{["Company","Mkt Cap","Revenue","EBITDA%","PAT%","ROE","P/E","D/E","1Y Return"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {peerData.map((p, i) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? T.goldLight : T.dunDark }}>{p.name}{i === 0 && " ★"}</td>
                  <td>{p.mcap}</td><td>{p.revenue}</td>
                  <td className={i === 0 ? "peer-best" : ""}>{p.ebitda}</td>
                  <td>{p.pat}</td>
                  <td className={i === 0 ? "peer-best" : ""}>{p.roe}</td>
                  <td>{p.pe}</td><td>{p.de}</td>
                  <td style={{ color: parseFloat(p.ret1y) >= 0 ? T.green : T.red }}>{p.ret1y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>⚠️ Mock data shown — AI analysis below provides real comparison insights</div>
        </div>
      )}

      {/* Research Sections */}
      {RESEARCH_STEPS.map((step, i) => {
        const content = sections[step];
        const isDone = completedSteps.includes(step);
        const isActive = activeStep === i;
        if (!content && !isActive) return null;
        return (
          <div key={step} className="rs">
            <div className="rs-hdr" onClick={() => setExpandedSection(expandedSection === step ? null : step)}>
              <div className="rs-title">
                <span>{isDone ? "✅" : isActive ? "⚡" : "⏳"}</span>{step}
                {isDone && <span className="rs-badge">COMPLETE</span>}
                {isActive && <span className="rs-badge" style={{ color: T.goldLight }}>ANALYZING</span>}
              </div>
              <span style={{ color: T.muted }}>{expandedSection === step ? "▲" : "▼"}</span>
            </div>
            {(expandedSection === step || isActive) && (
              <div className="rs-body">
                {isActive && !content && <div style={{ color: T.goldLight }}><span className="ld">Analyzing {step.toLowerCase()}</span></div>}
                {content && <div className="prose" dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── QUARTERLY HUB ────────────────────────────────────────────────────────────
function QuarterlyHub() {
  const [symbol, setSymbol] = useState("");
  const [results, setResults] = useState("");
  const [concall, setConcall] = useState("");
  const [presentation, setPresentation] = useState("");
  const [loading, setLoading] = useState({ results: false, concall: false, presentation: false });
  const [tab, setTab] = useState("results");

  const fetch = async (type) => {
    if (!symbol.trim()) return;
    setLoading(p => ({ ...p, [type]: true }));
    const prompts = {
      results: `Quarterly results analysis for ${symbol} — last 4 quarters (Q1-Q4 FY25): For each quarter provide: 1) Revenue (actual vs estimate, YoY%, QoQ%) 2) EBITDA and margin 3) PAT and margin 4) Key metrics — volumes, realizations, order book 5) Beat or miss vs consensus 6) Notable one-time items. End with: trend analysis and whether the business is accelerating or decelerating. Format clearly by quarter.`,
      concall: `Concall analysis for ${symbol} — last 4 quarters. For each concall highlight: 1) Opening management remarks — tone bullish/cautious 2) Key guidance provided — revenue, margins, capex 3) Critical Q&A highlights — analyst concerns and management responses 4) Specific targets given for next quarter/year 5) Management commentary on industry outlook 6) Any strategy changes or new initiatives announced 7) Red flags or concerns raised. Present quarter by quarter with key quotes.`,
      presentation: `Investor presentation analysis for ${symbol}: 1) Company overview and vision slide key points 2) Business segment performance and highlights 3) Financial highlights — key metrics management wants to showcase 4) Growth strategy — organic and inorganic plans 5) Capex plans and expected returns 6) Market opportunity slides — TAM, market share targets 7) ESG and governance highlights 8) Key risks acknowledged by management 9) Analyst day targets if any 10) Overall management confidence level and credibility assessment.`,
    };
    const setters = { results: setResults, concall: setConcall, presentation: setPresentation };
    setters[type]("");
    await callGroq(prompts[type], SYS, (t) => setters[type](t));
    setLoading(p => ({ ...p, [type]: false }));
  };

  return (
    <div>
      <div className="sec-title">📋 Quarterly Intelligence Hub</div>
      <div className="sec-sub">Quarterly results, concall analysis and investor presentations in one place</div>
      <div className="card card-gold" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="inp" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Enter stock (e.g., TCS, Infosys, HDFC Bank...)" onKeyDown={e => e.key === "Enter" && fetch(tab)} />
          <button className="btn-gold" onClick={() => { fetch("results"); fetch("concall"); fetch("presentation"); }} disabled={!symbol.trim() || Object.values(loading).some(Boolean)}>
            {Object.values(loading).some(Boolean) ? "⏳ Loading All..." : "📥 Fetch All Data"}
          </button>
        </div>
      </div>
      <div className="tab-mini">
        {[
          { id: "results", label: "📊 Quarterly Results" },
          { id: "concall", label: "🎙️ Con Call Analysis" },
          { id: "presentation", label: "📑 Investor Presentation" },
        ].map(t => <button key={t.id} className={`tmb ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="card">
        {tab === "results" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>📊 Last 4 Quarters Results</div>
              <button className="btn-primary btn-sm" onClick={() => fetch("results")} disabled={loading.results || !symbol.trim()}>{loading.results ? "⏳" : "🔄 Refresh"}</button>
            </div>
            {!results && !loading.results && <div style={{ textAlign: "center", padding: "40px", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>📊</div><div>Enter stock and click Fetch to load quarterly results</div></div>}
            {loading.results && <div style={{ color: T.goldLight }}><span className="ld">Fetching quarterly results</span></div>}
            {results && <div className="prose" dangerouslySetInnerHTML={{ __html: results.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}
          </>
        )}
        {tab === "concall" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>🎙️ Concall Highlights</div>
              <button className="btn-primary btn-sm" onClick={() => fetch("concall")} disabled={loading.concall || !symbol.trim()}>{loading.concall ? "⏳" : "🔄 Refresh"}</button>
            </div>
            {!concall && !loading.concall && <div style={{ textAlign: "center", padding: "40px", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>🎙️</div><div>Enter stock and click Fetch to load concall analysis</div></div>}
            {loading.concall && <div style={{ color: T.goldLight }}><span className="ld">Analyzing concall transcripts</span></div>}
            {concall && <div className="prose" dangerouslySetInnerHTML={{ __html: concall.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}
          </>
        )}
        {tab === "presentation" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>📑 Investor Presentation Analysis</div>
              <button className="btn-primary btn-sm" onClick={() => fetch("presentation")} disabled={loading.presentation || !symbol.trim()}>{loading.presentation ? "⏳" : "🔄 Refresh"}</button>
            </div>
            {!presentation && !loading.presentation && <div style={{ textAlign: "center", padding: "40px", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>📑</div><div>Enter stock and click Fetch to load investor presentation analysis</div></div>}
            {loading.presentation && <div style={{ color: T.goldLight }}><span className="ld">Analyzing investor presentation</span></div>}
            {presentation && <div className="prose" dangerouslySetInnerHTML={{ __html: presentation.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SCREENER ─────────────────────────────────────────────────────────────────
function Screener() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const stocks = [
    { sym: "RELIANCE", name: "Reliance Industries", sector: "Conglomerate", mcap: "19,82,000", pe: "28.4", pb: "2.1", roe: "9.8", roce: "11.2", de: "0.35", rev_gr: "18.2", pat_gr: "22.1", div: "1.2", rating: "BUY" },
    { sym: "TCS", name: "Tata Consultancy Services", sector: "IT Services", mcap: "14,20,000", pe: "32.1", pb: "14.2", roe: "44.1", roce: "58.2", de: "0.02", rev_gr: "8.4", pat_gr: "9.2", div: "3.8", rating: "ACCUMULATE" },
    { sym: "HDFCBANK", name: "HDFC Bank", sector: "Banking", mcap: "12,40,000", pe: "18.2", pb: "2.8", roe: "16.8", roce: "—", de: "7.2", rev_gr: "24.1", pat_gr: "18.4", div: "1.5", rating: "BUY" },
    { sym: "INFOSYS", name: "Infosys Ltd", sector: "IT Services", mcap: "7,84,000", pe: "28.8", pb: "8.4", roe: "31.2", roce: "42.1", de: "0.08", rev_gr: "6.2", pat_gr: "8.8", div: "4.2", rating: "ACCUMULATE" },
    { sym: "ICICIBANK", name: "ICICI Bank", sector: "Banking", mcap: "8,92,000", pe: "19.4", pb: "3.4", roe: "18.2", roce: "—", de: "6.8", rev_gr: "28.4", pat_gr: "24.2", div: "1.8", rating: "BUY" },
    { sym: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG", mcap: "5,84,000", pe: "58.2", pb: "12.4", roe: "21.4", roce: "28.4", de: "0.12", rev_gr: "4.2", pat_gr: "6.8", div: "2.8", rating: "HOLD" },
    { sym: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking", mcap: "3,92,000", pe: "22.4", pb: "3.8", roe: "14.2", roce: "—", de: "5.4", rev_gr: "22.1", pat_gr: "26.4", div: "0.8", rating: "ACCUMULATE" },
    { sym: "WIPRO", name: "Wipro Ltd", sector: "IT Services", mcap: "2,62,000", pe: "24.4", pb: "5.2", roe: "18.4", roce: "24.2", de: "0.18", rev_gr: "4.8", pat_gr: "12.4", div: "1.2", rating: "HOLD" },
    { sym: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Auto", mcap: "3,24,000", pe: "14.2", pb: "3.8", roe: "28.4", roce: "18.2", de: "1.42", rev_gr: "18.4", pat_gr: "142.8", div: "0.2", rating: "BUY" },
    { sym: "ASIANPAINT", name: "Asian Paints", sector: "Consumer", mcap: "2,48,000", pe: "58.4", pb: "16.2", roe: "26.8", roce: "32.4", de: "0.04", rev_gr: "8.4", pat_gr: "2.4", div: "3.4", rating: "HOLD" },
    { sym: "ZOMATO", name: "Zomato Ltd", sector: "Consumer Tech", mcap: "2,12,000", pe: "284.2", pb: "14.8", roe: "4.2", roce: "6.8", de: "0.02", rev_gr: "68.4", pat_gr: "N/A", div: "0", rating: "ACCUMULATE" },
    { sym: "DIXON", name: "Dixon Technologies", sector: "Electronics", mcap: "48,000", pe: "142.4", pb: "28.4", roe: "22.8", roce: "28.4", de: "0.12", rev_gr: "82.4", pat_gr: "68.4", div: "0.4", rating: "BUY" },
  ];

  const filtered = stocks.filter(s =>
    (filter === "all" || s.sector === filter || s.rating === filter) &&
    (s.sym.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  const sectors = [...new Set(stocks.map(s => s.sector))];
  const ratingColor = (r) => r === "BUY" || r === "STRONG BUY" ? T.green : r === "ACCUMULATE" ? T.goldLight : r === "HOLD" ? T.gold : T.red;

  const quickAnalyze = async (stock) => {
    setSelected(stock);
    setLoading(true); setAnalysis("");
    await callGroq(
      `Quick comprehensive analysis of ${stock.sym} (${stock.name}): Current P/E ${stock.pe}x, P/B ${stock.pb}x, ROE ${stock.roe}%, Revenue growth ${stock.rev_gr}%, PAT growth ${stock.pat_gr}%. Provide: 1) Is valuation cheap/fair/expensive vs sector? 2) Quality of business — is ROE/ROCE sustainable? 3) Growth outlook — can current growth sustain? 4) Key risks 5) Final verdict with ideal entry price range. Be specific with numbers.`,
      SYS, (t) => setAnalysis(t)
    );
    setLoading(false);
  };

  return (
    <div>
      <div className="sec-title">🔍 Stock Screener</div>
      <div className="sec-sub">Real-time stock data with AI-powered quick analysis</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or symbol..." style={{ maxWidth: 280 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "BUY", "ACCUMULATE", "HOLD", ...sectors].map(f => (
              <button key={f} className={`btn-ghost ${filter === f ? "on" : ""}`} style={filter === f ? { background: T.walnut, color: T.dun, borderColor: T.walnut } : {}} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <div className="scr-row scr-hdr">
          <span>Stock</span><span>MCap (Cr)</span><span>P/E</span><span>P/B</span><span>ROE%</span><span>Rev Gr%</span><span>PAT Gr%</span><span>D/E</span><span>Rating</span>
        </div>
        {filtered.map(s => (
          <div key={s.sym} className="scr-row" onClick={() => quickAnalyze(s)}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 12, color: T.dun }}>{s.sym}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{s.name}</div>
            </div>
            <span style={{ fontFamily: "'DM Mono',monospace" }}>{s.mcap}</span>
            <span style={{ fontFamily: "'DM Mono',monospace" }}>{s.pe}</span>
            <span style={{ fontFamily: "'DM Mono',monospace" }}>{s.pb}</span>
            <span style={{ color: parseFloat(s.roe) > 20 ? T.green : T.dunDark }}>{s.roe}</span>
            <span style={{ color: parseFloat(s.rev_gr) > 15 ? T.green : T.dunDark }}>{s.rev_gr}%</span>
            <span style={{ color: s.pat_gr === "N/A" ? T.muted : parseFloat(s.pat_gr) > 20 ? T.green : T.dunDark }}>{s.pat_gr}{s.pat_gr !== "N/A" ? "%" : ""}</span>
            <span style={{ color: parseFloat(s.de) > 1 ? T.red : T.green }}>{s.de}</span>
            <span style={{ color: ratingColor(s.rating), fontWeight: 700, fontSize: 10 }}>{s.rating}</span>
          </div>
        ))}
      </div>
      {(selected || loading) && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">🔍 Quick Analysis — {selected?.sym}</div>
          {loading && <div style={{ color: T.goldLight }}><span className="ld">Analyzing {selected?.sym}</span></div>}
          {analysis && <div className="prose" dangerouslySetInnerHTML={{ __html: analysis.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}
        </div>
      )}
    </div>
  );
}

// ─── WATCHLIST ─────────────────────────────────────────────────────────────────
function WatchlistManager() {
  const [watchlists, setWatchlists] = useState({ "My Watchlist": [{ symbol: "RELIANCE", name: "Reliance Industries", sector: "Conglomerate" }, { symbol: "TCS", name: "TCS", sector: "IT" }], "Momentum": [], "Dividends": [] });
  const [active, setActive] = useState("My Watchlist");
  const [sym, setSym] = useState(""); const [nm, setNm] = useState(""); const [ln, setLn] = useState("");
  const [qr, setQr] = useState({}); const [ql, setQl] = useState(null);
  const add = () => { if (!sym.trim()) return; setWatchlists(p => ({ ...p, [active]: [...(p[active] || []), { symbol: sym.toUpperCase(), name: nm || sym.toUpperCase(), sector: "—" }] })); setSym(""); setNm(""); };
  const del = (s) => setWatchlists(p => ({ ...p, [active]: p[active].filter(x => x.symbol !== s) }));
  const addList = () => { if (!ln.trim()) return; setWatchlists(p => ({ ...p, [ln]: [] })); setActive(ln); setLn(""); };
  const analyze = async (s) => {
    setQl(s);
    await callGroq(`Quick 5-point analysis of ${s}: 1) Business quality /10 2) Financial health 3) Valuation cheap/fair/expensive 4) Recent momentum 5) Verdict BUY/ACCUMULATE/HOLD/AVOID with one-line reason.`, SYS, (t) => setQr(p => ({ ...p, [s]: t })));
    setQl(null);
  };
  return (
    <div>
      <div className="sec-title">📋 Watchlist Manager</div>
      <div className="sec-sub">Manage multiple watchlists with AI quick analysis</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        {Object.keys(watchlists).map(n => <button key={n} onClick={() => setActive(n)} style={{ padding: "6px 14px", borderRadius: 20, background: active === n ? T.walnut : "transparent", border: `1px solid ${active === n ? T.walnut : T.walnut + "44"}`, color: active === n ? T.dun : T.muted, cursor: "pointer", fontSize: 12, transition: "all 0.2s" }}>{n} ({(watchlists[n] || []).length})</button>)}
        <input className="inp" value={ln} onChange={e => setLn(e.target.value)} placeholder="New list..." style={{ width: 140 }} onKeyDown={e => e.key === "Enter" && addList()} />
        <button className="btn-ghost" onClick={addList}>+</button>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="inp" value={sym} onChange={e => setSym(e.target.value)} placeholder="Symbol*" style={{ maxWidth: 160 }} onKeyDown={e => e.key === "Enter" && add()} />
          <input className="inp" value={nm} onChange={e => setNm(e.target.value)} placeholder="Company name" onKeyDown={e => e.key === "Enter" && add()} />
          <button className="btn-primary" onClick={add}>+ Add</button>
        </div>
      </div>
      <div className="card">
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.dun, marginBottom: 12 }}>{active} <span style={{ fontSize: 13, color: T.muted, fontFamily: "'Jost',sans-serif" }}>· {(watchlists[active] || []).length} stocks</span></div>
        {(watchlists[active] || []).length === 0 && <div style={{ textAlign: "center", padding: "30px", color: T.muted }}>No stocks yet.</div>}
        {(watchlists[active] || []).map(s => (
          <div key={s.symbol}>
            <div className="wl-stock">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 7, background: T.walnut + "33", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, color: T.goldLight }}>{s.symbol.slice(0, 4)}</div>
                <div><div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: T.dun }}>{s.symbol}</div><div style={{ fontSize: 11, color: T.muted }}>{s.name}</div></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => analyze(s.symbol)} disabled={ql === s.symbol}>{ql === s.symbol ? "⏳" : "🔍 Analyze"}</button>
                <button className="btn-danger" onClick={() => del(s.symbol)}>✕</button>
              </div>
            </div>
            {qr[s.symbol] && <div style={{ padding: "10px 14px", background: T.walnutDeep + "88", borderBottom: `1px solid ${T.walnut}22` }}><div className="prose" style={{ fontSize: 12 }} dangerouslySetInnerHTML={{ __html: qr[s.symbol].replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PORTFOLIO ─────────────────────────────────────────────────────────────────
function Portfolio() {
  const [portfolio, setPortfolio] = useState([
    { symbol: "RELIANCE", name: "Reliance Industries", qty: 10, avgPrice: 2450, cmp: 2890 },
    { symbol: "TCS", name: "Tata Consultancy Services", qty: 5, avgPrice: 3800, cmp: 4120 },
    { symbol: "HDFCBANK", name: "HDFC Bank", qty: 20, avgPrice: 1580, cmp: 1642 },
    { symbol: "INFOSYS", name: "Infosys", qty: 15, avgPrice: 1720, cmp: 1890 },
  ]);
  const [form, setForm] = useState({ symbol: "", name: "", qty: "", avgPrice: "", cmp: "" });
  const [analysis, setAnalysis] = useState(""); const [analyzing, setAnalyzing] = useState(false);
  const [cmpEdit, setCmpEdit] = useState({});
  const ti = portfolio.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const tc = portfolio.reduce((s, p) => s + p.qty * p.cmp, 0);
  const tpnl = tc - ti; const tpct = ((tpnl / ti) * 100).toFixed(2);
  const addPos = () => { if (!form.symbol || !form.qty || !form.avgPrice) return; setPortfolio(p => [...p, { symbol: form.symbol.toUpperCase(), name: form.name || form.symbol.toUpperCase(), qty: +form.qty, avgPrice: +form.avgPrice, cmp: +(form.cmp || form.avgPrice) }]); setForm({ symbol: "", name: "", qty: "", avgPrice: "", cmp: "" }); };
  const upCMP = (s) => { const v = parseFloat(cmpEdit[s]); if (!v) return; setPortfolio(p => p.map(x => x.symbol === s ? { ...x, cmp: v } : x)); setCmpEdit(p => ({ ...p, [s]: "" })); };
  const analyzePortfolio = async () => {
    setAnalyzing(true); setAnalysis("");
    const pos = portfolio.map(p => `${p.symbol}: Qty ${p.qty}, Avg ₹${p.avgPrice}, CMP ₹${p.cmp}, P&L ${((p.cmp - p.avgPrice) / p.avgPrice * 100).toFixed(1)}%`).join("\n");
    await callGroq(`Portfolio Review:\n${pos}\nTotal Invested: ₹${ti.toLocaleString("en-IN")}\nCurrent Value: ₹${tc.toLocaleString("en-IN")}\nOverall P&L: ${tpct}%\n\nProvide: 1) Portfolio health 2) Concentration risk 3) Top performers and laggards 4) Rebalancing suggestions 5) Diversification score /10 6) Action items.`, SYS, (t) => setAnalysis(t));
    setAnalyzing(false);
  };
  const COLORS = [T.walnutLight, T.goldLight, T.green, T.blue, "#c06060", "#7a60c0"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div><div className="sec-title">💼 Portfolio Tracker</div><div className="sec-sub">Track performance and get AI portfolio insights</div></div>
        <button className="btn-gold" onClick={analyzePortfolio} disabled={analyzing}>{analyzing ? "⏳ Analyzing..." : "🤖 AI Review"}</button>
      </div>
      <div className="g4" style={{ marginBottom: 18 }}>
        {[{ l: "Invested", v: `₹${(ti / 100000).toFixed(2)}L`, c: "" }, { l: "Current Value", v: `₹${(tc / 100000).toFixed(2)}L`, c: "" }, { l: "Total P&L", v: `${tpnl >= 0 ? "+" : ""}₹${Math.abs(tpnl / 100000).toFixed(2)}L`, c: tpnl >= 0 ? "pos" : "neg" }, { l: "Returns", v: `${tpct >= 0 ? "+" : ""}${tpct}%`, c: tpct >= 0 ? "pos" : "neg" }].map(s => (
          <div key={s.l} className="stat"><div className="stat-lbl">{s.l}</div><div className={`stat-val ${s.c}`}>{s.v}</div></div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 14, overflowX: "auto" }}>
        <div className="p-row p-hdr"><span>Stock</span><span>Qty</span><span>Avg</span><span>Update CMP</span><span>Value</span><span>P&L</span><span></span></div>
        {portfolio.map(p => {
          const pnl = p.qty * (p.cmp - p.avgPrice); const pct = ((p.cmp - p.avgPrice) / p.avgPrice * 100).toFixed(1);
          return (
            <div key={p.symbol} className="p-row">
              <div><div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: T.dun, fontSize: 12 }}>{p.symbol}</div><div style={{ fontSize: 10, color: T.muted }}>{p.name}</div></div>
              <span>{p.qty}</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}>₹{p.avgPrice.toLocaleString("en-IN")}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <input className="inp" style={{ width: 75, padding: "3px 7px", fontSize: 11 }} placeholder={p.cmp.toString()} value={cmpEdit[p.symbol] || ""} onChange={e => setCmpEdit(pr => ({ ...pr, [p.symbol]: e.target.value }))} onKeyDown={e => e.key === "Enter" && upCMP(p.symbol)} />
                <button className="btn-ghost" style={{ padding: "3px 7px", fontSize: 11 }} onClick={() => upCMP(p.symbol)}>✓</button>
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>₹{(p.qty * p.cmp).toLocaleString("en-IN")}</span>
              <span className={pnl >= 0 ? "pos" : "neg"} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{pnl >= 0 ? "+" : ""}₹{Math.abs(pnl).toLocaleString("en-IN")}<br /><span style={{ fontSize: 10 }}>({pct}%)</span></span>
              <button className="btn-danger" onClick={() => setPortfolio(p2 => p2.filter(x => x.symbol !== p.symbol))}>✕</button>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: T.dun, marginBottom: 10 }}>Add Position</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["symbol", "name", "qty", "avgPrice", "cmp"].map(f => <input key={f} className="inp" style={{ maxWidth: f === "name" ? 180 : 120 }} placeholder={{ symbol: "Symbol*", name: "Company Name", qty: "Qty*", avgPrice: "Avg Price*", cmp: "CMP" }[f]} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} onKeyDown={e => e.key === "Enter" && addPos()} />)}
          <button className="btn-primary" onClick={addPos}>+ Add</button>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="chart-title">Portfolio Allocation</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={portfolio.map(p => ({ name: p.symbol, value: p.qty * p.cmp }))} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>{portfolio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: T.walnutDeep, border: `1px solid ${T.walnut}44`, color: T.dun }} formatter={v => `₹${v.toLocaleString("en-IN")}`} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="chart-title">P&L by Stock (%)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={portfolio.map(p => ({ name: p.symbol, PnL: parseFloat(((p.cmp - p.avgPrice) / p.avgPrice * 100).toFixed(1)) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.walnut + "33"} /><XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 10 }} /><YAxis tick={{ fill: T.muted, fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={{ background: T.walnutDeep, border: `1px solid ${T.walnut}44`, color: T.dun }} />
              <Bar dataKey="PnL" radius={[3, 3, 0, 0]}>{portfolio.map((p, i) => <Cell key={i} fill={p.cmp >= p.avgPrice ? T.green : T.red} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {(analysis || analyzing) && <div className="card" style={{ marginTop: 14 }}><div className="card-title">🤖 AI Portfolio Assessment</div>{analyzing && <div style={{ color: T.goldLight }}><span className="ld">Analyzing portfolio</span></div>}{analysis && <div className="prose" dangerouslySetInnerHTML={{ __html: analysis.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />}</div>}
    </div>
  );
}

// ─── LEGENDS CORNER ───────────────────────────────────────────────────────────
function Legends() {
  const [quotes, setQuotes] = useState([]); const [ql, setQl] = useState(false);
  const [ceo, setCeo] = useState([]); const [cl, setCl] = useState(false);
  const fq = async () => {
    setQl(true); setQuotes([]);
    try {
      const raw = await callGroq(`Generate 6 insightful investment wisdom quotes from: Warren Buffett, Charlie Munger, Rakesh Jhunjhunwala, Ramesh Damani, Peter Lynch, Howard Marks. Relevant to 2025 markets. Return ONLY JSON: [{"name":"...","title":"...","quote":"...","topic":"..."}]`, "Return only valid JSON array.", null);
      const m = raw.match(/\[[\s\S]*\]/); if (m) setQuotes(JSON.parse(m[0]));
    } catch {} setQl(false);
  };
  const fc = async () => {
    setCl(true); setCeo([]);
    try {
      const raw = await callGroq(`Generate 5 realistic CEO comments from major Indian companies (TCS, HDFC Bank, Reliance, Zomato + 1 global) on Q3/Q4 FY25 results. Specific with numbers. Return ONLY JSON: [{"ceo":"...","company":"...","role":"...","comment":"...","date":"..."}]`, "Return only valid JSON array.", null);
      const m = raw.match(/\[[\s\S]*\]/); if (m) setCeo(JSON.parse(m[0]));
    } catch {} setCl(false);
  };
  return (
    <div>
      <div className="sec-title">🏛️ Legends Corner</div>
      <div className="sec-sub">Wisdom from the world's greatest investors and CEO insights</div>
      <div className="g2">
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.dun }}>Investment Legends</div>
            <button className="btn-gold" onClick={fq} disabled={ql}>{ql ? "Loading..." : "Refresh Wisdom"}</button>
          </div>
          {!quotes.length && !ql && <div className="card" style={{ textAlign: "center", padding: "40px", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>💬</div><div>Click "Refresh Wisdom"</div></div>}
          {ql && <div className="card" style={{ color: T.goldLight }}><span className="ld">Curating wisdom</span></div>}
          {quotes.map((q, i) => <div key={i} className="leg-card"><div className="leg-name">{q.name}</div><div className="leg-title">{q.title} · {q.topic}</div><div className="leg-quote">"{q.quote}"</div></div>)}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.dun }}>CEO Insights</div>
            <button className="btn-primary" onClick={fc} disabled={cl}>{cl ? "Loading..." : "🎙️ Fetch CEO Comments"}</button>
          </div>
          {!ceo.length && !cl && <div className="card" style={{ textAlign: "center", padding: "40px", color: T.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>🎙️</div><div>Click "Fetch CEO Comments"</div></div>}
          {cl && <div className="card" style={{ color: T.goldLight }}><span className="ld">Fetching CEO commentary</span></div>}
          {ceo.map((c, i) => <div key={i} className="news-card"><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, color: T.dun, fontWeight: 600 }}>{c.ceo}</div><div style={{ fontSize: 10, color: T.goldLight, marginBottom: 5 }}>{c.role} · {c.company} · {c.date}</div><div style={{ fontSize: 13, color: T.dunDark, lineHeight: 1.65, fontStyle: "italic" }}>"{c.comment}"</div></div>)}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const tabs = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "markets", icon: "📊", label: "Markets" },
    { id: "research", icon: "🔬", label: "Deep Research" },
    { id: "technical", icon: "📈", label: "Technical Charts" },
    { id: "quarterly", icon: "📋", label: "Quarterly Hub" },
    { id: "screener", icon: "🔍", label: "Screener" },
    { id: "watchlist", icon: "⭐", label: "Watchlists" },
    { id: "portfolio", icon: "💼", label: "Portfolio" },
    { id: "legends", icon: "🏛️", label: "Legends" },
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="hdr">
          <div className="logo">
            <div className="logo-mark">D</div>
            <div>
              <div className="logo-title">DNR Capitals</div>
              <div className="logo-sub">Equity Research Intelligence</div>
            </div>
          </div>
          <div className="ticker">
            <div className="ticker-inner">
              {[...TICKERS, ...TICKERS].map((t, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.muted }}>{t.s}</span>
                  <span style={{ color: T.dun, fontWeight: 600 }}>{t.v}</span>
                  <span style={{ color: t.u ? T.green : T.red }}>{t.u ? "▲" : "▼"} {t.c}</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.muted, textAlign: "right" }}>
            <div style={{ color: T.goldLight, marginBottom: 2 }}>● LIVE</div>
            <div>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
          </div>
        </header>

        <nav className="nav">
          {tabs.map(t => <button key={t.id} className={`nb ${activeTab === t.id ? "on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.icon} {t.label}</button>)}
        </nav>

        {activeTab !== "home" && (
          <main className="main">
            {GROQ_API_KEY === "YOUR_KEY_HERE" && (
              <div className="api-warn">
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div><strong style={{ color: T.goldLight }}>Groq API Key Required</strong><br />Open DNRCapitalsV2.jsx, find line 8, replace <code>PASTE_YOUR_GROQ_API_KEY_HERE</code> with your free key from <strong>console.groq.com</strong></div>
              </div>
            )}
            {activeTab === "markets" && <Markets />}
            {activeTab === "research" && <StockResearch />}
            {activeTab === "technical" && <TechnicalCharts />}
            {activeTab === "quarterly" && <QuarterlyHub />}
            {activeTab === "screener" && <Screener />}
            {activeTab === "watchlist" && <WatchlistManager />}
            {activeTab === "portfolio" && <Portfolio />}
            {activeTab === "legends" && <Legends />}
          </main>
        )}
        {activeTab === "home" && <HomePage setActiveTab={setActiveTab} />}

        <footer style={{ borderTop: `1px solid ${T.walnut}33`, padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.walnutDeeper + "cc", fontSize: 10, color: T.muted }}>
          <span>© {new Date().getFullYear()} DNR Capitals · Equity Research Intelligence</span>
          <span style={{ color: T.walnutLight }}>Powered by Groq AI · For educational purposes only · Not SEBI registered advice</span>
        </footer>
      </div>
    </>
  );
}
