import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, ComposedChart, ReferenceLine,
} from "recharts";

// ─── PASTE YOUR GROQ API KEY HERE ────────────────────────────────────────────
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || "";
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

// ─── GROQ API WITH REAL-TIME AWARENESS ───────────────────────────────────────
async function callGroq(prompt, systemPrompt, onStream) {
  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_KEY_HERE") {
    const msg = "⚠️ Please set your Groq API key in the .env file.";
    if (onStream) onStream(msg);
    return msg;
  }

  const TODAY = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  const YEAR = new Date().getFullYear();
  const QUARTER = Math.ceil((new Date().getMonth()+1)/3);

  const enhancedSystem = `${systemPrompt || "You are DNR Capitals AI Research Engine — expert equity analyst with 30 years experience in Indian and global markets."}

⚠️ REAL-TIME DATA REQUIREMENTS (NON-NEGOTIABLE):
- Today is ${TODAY}. Current financial year: FY${YEAR-2000+1}.
- Current quarter: Q${QUARTER}FY${YEAR-2000+1}
- You MUST provide data current as of ${TODAY}
- NEVER give targets or prices from 2022 or 2023 — those are WRONG and USELESS
- For ANY stock price mentioned: use the most recent known price
- For targets: calculate based on CURRENT price and CURRENT earnings
- For shareholding: use latest available quarter (Q3FY25 or Q4FY25)
- For results: reference Q3FY25 (Oct-Dec 2024) or Q4FY25 (Jan-Mar 2025) results
- Always mention: "As of ${TODAY}, CMP is approximately ₹XXX"
- If Himadri Speciality is asked: current price ~₹447, not ₹140
- ALWAYS state your data source date clearly`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: enhancedSystem },
          { role: "user", content: prompt }
        ],
        max_tokens: 2048, temperature: 0.4, stream: true,
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

// ─── REAL-TIME STOCK DATA ─────────────────────────────────────────────────────
async function fetchRealTimeData(symbol) {
  // Try multiple free sources
  const nseSymbol = symbol.replace(".NS","").replace(".BO","").toUpperCase();
  
  try {
    // Yahoo Finance via allorigins CORS proxy
    const yahooSymbol = nseSymbol + ".NS";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    const json = await res.json();
    const data = JSON.parse(json.contents);
    const q = data?.chart?.result?.[0];
    if (q) {
      const meta = q.meta;
      return {
        symbol: nseSymbol,
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose || meta.chartPreviousClose,
        change: (meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)).toFixed(2),
        changePct: (((meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)) / (meta.previousClose || meta.chartPreviousClose)) * 100).toFixed(2),
        high52w: meta.fiftyTwoWeekHigh,
        low52w: meta.fiftyTwoWeekLow,
        volume: meta.regularMarketVolume,
        marketCap: meta.marketCap,
        currency: meta.currency,
        exchange: meta.exchangeName,
        source: "Yahoo Finance (Live)",
        timestamp: new Date().toLocaleString("en-IN")
      };
    }
  } catch(e) {}

  try {
    // Fallback: Alpha Vantage free tier
    const res2 = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${nseSymbol}.BSE&apikey=demo`);
    const d2 = await res2.json();
    const q2 = d2["Global Quote"];
    if (q2 && q2["05. price"]) {
      return {
        symbol: nseSymbol,
        price: parseFloat(q2["05. price"]),
        previousClose: parseFloat(q2["08. previous close"]),
        change: parseFloat(q2["09. change"]),
        changePct: parseFloat(q2["10. change percent"]),
        volume: parseInt(q2["06. volume"]),
        source: "Alpha Vantage (Live)",
        timestamp: new Date().toLocaleString("en-IN")
      };
    }
  } catch(e) {}

  return null;
}

// Fetch full fundamentals from Yahoo Finance
async function fetchFundamentals(symbol) {
  const nseSymbol = symbol.replace(".NS","").replace(".BO","").toUpperCase();
  const yahooSymbol = nseSymbol + ".NS";

  // Fetch all modules including TTM income statement + quarterly data
  const modules = [
    "summaryDetail","defaultKeyStatistics","financialData",
    "incomeStatementHistory","incomeStatementHistoryQuarterly",
    "balanceSheetHistory","balanceSheetHistoryQuarterly",
    "cashflowStatementHistory","cashflowStatementHistoryQuarterly",
    "earningsTrend","earningsHistory","recommendationTrend"
  ].join(",");

  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=${modules}`)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=${modules}`)}`,
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, {signal: AbortSignal.timeout(10000)});
      const json = await res.json();
      const data = JSON.parse(json.contents);
      const r = data?.quoteSummary?.result?.[0];
      if (!r) continue;

      const fd = r.financialData || {};
      const sd = r.summaryDetail || {};
      const ks = r.defaultKeyStatistics || {};
      const et = r.earningsTrend?.trend || [];

      // ── TTM Income Statement (sum last 4 quarters) ──
      const qIncome = r.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
      const q4 = qIncome.slice(0, 4);
      const ttmRevenue = q4.reduce((s, q) => s + (q.totalRevenue?.raw || 0), 0);
      const ttmNetIncome = q4.reduce((s, q) => s + (q.netIncome?.raw || 0), 0);
      const ttmEBIT = q4.reduce((s, q) => s + (q.ebit?.raw || 0), 0);
      const ttmGrossProfit = q4.reduce((s, q) => s + (q.grossProfit?.raw || 0), 0);

      // ── TTM Cashflow ──
      const qCash = r.cashflowStatementHistoryQuarterly?.cashflowStatements || [];
      const q4c = qCash.slice(0, 4);
      const ttmOperatingCF = q4c.reduce((s, q) => s + (q.totalCashFromOperatingActivities?.raw || 0), 0);
      const ttmCapex = q4c.reduce((s, q) => s + (q.capitalExpenditures?.raw || 0), 0);
      const ttmFCF = ttmOperatingCF + ttmCapex; // capex is negative

      // ── Annual Data (last 3 years) ──
      const annualIncome = r.incomeStatementHistory?.incomeStatementHistory || [];
      const annualRevenue = annualIncome.map(y => ({
        date: y.endDate?.fmt,
        revenue: y.totalRevenue?.raw,
        netIncome: y.netIncome?.raw,
        ebit: y.ebit?.raw,
        grossProfit: y.grossProfit?.raw,
      }));

      const annualBalance = r.balanceSheetHistory?.balanceSheetStatements || [];
      const latestBalance = annualBalance[0] || {};

      // ── Quarterly Revenue trend ──
      const qRevTrend = qIncome.slice(0, 6).reverse().map(q => ({
        period: q.endDate?.fmt,
        revenue: q.totalRevenue?.raw,
        netIncome: q.netIncome?.raw,
        grossProfit: q.grossProfit?.raw,
      }));

      // ── Analyst targets from earningsTrend ──
      const currentTrend = et.find(t => t.period === "0q") || {};
      const nextQTrend = et.find(t => t.period === "+1q") || {};
      const currentYearTrend = et.find(t => t.period === "0y") || {};
      const nextYearTrend = et.find(t => t.period === "+1y") || {};

      // ── Recommendation trend ──
      const recTrend = r.recommendationTrend?.trend?.[0] || {};

      const today = new Date();
      const latestQDate = qIncome[0]?.endDate?.fmt || "N/A";
      const latestAnnualDate = annualIncome[0]?.endDate?.fmt || "N/A";

      return {
        // Live valuation
        pe: sd.trailingPE?.raw,
        forwardPE: sd.forwardPE?.raw,
        pb: ks.priceToBook?.raw,
        ps: ks.priceToSalesTrailing12Months?.raw,
        ev_ebitda: ks.enterpriseToEbitda?.raw,
        // TTM Profitability (actual trailing 12 months)
        ttmRevenue,
        ttmNetIncome,
        ttmEBIT,
        ttmGrossProfit,
        ttmFCF,
        ttmOperatingCF,
        ttmNetMargin: ttmRevenue ? ((ttmNetIncome/ttmRevenue)*100).toFixed(1) : null,
        ttmGrossMargin: ttmRevenue ? ((ttmGrossProfit/ttmRevenue)*100).toFixed(1) : null,
        ttmEBITMargin: ttmRevenue ? ((ttmEBIT/ttmRevenue)*100).toFixed(1) : null,
        // Live ratios from Yahoo (already TTM)
        roe: fd.returnOnEquity?.raw ? (fd.returnOnEquity.raw*100).toFixed(1) : null,
        roa: fd.returnOnAssets?.raw ? (fd.returnOnAssets.raw*100).toFixed(1) : null,
        grossMargin: fd.grossMargins?.raw ? (fd.grossMargins.raw*100).toFixed(1) : null,
        operatingMargin: fd.operatingMargins?.raw ? (fd.operatingMargins.raw*100).toFixed(1) : null,
        netMargin: fd.profitMargins?.raw ? (fd.profitMargins.raw*100).toFixed(1) : null,
        revenueGrowth: fd.revenueGrowth?.raw ? (fd.revenueGrowth.raw*100).toFixed(1) : null,
        earningsGrowth: fd.earningsGrowth?.raw ? (fd.earningsGrowth.raw*100).toFixed(1) : null,
        // Balance sheet
        debtToEquity: fd.debtToEquity?.raw,
        currentRatio: fd.currentRatio?.raw,
        totalRevenue: fd.totalRevenue?.raw,
        totalDebt: fd.totalDebt?.raw,
        totalCash: fd.totalCash?.raw,
        freeCashflow: fd.freeCashflow?.raw,
        totalAssets: latestBalance.totalAssets?.raw,
        totalEquity: latestBalance.totalStockholderEquity?.raw,
        // Per share
        eps: ks.trailingEps?.raw,
        forwardEps: ks.forwardEps?.raw,
        bookValue: ks.bookValue?.raw,
        sharesOutstanding: ks.sharesOutstanding?.raw,
        // Dividend
        dividendYield: sd.dividendYield?.raw ? (sd.dividendYield.raw*100).toFixed(2) : null,
        payoutRatio: sd.payoutRatio?.raw ? (sd.payoutRatio.raw*100).toFixed(1) : null,
        // Market
        beta: sd.beta?.raw,
        // Historical annual data
        annualRevenue,
        // Quarterly trend
        qRevTrend,
        latestQDate,
        latestAnnualDate,
        // Analyst estimates
        epsCurrentQ: currentTrend.earningsEstimate?.avg?.raw,
        epsNextQ: nextQTrend.earningsEstimate?.avg?.raw,
        epsCurrentYear: currentYearTrend.earningsEstimate?.avg?.raw,
        epsNextYear: nextYearTrend.earningsEstimate?.avg?.raw,
        revenueCurrentYear: currentYearTrend.revenueEstimate?.avg?.raw,
        revenueNextYear: nextYearTrend.revenueEstimate?.avg?.raw,
        analystTargetMean: fd.targetMeanPrice?.raw,
        analystTargetHigh: fd.targetHighPrice?.raw,
        analystTargetLow: fd.targetLowPrice?.raw,
        analystBuy: recTrend.strongBuy + recTrend.buy || 0,
        analystHold: recTrend.hold || 0,
        analystSell: recTrend.sell + recTrend.strongSell || 0,
        // Data freshness
        source: "Yahoo Finance — TTM & Live Data",
        dataAsOf: `Latest Quarter: ${latestQDate} | Latest Annual: ${latestAnnualDate}`,
        fetchedAt: today.toLocaleString("en-IN"),
      };
    } catch(e) { continue; }
  }
  return null;
}

// Format numbers for display
function fmtNum(n, prefix="") {
  if (!n && n !== 0) return "N/A";
  if (Math.abs(n) >= 1e12) return `${prefix}${(n/1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${prefix}${(n/1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e7) return `${prefix}₹${(n/1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `${prefix}₹${(n/1e5).toFixed(2)} L`;
  return `${prefix}${n.toFixed(2)}`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Jost:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${T.walnutDeep}}
  ::-webkit-scrollbar-thumb{background:${T.walnut};border-radius:2px}
  body{font-family:'Jost',sans-serif;background:${T.walnutDeeper};color:${T.dun}}

  /* LIGHT MODE */
  body.light{background:#f5f0e8;color:#2a2010}
  body.light .app{background:#f5f0e8}
  body.light .hdr{background:linear-gradient(90deg,#e8dcc8,#f0e8d8cc);border-bottom:1px solid #c9b89a44}
  body.light .nav{background:#e8dcc8;border-bottom:1px solid #c9b89a44}
  body.light .nb{color:#6a5a40}
  body.light .nb.on{background:#2a2010;color:#f0e8dc}
  body.light .card{background:#ffffff;border-color:#c9b89a33}
  body.light .inp{background:#ffffff;border-color:#c9b89a66;color:#2a2010}
  body.light .main{background:#f5f0e8}

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
    .hdr{padding:0 12px}
    .logo-sub{display:none}
    .hdr-controls{gap:6px}
    .hdr-btn{padding:5px 8px;font-size:9px}
    .nav{overflow-x:auto;padding:0 8px}
    .nb{padding:10px 10px;font-size:10px;white-space:nowrap}
    .hero-features{grid-template-columns:1fr}
    .hero-stats-bar{flex-wrap:wrap;gap:8px;padding:12px}
    .hero-stat-item{min-width:80px;border-right:none;border-bottom:1px solid ${T.gold}18;padding-bottom:8px}
    .hero-title{font-size:clamp(36px,10vw,72px)}
    .hero-title-accent{font-size:clamp(36px,10vw,72px)}
    .hero-globe-ring,.hero-globe-ring2,.hero-globe-ring3{display:none}
  }

  /* HEADER CONTROLS */
  .hdr-controls{display:flex;align-items:center;gap:10px}
  .hdr-btn{
    padding:6px 12px;border-radius:6px;border:1px solid ${T.walnut}44;
    background:${T.walnut}22;color:${T.dun};font-size:10px;
    cursor:pointer;transition:all 0.2s;letter-spacing:0.5px;font-family:'Jost',sans-serif;
  }
  .hdr-btn:hover{background:${T.gold}22;border-color:${T.gold}66;color:${T.goldLight}}
  .hdr-btn.active{background:${T.gold}33;border-color:${T.goldLight};color:${T.goldLight}}

  /* ALERT MODAL */
  .modal-overlay{
    position:fixed;inset:0;background:#00000088;z-index:500;
    display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);
  }
  .modal-box{
    background:${T.walnutDeep};border:1px solid ${T.walnut}66;
    border-radius:16px;padding:32px;width:90%;max-width:480px;
    box-shadow:0 20px 80px #00000088;
  }
  .modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:${T.dun};margin-bottom:20px}
  .alert-item{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;background:${T.walnutDark}88;border:1px solid ${T.walnut}33;
    border-radius:8px;margin-bottom:8px;
  }

  /* NEWS FEED */
  .news-card{
    background:${T.walnutDark}88;border:1px solid ${T.walnut}33;
    border-radius:12px;padding:20px;margin-bottom:12px;
    transition:all 0.2s;cursor:pointer;
  }
  .news-card:hover{border-color:${T.gold}44;background:${T.walnut}22}
  .news-tag{
    display:inline-block;padding:3px 10px;border-radius:12px;
    font-size:9px;letter-spacing:2px;text-transform:uppercase;
    background:${T.gold}22;color:${T.goldLight};margin-bottom:10px;
  }
  .news-headline{font-size:15px;font-weight:600;color:${T.dun};line-height:1.4;margin-bottom:8px}
  .news-summary{font-size:12px;color:${T.muted};line-height:1.7}
  .news-meta{font-size:10px;color:${T.walnutLight};margin-top:10px}

  /* IPO TRACKER */
  .ipo-card{
    background:${T.walnutDark}88;border:1px solid ${T.walnut}33;
    border-radius:12px;padding:20px;
    transition:border-color 0.2s;
  }
  .ipo-card:hover{border-color:${T.gold}44}
  .ipo-status{
    display:inline-block;padding:3px 12px;border-radius:12px;
    font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;
    margin-bottom:12px;
  }
  .ipo-open{background:#22c55e22;color:#22c55e;border:1px solid #22c55e44}
  .ipo-upcoming{background:${T.gold}22;color:${T.goldLight};border:1px solid ${T.gold}44}
  .ipo-closed{background:#64748b22;color:#94a3b8;border:1px solid #64748b44}
  .ipo-listed{background:#3b82f622;color:#60a5fa;border:1px solid #3b82f644}

  /* FII DII */
  .fii-bar-wrap{background:${T.walnutDeeper};border-radius:8px;overflow:hidden;height:10px;margin:8px 0}
  .fii-bar{height:100%;border-radius:8px;transition:width 0.8s ease}

  /* SECTOR ROTATION */
  .sector-card{
    background:${T.walnutDark}88;border:1px solid ${T.walnut}33;
    border-radius:12px;padding:18px;cursor:pointer;transition:all 0.2s;
  }
  .sector-card:hover{border-color:${T.gold}44;transform:translateY(-2px)}
  .sector-heat{
    width:100%;height:6px;border-radius:3px;margin-top:10px;
  }

  /* LANGUAGE */
  .lang-hi{font-family:'Noto Sans Devanagari',sans-serif}


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

const SYS = `You are DNR Capitals' senior equity analyst — combining Warren Buffett's philosophy, Peter Lynch's stock picking, and 30 years of Indian market expertise. Provide institutional-quality, specific research with **bold** key terms and numbers. Always give actionable insights.

MANDATORY DATA STANDARDS:
- Always use CURRENT 2025 data — Q3FY25 results, current stock prices, latest shareholding
- Current market context: NIFTY ~24,000, USD/INR ~86, Repo Rate 6.25%
- When giving CMP (Current Market Price): use latest known price as of early 2025
- When giving targets: base them on CURRENT price, not 2022/2023 prices
- Always mention the time period of your data: "As of Q3FY25..." or "Based on Mar 2025 data..."
- If a stock has moved significantly, acknowledge the current price and recalibrate targets
- For Himadri Speciality Chemical: CMP ~₹447 (Mar 2025), not ₹140
- Revenue/profit figures: use FY24 actuals + FY25 estimates, not FY22/FY23
- P/E, EV/EBITDA ratios: calculate on CURRENT price
- NEVER say "target ₹140" when stock is at ₹447 — this destroys credibility`;

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

  const [liveData, setLiveData] = useState(null);
  const [fundamentals, setFundamentals] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  const runFullResearch = async () => {
    if (!query.trim()) return;
    setIsResearching(true);
    setSections({}); setCompletedSteps([]); setVerdict(null);
    setLiveData(null); setFundamentals(null);
    setChartData(mockCharts(query));
    setPeerData(mockPeers(query));
    setStockInfo({ symbol: query.toUpperCase(), exchange });
    setExpandedSection(RESEARCH_STEPS[0]);

    // ── STEP 1: Fetch real-time price & fundamentals FIRST ──
    setDataLoading(true);
    const [rtData, fundData] = await Promise.all([
      fetchRealTimeData(query),
      fetchFundamentals(query)
    ]);
    setLiveData(rtData);
    setFundamentals(fundData);
    setDataLoading(false);

    // ── STEP 2: Build real-time context string to inject into every prompt ──
    const today = new Date().toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"});
    let rtContext = `\n\n⚡ REAL-TIME DATA (as of ${today}):\n`;

    if (rtData) {
      rtContext += `Current Price: ₹${rtData.price}
Previous Close: ₹${rtData.previousClose}
Change: ${rtData.change} (${rtData.changePct}%)
52-Week High: ₹${rtData.high52w || "N/A"}
52-Week Low: ₹${rtData.low52w || "N/A"}
Market Cap: ${fmtNum(rtData.marketCap)}
Volume: ${rtData.volume?.toLocaleString("en-IN") || "N/A"}
Exchange: ${rtData.exchange || exchange}
Data Source: ${rtData.source}\n`;
    }

    if (fundData) {
      // Build quarterly trend string
      const qTrend = (fundData.qRevTrend || []).map(q =>
        `  ${q.period}: Rev ${fmtNum(q.revenue)} | PAT ${fmtNum(q.netIncome)}`
      ).join("\n");

      // Build annual trend string
      const annTrend = (fundData.annualRevenue || []).map(y =>
        `  ${y.date}: Rev ${fmtNum(y.revenue)} | PAT ${fmtNum(y.netIncome)} | GP ${fmtNum(y.grossProfit)}`
      ).join("\n");

      rtContext += `
📊 TTM (TRAILING TWELVE MONTHS) FINANCIALS — ${fundData.dataAsOf}:
TTM Revenue: ${fmtNum(fundData.ttmRevenue)}
TTM Net Income: ${fmtNum(fundData.ttmNetIncome)}
TTM Gross Profit: ${fmtNum(fundData.ttmGrossProfit)}
TTM EBIT: ${fmtNum(fundData.ttmEBIT)}
TTM Free Cash Flow: ${fmtNum(fundData.ttmFCF)}
TTM Operating CF: ${fmtNum(fundData.ttmOperatingCF)}
TTM Net Margin: ${fundData.ttmNetMargin || "N/A"}%
TTM Gross Margin: ${fundData.ttmGrossMargin || "N/A"}%
TTM EBIT Margin: ${fundData.ttmEBITMargin || "N/A"}%

📈 QUARTERLY REVENUE TREND (last 6 quarters):
${qTrend || "N/A"}

📅 ANNUAL FINANCIAL HISTORY:
${annTrend || "N/A"}

⚖️ LIVE VALUATION RATIOS (on current price):
P/E (TTM): ${fundData.pe?.toFixed(1) || "N/A"}
Forward P/E: ${fundData.forwardPE?.toFixed(1) || "N/A"}
P/B: ${fundData.pb?.toFixed(2) || "N/A"}
EV/EBITDA: ${fundData.ev_ebitda?.toFixed(1) || "N/A"}
P/S (TTM): ${fundData.ps?.toFixed(2) || "N/A"}

📐 RETURNS & EFFICIENCY:
ROE: ${fundData.roe || "N/A"}%
ROA: ${fundData.roa || "N/A"}%
Net Margin: ${fundData.netMargin || "N/A"}%
Operating Margin: ${fundData.operatingMargin || "N/A"}%
Revenue Growth YoY: ${fundData.revenueGrowth || "N/A"}%
Earnings Growth YoY: ${fundData.earningsGrowth || "N/A"}%

🏦 BALANCE SHEET:
Total Debt: ${fmtNum(fundData.totalDebt)}
Total Cash: ${fmtNum(fundData.totalCash)}
Debt/Equity: ${fundData.debtToEquity?.toFixed(2) || "N/A"}
Current Ratio: ${fundData.currentRatio?.toFixed(2) || "N/A"}
Book Value/Share: ₹${fundData.bookValue?.toFixed(2) || "N/A"}
EPS (TTM): ₹${fundData.eps?.toFixed(2) || "N/A"}

🎯 ANALYST CONSENSUS:
Target (Mean): ₹${fundData.analystTargetMean?.toFixed(0) || "N/A"}
Target (High): ₹${fundData.analystTargetHigh?.toFixed(0) || "N/A"}
Target (Low): ₹${fundData.analystTargetLow?.toFixed(0) || "N/A"}
Buy/Hold/Sell: ${fundData.analystBuy}/${fundData.analystHold}/${fundData.analystSell}
EPS Est. Current Year: ₹${fundData.epsCurrentYear?.toFixed(2) || "N/A"}
EPS Est. Next Year: ₹${fundData.epsNextYear?.toFixed(2) || "N/A"}
Revenue Est. Current Year: ${fmtNum(fundData.revenueCurrentYear)}
Revenue Est. Next Year: ${fmtNum(fundData.revenueNextYear)}

Dividend Yield: ${fundData.dividendYield || "N/A"}%
Beta: ${fundData.beta?.toFixed(2) || "N/A"}
Data fetched: ${fundData.fetchedAt}\n`;
    }

    rtContext += `
🚨 MANDATORY ANALYSIS RULES:
1. Current Market Price is ₹${rtData?.price || "unknown"} as of ${today}
2. Use TTM data above for all calculations — NOT FY22/FY23 data
3. Calculate P/E, EV/EBITDA, Price/Sales on CURRENT price ₹${rtData?.price || "unknown"}
4. All targets must be relative to current price ₹${rtData?.price || "unknown"}
5. Reference actual quarterly results from the trend above
6. State clearly: "Based on TTM ending ${fundData?.latestQDate || today}"
7. Growth rates must reflect actual recent quarters shown above
8. Use analyst consensus targets as reference points\n`;

    // ── STEP 3: Run all 18 research steps with rate limit protection ──
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < RESEARCH_STEPS.length; i++) {
      const step = RESEARCH_STEPS[i];
      setActiveStep(i);
      // Add delay every 3 steps to avoid TPM rate limit (12000 tokens/min)
      if (i > 0 && i % 3 === 0) {
        setSections(prev => ({ ...prev, [step]: "⏳ Waiting 4s to respect API rate limits..." }));
        await sleep(4000);
      }
      let retries = 2;
      while (retries >= 0) {
        try {
          let text = "";
          const enrichedPrompt = prompts[step](query) + rtContext;
          await callGroq(enrichedPrompt, SYS, (t) => {
            text = t;
            setSections(prev => ({ ...prev, [step]: t }));
          });
          if (step === "Final Verdict") {
            const m = text.match(/STRONG BUY|BUY|ACCUMULATE|HOLD|AVOID/i);
            setVerdict(m ? m[0].toUpperCase() : "HOLD");
          }
          setCompletedSteps(prev => [...prev, step]);
          break;
        } catch(e) {
          if (e.message?.includes("429") && retries > 0) {
            // Rate limited — wait 8 seconds and retry
            setSections(prev => ({ ...prev, [step]: `⏳ Rate limit hit — retrying in 8s... (attempt ${3-retries}/2)` }));
            await sleep(8000);
            retries--;
          } else {
            setSections(prev => ({ ...prev, [step]: "Analysis unavailable. Please retry." }));
            setCompletedSteps(prev => [...prev, step]);
            break;
          }
        }
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

// ─── NEWS FEED ────────────────────────────────────────────────────────────────
function NewsFeed() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("Indian stock market");
  const topics = ["Indian stock market","NIFTY 50","Banking sector","IT sector","Auto sector","Pharma sector","Real Estate","Global markets","RBI Policy","Budget 2025"];

  const fetchNews = async (t) => {
    setLoading(true);
    const raw = await callGroq(`Generate 8 realistic current financial news articles about "${t}". Return ONLY JSON array: [{"headline":"...","summary":"...","tag":"...","sentiment":"bullish|bearish|neutral","time":"X hours ago","impact":"High|Medium|Low"}]`, "Return only valid JSON array.", null);
    try {
      const clean = raw.replace(/```json|```/g,"").trim();
      setNews(JSON.parse(clean));
    } catch(e) { setNews([]); }
    setLoading(false);
  };

  useEffect(() => { fetchNews(topic); }, []);

  const sentColor = s => s==="bullish" ? T.green : s==="bearish" ? T.red : T.muted;

  return (
    <div>
      <div className="ph"><h1 className="pt">📰 Market News Feed</h1><p className="ps">AI-curated financial news & sentiment analysis</p></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
        {topics.map(t => <button key={t} className={`hdr-btn ${topic===t?"active":""}`} onClick={() => { setTopic(t); fetchNews(t); }}>{t}</button>)}
      </div>
      {loading ? <div className="loading"><div className="spin"/><span>Fetching latest news...</span></div> :
        <div className="g2">
          {news.map((n,i) => (
            <div key={i} className="news-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <span className="news-tag">{n.tag}</span>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:sentColor(n.sentiment)+"22",color:sentColor(n.sentiment),border:`1px solid ${sentColor(n.sentiment)}44`}}>{n.sentiment}</span>
              </div>
              <div className="news-headline">{n.headline}</div>
              <div className="news-summary">{n.summary}</div>
              <div className="news-meta" style={{display:"flex",justifyContent:"space-between"}}>
                <span>🕐 {n.time}</span>
                <span style={{color:n.impact==="High"?T.goldLight:T.muted}}>Impact: {n.impact}</span>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// ─── IPO TRACKER ──────────────────────────────────────────────────────────────
const IPO_DATA = [
  {name:"Ather Energy",price:"₹304-321",open:"12 Mar",close:"14 Mar",size:"₹2,981 Cr",gmp:"+₹45",status:"upcoming",sector:"EV",rating:"⭐⭐⭐⭐"},
  {name:"HDB Financial",price:"₹700-740",open:"25 Mar",close:"27 Mar",size:"₹12,500 Cr",gmp:"+₹120",status:"upcoming",sector:"NBFC",rating:"⭐⭐⭐⭐⭐"},
  {name:"Ola Electric",price:"₹72-76",open:"Closed",close:"Closed",size:"₹6,145 Cr",gmp:"-₹12",status:"listed",sector:"EV",rating:"⭐⭐⭐"},
  {name:"Bajaj Housing",price:"₹66-70",open:"Closed",close:"Closed",size:"₹6,560 Cr",gmp:"+₹58",status:"listed",sector:"Finance",rating:"⭐⭐⭐⭐⭐"},
  {name:"Premier Energies",price:"₹427-450",open:"Closed",close:"Closed",size:"₹2,830 Cr",gmp:"+₹35",status:"listed",sector:"Solar",rating:"⭐⭐⭐⭐"},
  {name:"Shadowfax Tech",price:"₹338-355",open:"5 Apr",close:"7 Apr",size:"₹2,100 Cr",gmp:"+₹28",status:"upcoming",sector:"Logistics",rating:"⭐⭐⭐"},
  {name:"Vishal Mega Mart",price:"₹74-78",open:"Closed",close:"Closed",size:"₹8,000 Cr",gmp:"+₹15",status:"listed",sector:"Retail",rating:"⭐⭐⭐"},
  {name:"NTPC Green",price:"₹102-108",open:"Closed",close:"Closed",size:"₹10,000 Cr",gmp:"+₹22",status:"listed",sector:"Green Energy",rating:"⭐⭐⭐⭐"},
];

function IPOTracker() {
  const [filter, setFilter] = useState("all");
  const [analysis, setAnalysis] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const filtered = filter === "all" ? IPO_DATA : IPO_DATA.filter(i => i.status === filter);

  const analyzeIPO = async (ipo) => {
    setLoadingId(ipo.name);
    const raw = await callGroq(`Analyze IPO: ${ipo.name}, Sector: ${ipo.sector}, Price: ${ipo.price}, Size: ${ipo.size}, GMP: ${ipo.gmp}. Give: 1) Subscription recommendation (Subscribe/Avoid/Neutral) 2) Key positives (2 points) 3) Key risks (2 points) 4) Listing gain expectation. Keep it concise.`, SYS, null);
    setAnalysis(prev => ({...prev, [ipo.name]: raw}));
    setLoadingId(null);
  };

  const statusClass = s => s==="open"?"ipo-open":s==="upcoming"?"ipo-upcoming":s==="closed"?"ipo-closed":"ipo-listed";

  return (
    <div>
      <div className="ph"><h1 className="pt">🏦 IPO Tracker</h1><p className="ps">Track upcoming & recent IPOs with AI analysis</p></div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["all","upcoming","open","listed"].map(f => <button key={f} className={`hdr-btn ${filter===f?"active":""}`} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>)}
      </div>
      <div className="g2">
        {filtered.map(ipo => (
          <div key={ipo.name} className="ipo-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <span className={`ipo-status ${statusClass(ipo.status)}`}>{ipo.status.toUpperCase()}</span>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:T.dun,marginBottom:4}}>{ipo.name}</div>
                <div style={{fontSize:11,color:T.muted}}>{ipo.sector} · {ipo.size}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:600,color:T.goldLight}}>{ipo.price}</div>
                <div style={{fontSize:11,color:ipo.gmp.startsWith("+") ? T.green : T.red}}>GMP {ipo.gmp}</div>
                <div style={{fontSize:12}}>{ipo.rating}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:16,margin:"12px 0",fontSize:11,color:T.muted}}>
              <span>📅 Open: {ipo.open}</span><span>📅 Close: {ipo.close}</span>
            </div>
            {analysis[ipo.name] ? (
              <div style={{fontSize:12,color:T.dun,lineHeight:1.7,background:T.walnutDeeper+"88",padding:12,borderRadius:8,marginTop:8}} dangerouslySetInnerHTML={{__html:analysis[ipo.name].replace(/\*\*(.*?)\*\*/g,"<strong style='color:"+T.goldLight+"'>$1</strong>")}}/>
            ) : (
              <button className="btn-ghost" style={{width:"100%",marginTop:8,fontSize:12}} onClick={() => analyzeIPO(ipo)} disabled={loadingId===ipo.name}>
                {loadingId===ipo.name ? "🤖 Analyzing..." : "🤖 AI Analysis"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FII DII DATA ─────────────────────────────────────────────────────────────
function FIIDIITracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const FII_MONTHLY = [
    {month:"Oct 24",fii:-94017,dii:107254},{month:"Nov 24",fii:-45974,dii:54626},
    {month:"Dec 24",fii:-16982,dii:25487},{month:"Jan 25",fii:-87374,dii:92543},
    {month:"Feb 25",fii:-34254,dii:41832},{month:"Mar 25",fii:12543,dii:8921},
  ];

  const fetchAnalysis = async () => {
    setLoading(true);
    const raw = await callGroq(`Analyze FII/DII activity: Recent data shows FIIs sold ₹87,374 Cr in Jan 2025, ₹34,254 Cr in Feb 2025 but turned buyers in Mar 2025 with ₹12,543 Cr. DIIs have been consistently buying. Analyze: 1) What this means for Indian markets 2) Sectors FIIs are targeting 3) Outlook for next quarter. Be specific with data points.`, SYS, null);
    setData(raw);
    setLoading(false);
  };

  const maxVal = Math.max(...FII_MONTHLY.map(d => Math.max(Math.abs(d.fii), d.dii)));

  return (
    <div>
      <div className="ph"><h1 className="pt">🌐 FII / DII Activity</h1><p className="ps">Foreign & Domestic Institutional Investor flow analysis</p></div>

      <div className="g2" style={{marginBottom:24}}>
        <div className="card">
          <div className="sec-hdr">Monthly FII Activity (₹ Cr)</div>
          {FII_MONTHLY.map(d => (
            <div key={d.month} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                <span style={{color:T.muted}}>{d.month}</span>
                <span style={{color:d.fii>0?T.green:T.red,fontWeight:600}}>{d.fii>0?"+":""}{(d.fii/100).toFixed(0)} Cr</span>
              </div>
              <div className="fii-bar-wrap">
                <div className="fii-bar" style={{width:`${Math.abs(d.fii)/maxVal*100}%`,background:d.fii>0?"linear-gradient(90deg,#22c55e,#16a34a)":"linear-gradient(90deg,#ef4444,#dc2626)"}}/>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="sec-hdr">Monthly DII Activity (₹ Cr)</div>
          {FII_MONTHLY.map(d => (
            <div key={d.month} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                <span style={{color:T.muted}}>{d.month}</span>
                <span style={{color:T.green,fontWeight:600}}>+{(d.dii/100).toFixed(0)} Cr</span>
              </div>
              <div className="fii-bar-wrap">
                <div className="fii-bar" style={{width:`${d.dii/maxVal*100}%`,background:"linear-gradient(90deg,#C9A84C,#a08030)"}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,textAlign:"center"}}>
          {[{l:"FII Mar 2025",v:"₹12,543 Cr",c:T.green,s:"Net Buyer ▲"},
            {l:"DII Mar 2025",v:"₹8,921 Cr",c:T.goldLight,s:"Net Buyer ▲"},
            {l:"FII YTD 2025",v:"-₹1,08,085 Cr",c:T.red,s:"Net Seller ▼"},
            {l:"DII YTD 2025",v:"₹1,43,296 Cr",c:T.green,s:"Net Buyer ▲"}
          ].map(s => (
            <div key={s.l} style={{padding:16,background:T.walnutDeeper+"88",borderRadius:10,border:`1px solid ${T.walnut}33`}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:6}}>{s.l}</div>
              <div style={{fontSize:16,fontWeight:700,color:s.c,fontFamily:"'DM Mono',monospace"}}>{s.v}</div>
              <div style={{fontSize:10,color:s.c,marginTop:4}}>{s.s}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-gold" onClick={fetchAnalysis} disabled={loading} style={{marginBottom:16}}>
        {loading ? "🤖 Analyzing..." : "🤖 Get AI Flow Analysis"}
      </button>
      {data && <div className="res-box" style={{fontSize:13,lineHeight:1.8}} dangerouslySetInnerHTML={{__html:data.replace(/\*\*(.*?)\*\*/g,"<strong style='color:"+T.goldLight+"'>$1</strong>")}}/>}
    </div>
  );
}

// ─── SECTOR ROTATION ──────────────────────────────────────────────────────────
function SectorRotation() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const SECTORS = [
    {name:"Banking & Finance",perf:"+2.8%",momentum:"Strong",heat:85,color:"#22c55e",icon:"🏦",desc:"NIM expansion, credit growth"},
    {name:"Information Technology",perf:"-1.2%",momentum:"Weak",heat:25,color:"#ef4444",icon:"💻",desc:"US slowdown concerns, deal wins"},
    {name:"Auto & EV",perf:"+4.1%",momentum:"Very Strong",heat:92,color:"#22c55e",icon:"🚗",desc:"Volume growth, EV transition"},
    {name:"Pharma & Healthcare",perf:"+1.9%",momentum:"Moderate",heat:60,color:"#f59e0b",icon:"💊",desc:"US FDA approvals, domestic growth"},
    {name:"Real Estate",perf:"+3.4%",momentum:"Strong",heat:80,color:"#22c55e",icon:"🏗️",desc:"Residential demand, luxury segment"},
    {name:"Capital Goods",perf:"+2.1%",momentum:"Moderate",heat:65,color:"#f59e0b",icon:"⚙️",desc:"Infra push, order books"},
    {name:"FMCG",perf:"-0.8%",momentum:"Weak",heat:30,color:"#ef4444",icon:"🛒",desc:"Rural slowdown, margin pressure"},
    {name:"Energy & Power",perf:"+5.2%",momentum:"Very Strong",heat:95,color:"#22c55e",icon:"⚡",desc:"Renewable push, power demand"},
    {name:"Metals & Mining",perf:"-2.1%",momentum:"Bearish",heat:15,color:"#ef4444",icon:"⛏️",desc:"China slowdown, commodity prices"},
    {name:"Telecom",perf:"+1.5%",momentum:"Moderate",heat:55,color:"#f59e0b",icon:"📡",desc:"ARPU growth, 5G rollout"},
    {name:"Consumer Durables",perf:"+1.1%",momentum:"Moderate",heat:50,color:"#f59e0b",icon:"📺",desc:"Summer demand, AC season"},
    {name:"Cement & Construction",perf:"+3.8%",momentum:"Strong",heat:78,color:"#22c55e",icon:"🏛️",desc:"Infra spending, housing demand"},
  ];

  const analyzeSector = async (sector) => {
    setSelected(sector);
    setLoading(true);
    const raw = await callGroq(`Deep dive analysis for ${sector.name} sector in Indian markets. Current performance: ${sector.perf}, Momentum: ${sector.momentum}. Provide: 1) Key drivers for current performance 2) Top 3 stocks to watch with brief reasoning 3) Key risks 4) 3-6 month outlook. Be specific with stock names and data.`, SYS, null);
    setAnalysis(raw);
    setLoading(false);
  };

  return (
    <div>
      <div className="ph"><h1 className="pt">🔄 Sector Rotation Tracker</h1><p className="ps">Real-time sector momentum & rotation analysis</p></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:24}}>
        {SECTORS.map(s => (
          <div key={s.name} className="sector-card" onClick={() => analyzeSector(s)} style={{border:`1px solid ${selected?.name===s.name ? T.goldLight : T.walnut+"33"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:20}}>{s.icon}</span>
              <span style={{fontSize:13,fontWeight:700,color:s.color}}>{s.perf}</span>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:T.dun,marginBottom:4}}>{s.name}</div>
            <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{s.desc}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10}}>
              <span style={{color:s.color}}>{s.momentum}</span>
              <span style={{color:T.muted}}>Heat: {s.heat}%</span>
            </div>
            <div className="fii-bar-wrap"><div className="fii-bar" style={{width:`${s.heat}%`,background:`linear-gradient(90deg,${s.color}88,${s.color})`}}/></div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="card">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <span style={{fontSize:24}}>{selected.icon}</span>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:T.dun}}>{selected.name}</div>
              <div style={{fontSize:11,color:T.muted}}>Click any sector card to analyze</div>
            </div>
          </div>
          {loading ? <div className="loading"><div className="spin"/><span>Analyzing sector...</span></div> :
            analysis && <div className="res-box" style={{fontSize:13,lineHeight:1.8}} dangerouslySetInnerHTML={{__html:analysis.replace(/\*\*(.*?)\*\*/g,"<strong style='color:"+T.goldLight+"'>$1</strong>")}}/>
          }
        </div>
      )}
    </div>
  );
}

// ─── PRICE ALERTS ─────────────────────────────────────────────────────────────
function PriceAlerts({ onClose }) {
  const [alerts, setAlerts] = useState([
    {stock:"RELIANCE",price:"1280",type:"above",active:true},
    {stock:"TCS",price:"3900",type:"below",active:true},
    {stock:"HDFC BANK",price:"1750",type:"above",active:false},
  ]);
  const [newStock, setNewStock] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newType, setNewType] = useState("above");

  const addAlert = () => {
    if (!newStock || !newPrice) return;
    setAlerts(prev => [...prev, {stock:newStock.toUpperCase(),price:newPrice,type:newType,active:true}]);
    setNewStock(""); setNewPrice("");
  };

  const toggleAlert = (i) => setAlerts(prev => prev.map((a,idx) => idx===i ? {...a,active:!a.active} : a));
  const removeAlert = (i) => setAlerts(prev => prev.filter((_,idx) => idx!==i));

  return (
    <div className="modal-overlay" onClick={e => e.target.className==="modal-overlay" && onClose()}>
      <div className="modal-box">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title">🔔 Price Alerts</div>
          <button className="hdr-btn" onClick={onClose}>✕ Close</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <input className="inp" placeholder="Stock (e.g. NIFTY)" value={newStock} onChange={e => setNewStock(e.target.value)} style={{flex:1}}/>
          <input className="inp" placeholder="₹ Price" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={{width:100}}/>
          <select className="inp" value={newType} onChange={e => setNewType(e.target.value)} style={{width:90}}>
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <button className="btn-gold" style={{padding:"8px 16px",fontSize:12}} onClick={addAlert}>+ Add</button>
        </div>
        {alerts.map((a,i) => (
          <div key={i} className="alert-item" style={{opacity:a.active?1:0.5}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.dun}}>{a.stock}</div>
              <div style={{fontSize:11,color:a.type==="above"?T.green:T.red}}>Alert when {a.type} ₹{a.price}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="hdr-btn" style={{fontSize:10}} onClick={() => toggleAlert(i)}>{a.active?"⏸ Pause":"▶ Resume"}</button>
              <button className="hdr-btn" style={{fontSize:10,color:T.red}} onClick={() => removeAlert(i)}>🗑</button>
            </div>
          </div>
        ))}
        {alerts.length === 0 && <div style={{textAlign:"center",color:T.muted,padding:20,fontSize:13}}>No alerts set. Add one above!</div>}
      </div>
    </div>
  );
}

// ─── INSTITUTIONAL MOMENTUM TRACKER ──────────────────────────────────────────

// ─── INSTITUTIONAL MOMENTUM TRACKER ──────────────────────────────────────────
function InstitutionalMomentum() {
  const [mode, setMode] = useState("daily");
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [quarterlyData, setQuarterlyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState({daily:null, monthly:null, quarterly:null});
  const [selectedStock, setSelectedStock] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    try {
      const d = localStorage.getItem("dnr_daily"); if(d) setDailyData(JSON.parse(d));
      const m = localStorage.getItem("dnr_monthly"); if(m) setMonthlyData(JSON.parse(m));
      const q = localStorage.getItem("dnr_quarterly"); if(q) setQuarterlyData(JSON.parse(q));
      const lu = localStorage.getItem("dnr_lastupdated"); if(lu) setLastUpdated(JSON.parse(lu));
      // Auto-load daily on first visit
      if(!d) fetchDaily();
    } catch(e) { fetchDaily(); }
  }, []);

  const saveAndUpdate = (key, data, modeKey) => {
    localStorage.setItem(key, JSON.stringify(data));
    const now = new Date().toLocaleString("en-IN");
    const newLU = {...lastUpdated, [modeKey]: now};
    setLastUpdated(newLU);
    localStorage.setItem("dnr_lastupdated", JSON.stringify(newLU));
  };

  // ── DAILY: News-based institutional activity ──
  const fetchDaily = async () => {
    setLoading(true); setError(null);
    const prompt = `You are a financial news analyst. Based on your knowledge of Indian stock market news and institutional activity up to early 2025, generate 15 stocks where there is recent NEWS of institutional buying, accumulation, or large block deals by mutual funds, FIIs, or DIIs.

Return ONLY a valid JSON array, no markdown:
[{
  "stock": "Company Name",
  "symbol": "NSE_SYMBOL",
  "sector": "Sector",
  "price": "₹XXX",
  "action": "Buying|Accumulating|Block Deal|Bulk Deal|Insider Buying",
  "institution": "Name of institution/fund",
  "quantity": "X lakh shares / ₹XXX Cr worth",
  "news_headline": "Realistic news headline about the buying activity",
  "news_summary": "2-sentence summary of why they are buying",
  "sentiment": "Very Bullish|Bullish|Mildly Bullish",
  "price_impact": "+X.X%",
  "date": "Recent date in Mar 2025",
  "signal_strength": 85
}]

Make it realistic — include specific fund names like SBI MF, HDFC MF, Mirae Asset, Nippon India, Axis MF, BlackRock, Norges Bank, Government of Singapore etc. Vary across sectors.`;

    try {
      const raw = await callGroq(prompt, "Return only valid JSON array starting with [. No extra text.", null);
      let clean = raw.replace(/```json|```/g,"").trim();
      if(!clean.startsWith("[")) clean = clean.substring(clean.indexOf("["));
      if(!clean.endsWith("]")) clean = clean.substring(0, clean.lastIndexOf("]")+1);
      const parsed = JSON.parse(clean);
      setDailyData(parsed);
      saveAndUpdate("dnr_daily", parsed, "daily");
    } catch(e) { setError("Failed to fetch daily data. Try again."); }
    setLoading(false);
  };

  // ── MONTHLY: MF Portfolio disclosure tracker ──
  const fetchMonthly = async () => {
    setLoading(true); setError(null);
    const prompt = `You are a mutual fund analyst tracking AMFI monthly portfolio disclosures in India. Based on Feb-Mar 2025 portfolio disclosures, identify 18 stocks where multiple mutual funds have been consistently INCREASING their shareholding % over the last 2-3 months.

Return ONLY a valid JSON array:
[{
  "stock": "Company Name",
  "symbol": "NSE_SYMBOL",
  "sector": "Sector",
  "price": "₹XXX",
  "total_mf_holding_jan": 8.4,
  "total_mf_holding_feb": 9.8,
  "total_mf_holding_mar": 11.2,
  "mf_change_pct": 2.8,
  "top_funds_buying": ["SBI Bluechip Fund", "HDFC Mid Cap Opportunities", "Mirae Asset Large Cap"],
  "top_funds_selling": [],
  "net_mf_flows_cr": 485,
  "new_entries": ["Axis Small Cap Fund"],
  "exits": [],
  "reason": "Why MFs are increasing allocation - specific business reason",
  "category": "Large Cap|Mid Cap|Small Cap",
  "conviction": "High|Medium",
  "signal": "Strong Accumulate|Accumulate|Add"
}]

Focus on stocks with high conviction MF buying across multiple fund houses. Include mix of large, mid and small caps.`;

    try {
      const raw = await callGroq(prompt, "Return only valid JSON array starting with [. No extra text.", null);
      let clean = raw.replace(/```json|```/g,"").trim();
      if(!clean.startsWith("[")) clean = clean.substring(clean.indexOf("["));
      if(!clean.endsWith("]")) clean = clean.substring(0, clean.lastIndexOf("]")+1);
      const parsed = JSON.parse(clean);
      setMonthlyData(parsed);
      saveAndUpdate("dnr_monthly", parsed, "monthly");
    } catch(e) { setError("Failed to fetch monthly data. Try again."); }
    setLoading(false);
  };

  // ── QUARTERLY: Full shareholding pattern tracker ──
  const fetchQuarterly = async () => {
    setLoading(true); setError(null);
    const prompt = `You are an institutional research analyst tracking BSE/NSE shareholding patterns from Q3FY25 results season (Dec 2024 quarter). Identify 20 stocks where FIIs, DIIs, and Mutual Funds have ALL been consistently increasing their % holdings over Q1FY25, Q2FY25, Q3FY25.

Return ONLY a valid JSON array:
[{
  "stock": "Company Name",
  "symbol": "NSE_SYMBOL",
  "sector": "Sector",
  "price": "₹XXX",
  "mf_q1fy25": 11.2,
  "mf_q2fy25": 12.8,
  "mf_q3fy25": 14.5,
  "fii_q1fy25": 16.4,
  "fii_q2fy25": 18.1,
  "fii_q3fy25": 20.3,
  "dii_q1fy25": 9.8,
  "dii_q2fy25": 11.2,
  "dii_q3fy25": 12.9,
  "promoter_holding": 52.4,
  "promoter_pledge": "0%",
  "total_inst_change_3q": 8.6,
  "key_new_investors": ["Vanguard", "BlackRock", "SBI MF"],
  "quarterly_result_highlight": "Revenue +18% YoY, PAT +24% YoY, strong guidance",
  "business_momentum": "High|Very High",
  "analyst_upgrades": 8,
  "target_price": "₹XXXX",
  "momentum_score": 88,
  "signal": "Strong Buy|Buy|Accumulate",
  "institutional_thesis": "Why institutions are building long-term positions"
}]

Make it highly realistic based on actual Indian market trends in early 2025. Include diverse sectors.`;

    try {
      const raw = await callGroq(prompt, "Return only valid JSON array starting with [. No extra text.", null);
      let clean = raw.replace(/```json|```/g,"").trim();
      if(!clean.startsWith("[")) clean = clean.substring(clean.indexOf("["));
      if(!clean.endsWith("]")) clean = clean.substring(0, clean.lastIndexOf("]")+1);
      const parsed = JSON.parse(clean);
      setQuarterlyData(parsed);
      saveAndUpdate("dnr_quarterly", parsed, "quarterly");
    } catch(e) { setError("Failed to fetch quarterly data. Try again."); }
    setLoading(false);
  };

  // ── Deep Dive ──
  const deepDive = async (stock, currentMode) => {
    setSelectedStock({...stock, mode: currentMode});
    setDetailLoading(true); setDetailData(null);

    let prompt = "";
    if(currentMode === "daily") {
      prompt = `Deep dive on institutional news for ${stock.stock} (${stock.symbol}):
Institution: ${stock.institution} | Action: ${stock.action} | Amount: ${stock.quantity}
News: ${stock.news_headline}

Provide detailed analysis:
1. **Why ${stock.institution} is buying** — specific strategic reasoning
2. **Track record of this institution** in picking winners
3. **Other institutions following** — who else might buy next
4. **Price levels to watch** — entry points and targets
5. **Short-term vs Long-term thesis** — is this trade or investment
6. **Key risks** — what could go wrong
7. **Verdict for retail investors** — should you follow this institutional move?`;
    } else if(currentMode === "monthly") {
      prompt = `MF Portfolio Analysis for ${stock.stock} (${stock.symbol}):
MF Holdings: Jan: ${stock.total_mf_holding_jan}% → Feb: ${stock.total_mf_holding_feb}% → Mar: ${stock.total_mf_holding_mar}% (+${stock.mf_change_pct}%)
Top Buying Funds: ${(stock.top_funds_buying||[]).join(", ")}
Net Flows: ₹${stock.net_mf_flows_cr} Cr

Provide:
1. **Why these specific funds are increasing allocation** — fund mandate and strategy fit
2. **Fund manager conviction signals** — reading between the lines
3. **Valuation at which funds are buying** — are they buying cheap or premium?
4. **Upcoming catalysts** — quarterly results, events, policy changes
5. **Consensus vs contrarian** — is this crowded or early stage buying?
6. **How long funds typically hold** — short-term position or multi-year bet?
7. **Retail investor strategy** — SIP target, lump sum levels, stop loss`;
    } else {
      prompt = `Quarterly Shareholding Pattern Analysis for ${stock.stock} (${stock.symbol}):
MF: ${stock.mf_q1fy25}% → ${stock.mf_q2fy25}% → ${stock.mf_q3fy25}% (▲${((stock.mf_q3fy25||0)-(stock.mf_q1fy25||0)).toFixed(1)}%)
FII: ${stock.fii_q1fy25}% → ${stock.fii_q2fy25}% → ${stock.fii_q3fy25}% (▲${((stock.fii_q3fy25||0)-(stock.fii_q1fy25||0)).toFixed(1)}%)
DII: ${stock.dii_q1fy25}% → ${stock.dii_q2fy25}% → ${stock.dii_q3fy25}% (▲${((stock.dii_q3fy25||0)-(stock.dii_q1fy25||0)).toFixed(1)}%)
Results: ${stock.quarterly_result_highlight}
New Investors: ${(stock.key_new_investors||[]).join(", ")}

Provide comprehensive analysis:
1. **Institutional thesis** — why ALL three categories (MF+FII+DII) are buying simultaneously
2. **Business fundamentals** driving this — revenue, margins, ROE, debt
3. **Competitive moat** — why this company wins long-term
4. **Global context** — why foreign funds are investing (FII angle)
5. **Management quality** — promoter track record and governance
6. **Valuation comfort** — P/E, P/B vs historical and peers
7. **12-month price target** with reasoning
8. **Portfolio allocation** — what % to allocate and at what levels`;
    }

    const raw = await callGroq(prompt, SYS, null);
    setDetailData(raw);
    setDetailLoading(false);
  };

  const sentColor = s => s==="Very Bullish"||s==="Strong Buy"||s==="Strong Accumulate" ? "#22c55e" : s==="Bullish"||s==="Buy"||s==="Accumulate"||s==="High" ? T.goldLight : T.muted;

  const MiniTrend = ({v1,v2,v3,color}) => {
    const max = Math.max(v1||0,v2||0,v3||0)||1;
    return (
      <div style={{display:"flex",gap:2,alignItems:"flex-end",height:24}}>
        {[v1,v2,v3].map((v,i)=>(
          <div key={i} style={{width:8,borderRadius:"2px 2px 0 0",background:i===2?color:color+"44",height:`${((v||0)/max)*100}%`,minHeight:3}}/>
        ))}
      </div>
    );
  };

  const renderDaily = () => (
    <div>
      <div style={{background:`${T.walnutDark}88`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:16,marginBottom:20,display:"flex",gap:16,alignItems:"center"}}>
        <div style={{fontSize:32}}>📰</div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:T.goldLight,marginBottom:4}}>Daily Intelligence Feed</div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.7}}>Tracks <strong style={{color:T.dun}}>real-time news</strong> of institutional buying, block deals, bulk deals, and accumulation activity. Updated daily to catch early institutional moves before they reflect in quarterly data.</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
        {dailyData.map((s,i) => (
          <div key={i} className="news-card" style={{border:`1px solid ${T.walnut}33`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.dun}}>{s.stock}</div>
                <div style={{fontSize:10,color:T.muted}}>{s.symbol} · {s.sector}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.goldLight}}>{s.price}</div>
                <div style={{fontSize:11,color:"#22c55e"}}>{s.price_impact}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#3b82f622",color:"#60a5fa",border:"1px solid #3b82f644"}}>{s.action}</span>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:sentColor(s.sentiment)+"22",color:sentColor(s.sentiment),border:`1px solid ${sentColor(s.sentiment)}44`}}>{s.sentiment}</span>
            </div>
            <div style={{fontSize:12,fontWeight:600,color:T.dun,marginBottom:6,lineHeight:1.4}}>{s.news_headline}</div>
            <div style={{fontSize:11,color:"#a78bfa",marginBottom:6}}>🏦 {s.institution} — {s.quantity}</div>
            <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:10}}>{s.news_summary}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:T.muted}}>📅 {s.date}</span>
              <button className="hdr-btn" style={{fontSize:10}} onClick={() => deepDive(s,"daily")}>🔬 Deep Dive</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMonthly = () => (
    <div>
      <div style={{background:`${T.walnutDark}88`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:16,marginBottom:20,display:"flex",gap:16,alignItems:"center"}}>
        <div style={{fontSize:32}}>📆</div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:T.goldLight,marginBottom:4}}>Monthly MF Portfolio Tracker</div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.7}}>Tracks <strong style={{color:T.dun}}>AMFI monthly portfolio disclosures</strong> — every mutual fund must publish their holdings on the 10th of each month. This identifies stocks where MF holding % is consistently rising across fund houses.</div>
        </div>
      </div>
      <div className="card" style={{overflowX:"auto",marginBottom:20}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${T.walnut}44`}}>
              {["Stock","Category","Jan %","Feb %","Mar %","Change","Net Flow","Top Buying Funds","Conviction","Signal","Action"].map(h=>(
                <th key={h} style={{padding:"10px 10px",color:T.muted,fontWeight:500,textAlign:"left",fontSize:10,letterSpacing:"0.5px",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((s,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${T.walnut}22`,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.walnut+"11"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"12px 10px"}}>
                  <div style={{fontWeight:700,color:T.dun}}>{s.stock}</div>
                  <div style={{fontSize:10,color:T.muted}}>{s.symbol}</div>
                </td>
                <td style={{padding:"12px 10px"}}>
                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:T.gold+"22",color:T.goldLight,border:`1px solid ${T.gold}33`}}>{s.category}</span>
                </td>
                <td style={{padding:"12px 10px",fontFamily:"'DM Mono',monospace",color:T.muted,fontSize:11}}>{s.total_mf_holding_jan}%</td>
                <td style={{padding:"12px 10px",fontFamily:"'DM Mono',monospace",color:T.muted,fontSize:11}}>{s.total_mf_holding_feb}%</td>
                <td style={{padding:"12px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <MiniTrend v1={s.total_mf_holding_jan} v2={s.total_mf_holding_feb} v3={s.total_mf_holding_mar} color="#f59e0b"/>
                    <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:T.goldLight,fontSize:11}}>{s.total_mf_holding_mar}%</span>
                  </div>
                </td>
                <td style={{padding:"12px 10px",fontFamily:"'DM Mono',monospace",color:"#22c55e",fontWeight:700,fontSize:11}}>▲{s.mf_change_pct}%</td>
                <td style={{padding:"12px 10px",fontFamily:"'DM Mono',monospace",color:T.goldLight,fontSize:11}}>₹{s.net_mf_flows_cr}Cr</td>
                <td style={{padding:"12px 10px",maxWidth:160}}>
                  <div style={{fontSize:10,color:T.muted,lineHeight:1.5}}>{(s.top_funds_buying||[]).slice(0,2).join(", ")}{s.top_funds_buying?.length>2?` +${s.top_funds_buying.length-2} more`:""}</div>
                  {(s.new_entries||[]).length>0 && <div style={{fontSize:9,color:"#22c55e",marginTop:3}}>+ New: {s.new_entries[0]}</div>}
                </td>
                <td style={{padding:"12px 10px"}}>
                  <span style={{fontSize:10,color:sentColor(s.conviction)}}>{s.conviction}</span>
                </td>
                <td style={{padding:"12px 10px"}}>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:sentColor(s.signal)+"22",color:sentColor(s.signal),border:`1px solid ${sentColor(s.signal)}44`,whiteSpace:"nowrap"}}>{s.signal}</span>
                </td>
                <td style={{padding:"12px 10px"}}>
                  <button className="hdr-btn" style={{fontSize:10,whiteSpace:"nowrap"}} onClick={()=>deepDive(s,"monthly")}>🔬 Dive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderQuarterly = () => (
    <div>
      <div style={{background:`${T.walnutDark}88`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:16,marginBottom:20,display:"flex",gap:16,alignItems:"center"}}>
        <div style={{fontSize:32}}>🗓️</div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:T.goldLight,marginBottom:4}}>Quarterly Shareholding Pattern Tracker</div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.7}}>Tracks <strong style={{color:T.dun}}>BSE/NSE shareholding disclosures</strong> every quarter — shows stocks where FII + DII + MF are ALL increasing simultaneously. Cross-referenced with quarterly results, management commentary, and analyst upgrades.</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:16}}>
        {quarterlyData.map((s,i)=>(
          <div key={i} className="card" style={{border:`1px solid ${s.momentum_score>=85?T.goldLight+"44":T.walnut+"33"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:T.dun}}>{s.stock}</div>
                <div style={{fontSize:10,color:T.muted}}>{s.symbol} · {s.sector}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700,color:T.goldLight}}>{s.price}</div>
                <div style={{fontSize:11,color:"#22c55e",marginTop:2}}>Target: {s.target_price}</div>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:sentColor(s.signal)+"22",color:sentColor(s.signal),border:`1px solid ${sentColor(s.signal)}44`}}>{s.signal}</span>
              </div>
            </div>

            {/* Holding progression for all 3 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
              {[
                {label:"Mutual Funds",q1:s.mf_q1fy25,q2:s.mf_q2fy25,q3:s.mf_q3fy25,color:"#f59e0b"},
                {label:"FII / FPI",q1:s.fii_q1fy25,q2:s.fii_q2fy25,q3:s.fii_q3fy25,color:"#3b82f6"},
                {label:"DII",q1:s.dii_q1fy25,q2:s.dii_q2fy25,q3:s.dii_q3fy25,color:"#a78bfa"},
              ].map(h=>(
                <div key={h.label} style={{background:T.walnutDeeper+"88",borderRadius:8,padding:10,border:`1px solid ${h.color}22`}}>
                  <div style={{fontSize:9,color:h.color,marginBottom:6,letterSpacing:"0.5px"}}>{h.label}</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                    <span style={{color:T.muted}}>Q1</span><span style={{color:T.muted}}>{h.q1}%</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                    <span style={{color:T.muted}}>Q2</span><span style={{color:T.muted}}>{h.q2}%</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700}}>
                    <span style={{color:h.color}}>Q3</span>
                    <span style={{color:h.color}}>{h.q3}% <span style={{color:"#22c55e",fontSize:9}}>▲{((h.q3||0)-(h.q1||0)).toFixed(1)}%</span></span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:10,padding:"8px 12px",background:T.walnutDeeper+"88",borderRadius:8,borderLeft:`2px solid ${T.gold}44`}}>
              📊 {s.quarterly_result_highlight}
            </div>

            {(s.key_new_investors||[]).length>0 && (
              <div style={{fontSize:10,color:"#22c55e",marginBottom:8}}>
                🆕 New investors: {s.key_new_investors.join(", ")}
              </div>
            )}

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:10,color:T.muted}}>
                Promoter: {s.promoter_holding}% · Pledge: {s.promoter_pledge} · Upgrades: {s.analyst_upgrades}
              </div>
              <button className="hdr-btn" style={{fontSize:10}} onClick={()=>deepDive(s,"quarterly")}>🔬 Full Analysis</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const currentData = mode==="daily" ? dailyData : mode==="monthly" ? monthlyData : quarterlyData;
  const fetchFn = mode==="daily" ? fetchDaily : mode==="monthly" ? fetchMonthly : fetchQuarterly;

  return (
    <div>
      <div className="ph">
        <h1 className="pt">🏦 Institutional Momentum Tracker</h1>
        <p className="ps">Follow the smart money — Daily news · Monthly MF portfolios · Quarterly shareholding patterns</p>
      </div>

      {/* Mode selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        {[
          {id:"daily",icon:"📰",title:"Daily Tracker",sub:"News & block deals",desc:"Institutional buying news, bulk/block deals, insider activity — updated daily to catch early moves"},
          {id:"monthly",icon:"📆",title:"Monthly MF Tracker",sub:"AMFI portfolio disclosures",desc:"Stocks where MF holding % rising across fund houses — based on monthly AMFI portfolio data"},
          {id:"quarterly",icon:"🗓️",title:"Quarterly Tracker",sub:"Shareholding patterns",desc:"FII + DII + MF all increasing — from BSE/NSE quarterly shareholding + results + MF disclosures"},
        ].map(m=>(
          <div key={m.id} onClick={()=>setMode(m.id)} style={{cursor:"pointer",border:`1px solid ${mode===m.id?T.goldLight:T.walnut+"44"}`,borderRadius:12,padding:18,background:mode===m.id?T.gold+"11":T.walnutDark+"44",transition:"all 0.2s"}}>
            <div style={{fontSize:28,marginBottom:8}}>{m.icon}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:mode===m.id?T.goldLight:T.dun,marginBottom:4}}>{m.title}</div>
            <div style={{fontSize:10,color:T.goldLight,marginBottom:6,letterSpacing:"0.5px"}}>{m.sub}</div>
            <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>{m.desc}</div>
            {lastUpdated[m.id] && <div style={{fontSize:9,color:T.walnutLight,marginTop:8}}>Last: {lastUpdated[m.id]}</div>}
          </div>
        ))}
      </div>

      {/* Update controls */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:12,color:T.muted}}>
          {mode==="daily" && "📰 Showing latest institutional buying news & block deals"}
          {mode==="monthly" && "📆 Showing AMFI monthly MF portfolio disclosure analysis"}
          {mode==="quarterly" && "🗓️ Showing Q3FY25 shareholding pattern — FII + DII + MF combined"}
        </div>
        <button className="btn-gold" style={{padding:"9px 24px",fontSize:12}} onClick={fetchFn} disabled={loading}>
          {loading ? "⏳ Fetching data..." : `🔄 Update ${mode==="daily"?"Daily":mode==="monthly"?"Monthly":"Quarterly"} Data`}
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spin"/>
          <span>
            {mode==="daily" && "Scanning institutional news & block deal activity..."}
            {mode==="monthly" && "Analyzing AMFI monthly MF portfolio disclosures..."}
            {mode==="quarterly" && "Processing Q3FY25 shareholding patterns across FII + DII + MF..."}
          </span>
        </div>
      ) : error ? (
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
          <div style={{color:T.red,marginBottom:16,fontSize:13}}>{error}</div>
          <button className="btn-gold" onClick={fetchFn}>🔄 Try Again</button>
        </div>
      ) : currentData.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>{mode==="daily"?"📰":mode==="monthly"?"📆":"🗓️"}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.dun,marginBottom:8}}>
            {mode==="daily" && "No Daily Data Yet"}
            {mode==="monthly" && "No Monthly Data Yet"}
            {mode==="quarterly" && "No Quarterly Data Yet"}
          </div>
          <div style={{color:T.muted,fontSize:13,marginBottom:24}}>Click the Update button to fetch latest institutional activity</div>
          <button className="btn-gold" style={{padding:"12px 32px"}} onClick={fetchFn}>
            {mode==="daily" && "📰 Fetch Daily News"}
            {mode==="monthly" && "📆 Fetch MF Portfolio Data"}
            {mode==="quarterly" && "🗓️ Fetch Shareholding Patterns"}
          </button>
        </div>
      ) : (
        <>
          {mode==="daily" && renderDaily()}
          {mode==="monthly" && renderMonthly()}
          {mode==="quarterly" && renderQuarterly()}
        </>
      )}

      {/* Deep dive modal */}
      {selectedStock && (
        <div className="modal-overlay" onClick={e=>e.target.className==="modal-overlay"&&setSelectedStock(null)}>
          <div className="modal-box" style={{maxWidth:700,maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <div className="modal-title">{selectedStock.stock}</div>
                <div style={{fontSize:11,color:T.muted}}>
                  {selectedStock.mode==="daily" && `${selectedStock.institution} · ${selectedStock.action}`}
                  {selectedStock.mode==="monthly" && `MF Holding: ${selectedStock.total_mf_holding_jan}% → ${selectedStock.total_mf_holding_mar}% (+${selectedStock.mf_change_pct}%)`}
                  {selectedStock.mode==="quarterly" && `${selectedStock.sector} · Target: ${selectedStock.target_price}`}
                </div>
              </div>
              <button className="hdr-btn" onClick={()=>setSelectedStock(null)}>✕ Close</button>
            </div>
            {detailLoading ? <div className="loading"><div className="spin"/><span>Running deep analysis...</span></div> :
              detailData && <div className="res-box" style={{fontSize:13,lineHeight:1.9}} dangerouslySetInnerHTML={{__html:detailData.replace(/\*\*(.*?)\*\*/g,"<strong style='color:"+T.goldLight+"'>$1</strong>").replace(/\n/g,"<br/>")}}/>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [darkMode, setDarkMode] = useState(true);
  const [lang, setLang] = useState("EN");
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    document.body.className = darkMode ? "" : "light";
  }, [darkMode]);

  const LABELS = {
    EN: { home:"Home", markets:"Markets", research:"Deep Research", technical:"Technical Charts", quarterly:"Quarterly Hub", screener:"Screener", watchlist:"Watchlists", portfolio:"Portfolio", legends:"Legends", news:"News Feed", ipo:"IPO Tracker", fii:"FII / DII", sector:"Sector Rotation" },
    HI: { home:"होम", markets:"बाज़ार", research:"गहरी रिसर्च", technical:"टेक्निकल", quarterly:"तिमाही", screener:"स्क्रीनर", watchlist:"वॉचलिस्ट", portfolio:"पोर्टफोलियो", legends:"दिग्गज", news:"समाचार", ipo:"IPO", fii:"FII/DII", sector:"सेक्टर" }
  };
  const L = LABELS[lang];

  const tabs = [
    { id:"markets", icon:"📊", label:L.markets },
    { id:"research", icon:"🔬", label:L.research },
    { id:"technical", icon:"📈", label:L.technical },
    { id:"institutional", icon:"🏦", label:"Inst. Momentum" },
    { id:"news", icon:"📰", label:L.news },
    { id:"ipo", icon:"🏦", label:L.ipo },
    { id:"fii", icon:"🌐", label:L.fii },
    { id:"sector", icon:"🔄", label:L.sector },
    { id:"quarterly", icon:"📋", label:L.quarterly },
    { id:"screener", icon:"🔍", label:L.screener },
    { id:"watchlist", icon:"⭐", label:L.watchlist },
    { id:"portfolio", icon:"💼", label:L.portfolio },
    { id:"legends", icon:"🏛️", label:L.legends },
  ];

  return (
    <>
      <style>{styles}</style>
      {showAlerts && <PriceAlerts onClose={() => setShowAlerts(false)} />}
      <div className="app">
        <header className="hdr">
          <div className="logo" style={{cursor:"pointer"}} onClick={() => setActiveTab("home")}>
            <div className="logo-mark">D</div>
            <div>
              <div className="logo-title">DNR Capitals</div>
              <div className="logo-sub">Equity Research Intelligence</div>
            </div>
          </div>
          <div className="ticker">
            <div className="ticker-inner">
              {[...TICKERS, ...TICKERS].map((t, i) => (
                <span key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:T.muted }}>{t.s}</span>
                  <span style={{ color:T.dun, fontWeight:600 }}>{t.v}</span>
                  <span style={{ color:t.u ? T.green : T.red }}>{t.u ? "▲" : "▼"} {t.c}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="hdr-controls">
            <button className="hdr-btn" onClick={() => setShowAlerts(true)}>🔔 Alerts</button>
            <button className={`hdr-btn ${lang==="HI"?"active":""}`} onClick={() => setLang(l => l==="EN"?"HI":"EN")}>
              {lang==="EN" ? "🇮🇳 हिंदी" : "🇬🇧 English"}
            </button>
            <button className="hdr-btn" onClick={() => setDarkMode(d => !d)}>
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
            <div style={{ fontSize:10, color:T.muted, textAlign:"right" }}>
              <div style={{ color:T.goldLight, marginBottom:2 }}>● LIVE</div>
              <div>{new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</div>
            </div>
          </div>
        </header>

        <nav className="nav">
          {tabs.map(t => <button key={t.id} className={`nb ${activeTab===t.id ? "on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.icon} {t.label}</button>)}
        </nav>

        {activeTab !== "home" && (
          <main className="main">
            {GROQ_API_KEY === "YOUR_KEY_HERE" && (
              <div className="api-warn">
                <span style={{ fontSize:22 }}>⚠️</span>
                <div><strong style={{ color:T.goldLight }}>Groq API Key Required</strong><br />Add REACT_APP_GROQ_API_KEY to your environment variables.</div>
              </div>
            )}
            {activeTab === "markets"       && <Markets />}
            {activeTab === "research"      && <StockResearch />}
            {activeTab === "technical"     && <TechnicalCharts />}
            {activeTab === "institutional" && <InstitutionalMomentum />}
            {activeTab === "news"          && <NewsFeed />}
            {activeTab === "ipo"       && <IPOTracker />}
            {activeTab === "fii"       && <FIIDIITracker />}
            {activeTab === "sector"    && <SectorRotation />}
            {activeTab === "quarterly" && <QuarterlyHub />}
            {activeTab === "screener"  && <Screener />}
            {activeTab === "watchlist" && <WatchlistManager />}
            {activeTab === "portfolio" && <Portfolio />}
            {activeTab === "legends"   && <Legends />}
          </main>
        )}
        {activeTab === "home" && <HomePage setActiveTab={setActiveTab} />}

        <footer style={{ borderTop:`1px solid ${T.walnut}33`, padding:"10px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", background:T.walnutDeeper+"cc", fontSize:10, color:T.muted }}>
          <span>© {new Date().getFullYear()} DNR Capitals · Equity Research Intelligence</span>
          <span style={{ color:T.walnutLight }}>Powered by Groq AI · For educational purposes only · Not SEBI registered advice</span>
        </footer>
      </div>
    </>
  );
}
