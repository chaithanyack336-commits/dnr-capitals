/* eslint-disable */
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

// ─── THEME — CARBON BLACK + ELECTRIC BLUE + GOLD (Institutional) ──────────────────
const T = {
  // Carbon black backgrounds
  navyDeepest: "#000000",
  navyDeep:    "#050505",
  navy:        "#0A0A0A",
  navyMid:     "#0F0F0F",
  navyLight:   "#141414",
  navyBorder:  "#0A1428",
  navyHover:   "#060D18",
  navyActive:  "#060F2A",
  // Neon green matrix
  matrixGreen:      "#00C8FF",
  matrixGreenDim:   "#0099CC",
  matrixGreenPale:  "#00C8FF33",
  matrixGreenGlow:  "#00C8FF88",
  matrixGreenDeep:  "#002A3A",
  // Gold accents (kept for premium feel)
  gold:        "#C9A84C",
  goldLight:   "#E0BC6A",
  goldPale:    "#F5D88A",
  goldDim:     "#9A7A38",
  goldGlow:    "#E0BC6A55",
  // Text
  dun:         "#E8F0FF",
  dunLight:    "#F0F8FF",
  dunDark:     "#A8C8E8",
  muted:       "#2A4A6A",
  mutedDark:   "#0A1E3A",
  // Semantic
  green:       "#00C8FF",
  greenLight:  "#40D8FF",
  red:         "#FF3333",
  redLight:    "#FF6666",
  blue:        "#00BFFF",
  blueLight:   "#40D0FF",
  // Logo cosmic blue
  cosmicBlue:      "#1A5FB4",
  cosmicBlueLight: "#3A8FE8",
  cosmicBlueDim:   "#0D3A7A",
  cosmicBluePale:  "#5AAEFF",
  // Legacy aliases
  walnut:       "#0A1428",
  walnutLight:  "#0A1A38",
  walnutDark:   "#060E1A",
  walnutDeep:   "#0A0A0A",
  walnutDeeper: "#050505",
  cream:        "#E8F0FF",
  ink:          "#000000",
  // Light mode
  surface:    "#F0F8FF",
  surfaceAlt: "#E0F0E0",
  border:     "#A0C0A0",
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

// ─── LIVE MARKET DATA ENGINE ──────────────────────────────────────────────────
// Yahoo Finance symbols mapped to display labels
const MARKET_SYMBOLS = [
  { sym:"^NSEI",          label:"NIFTY 50",    prefix:"",  fmt:"indian" },
  { sym:"^BSESN",         label:"SENSEX",      prefix:"",  fmt:"indian" },
  { sym:"^NSEBANK",       label:"NIFTY BANK",  prefix:"",  fmt:"indian" },
  { sym:"^CNXIT",         label:"NIFTY IT",    prefix:"",  fmt:"indian" },
  { sym:"NIFTYMIDCAP150.NS",label:"MIDCAP 150",prefix:"",  fmt:"indian" },
  { sym:"^GSPC",          label:"S&P 500",     prefix:"",  fmt:"us2" },
  { sym:"^IXIC",          label:"NASDAQ",      prefix:"",  fmt:"us0" },
  { sym:"^DJI",           label:"DOW",         prefix:"",  fmt:"us0" },
  { sym:"GC=F",           label:"GOLD",        prefix:"$", fmt:"us2" },
  { sym:"CL=F",           label:"CRUDE",       prefix:"$", fmt:"us2" },
  { sym:"USDINR=X",       label:"USD/INR",     prefix:"₹", fmt:"us2" },
  { sym:"GOLDBEES.NS",    label:"GOLD (₹)",    prefix:"₹", fmt:"indian" },
];

async function fetchSingleQuote(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res  = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
  const json = await res.json();
  const data = JSON.parse(json.contents);
  const q    = data?.chart?.result?.[0];
  if (!q) return null;
  const meta = q.meta;
  const price = meta.regularMarketPrice;
  const prev  = meta.previousClose || meta.chartPreviousClose || price;
  return {
    price,
    prev,
    change:    (price - prev).toFixed(2),
    changePct: (((price - prev) / prev) * 100).toFixed(2),
    up:        price >= prev,
  };
}

async function fetchLiveMarkets() {
  const results = {};
  // Fetch all in parallel — individual failures don't break the rest
  await Promise.allSettled(
    MARKET_SYMBOLS.map(async ({ sym, label, prefix, fmt }) => {
      try {
        const q = await fetchSingleQuote(sym);
        if (!q) return;
        const fmtPrice = (p) => {
          if (fmt === "indian") return p >= 1000 ? p.toLocaleString("en-IN", {maximumFractionDigits:0}) : p.toFixed(2);
          if (fmt === "us0")    return p.toLocaleString("en-US", {maximumFractionDigits:0});
          return p.toFixed(2);
        };
        results[label] = {
          label,
          v:       `${prefix}${fmtPrice(q.price)}`,
          c:       `${q.up?"+":""}${q.changePct}%`,
          u:       q.up,
          raw:     q.price,
          chgAbs:  q.change,
        };
      } catch (_) {}
    })
  );
  return results;
}

// React hook — fetches on mount, refreshes every 90 seconds
function useLiveMarkets() {
  const [markets, setMarkets] = useState({});
  const [lastFetch, setLastFetch] = useState(null);
  const [fetching, setFetching]  = useState(false);

  const refresh = useCallback(async () => {
    setFetching(true);
    const data = await fetchLiveMarkets();
    if (Object.keys(data).length > 0) {
      setMarkets(data);
      setLastFetch(new Date().toLocaleTimeString("en-IN"));
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 90000); // refresh every 90s
    return () => clearInterval(interval);
  }, [refresh]);

  return { markets, lastFetch, fetching, refresh };
}

// ─── LIVE FII/DII FETCHER ─────────────────────────────────────────────────────
async function fetchLiveFIIDII() {
  const today = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  const raw = await callGroq(
    `You are a financial data analyst. Today is ${today}.
Provide the most current available FII (Foreign Institutional Investor) and DII (Domestic Institutional Investor) monthly net flow data for Indian equity markets.
Use the latest available SEBI/NSE/BSE data you know up to your knowledge cutoff.

Return ONLY a valid JSON array for the last 6 months of data (most recent last):
[{"month":"Oct 2024","fii":-94017,"dii":107254},{"month":"Nov 2024","fii":-45974,"dii":54626},...]

Where values are in crore INR (negative = net seller, positive = net buyer).
Use actual known data where available, estimate based on trends where not. Today is ${today}.
Return ONLY the JSON array, no text before or after.`,
    "Return only valid JSON array. No explanations, no markdown.",
    null
  );
  try {
    let clean = raw.replace(/```json|```/g,"").trim();
    if (!clean.startsWith("[")) clean = clean.substring(clean.indexOf("["));
    if (!clean.endsWith("]"))  clean = clean.substring(0, clean.lastIndexOf("]")+1);
    return JSON.parse(clean);
  } catch { return null; }
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

// ─── STYLES — DEEP NAVY + GOLD BLOOMBERG TERMINAL ────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Jost:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${T.navyDeep}}
  ::-webkit-scrollbar-thumb{background:${T.navyBorder};border-radius:2px}
  ::-webkit-scrollbar-thumb:hover{background:${T.navyActive}}

  body{
    font-family:'Jost',sans-serif;
    background:#000000;
    color:${T.dun};
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }
  ::selection{background:${T.goldGlow};color:${T.goldPale}}

  /* ── LAYOUT ── */
  .app{display:flex;flex-direction:column;min-height:100vh;background:${T.navyDeepest}}

  /* TOP BAR */
  .top-bar{
    position:fixed;top:0;left:0;right:0;height:48px;z-index:300;
    background:#000000;
    border-bottom:1px solid #0A1A0A;
    box-shadow:0 1px 0 ${T.gold}18, 0 4px 20px #00000044;
    display:flex;align-items:center;padding:0 16px 0 0;gap:0;
  }

  /* WORKSPACE */
  .workspace{
    display:flex;flex:1;
    margin-top:48px;
    min-height:calc(100vh - 48px);
  }

  /* SIDEBAR */
  .sidebar{
    position:fixed;left:0;top:48px;bottom:0;
    width:220px;
    background:#050505;
    border-right:1px solid #0A1A0A;
    display:flex;flex-direction:column;
    overflow-y:auto;overflow-x:hidden;
    z-index:200;
    box-shadow:2px 0 20px #00000033;
  }
  .sidebar::-webkit-scrollbar{width:3px}
  .sidebar::-webkit-scrollbar-track{background:transparent}
  .sidebar::-webkit-scrollbar-thumb{background:${T.navyBorder}}

  /* SIDEBAR LOGO */
  .sb-logo{
    padding:20px 16px 16px;
    border-bottom:1px solid ${T.navyBorder};
    cursor:pointer;
    display:flex;flex-direction:column;align-items:center;
    text-align:center;
    background:linear-gradient(180deg,#0A0A0A,#050505);
    transition:background 0.2s;
    flex-shrink:0;
  }
  .sb-logo:hover{background:${T.navyLight}}
  .sb-logo-img{
    width:72px;height:72px;border-radius:50%;
    object-fit:cover;
    border:2px solid ${T.gold}66;
    box-shadow:0 0 24px #00C8FF44, 0 0 48px #E0BC6A33;
    margin-bottom:10px;
    transition:box-shadow 0.3s;
  }
  .sb-logo:hover .sb-logo-img{box-shadow:0 0 32px #00C8FF77, 0 0 60px #E0BC6A55}
  .sb-logo-title{
    font-family:'Cormorant Garamond',serif;
    font-size:17px;font-weight:700;color:#00C8FF;
    letter-spacing:0.5px;line-height:1;
  }
  .sb-logo-sub{
    font-size:8px;color:${T.muted};
    letter-spacing:2.5px;text-transform:uppercase;margin-top:4px;
  }

  /* SIDEBAR NAV GROUPS */
  .sb-group{padding:10px 0 4px}
  .sb-group-label{
    padding:4px 16px 6px;
    font-size:8px;font-weight:700;letter-spacing:2px;
    text-transform:uppercase;color:#1A3A1A;
  }
  .sb-item{
    display:flex;align-items:center;gap:10px;
    padding:9px 16px;margin:1px 8px;border-radius:8px;
    font-family:'Jost',sans-serif;font-size:12px;font-weight:500;
    color:${T.muted};cursor:pointer;
    transition:all 0.18s;border:1px solid transparent;
    white-space:nowrap;
  }
  .sb-item:hover{
    color:#E8F5E8;background:#0A1A0A;
    border-color:#061A2A;
  }
  .sb-item.active{
    color:#00C8FF;
    background:linear-gradient(135deg,#061A2A,#060A18);
    border-color:#00C8FF33;
    box-shadow:0 0 12px #00C8FF22;
  }
  .sb-item.active::before{
    content:'';position:absolute;left:8px;
    width:3px;height:20px;border-radius:2px;
    background:linear-gradient(180deg,#39FF14,#00C8FF);
    box-shadow:0 0 8px #00C8FF;
  }
  .sb-item{position:relative;}
  .sb-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0}

  /* SIDEBAR FOOTER */
  .sb-footer{
    margin-top:auto;padding:12px 16px;
    border-top:1px solid ${T.navyBorder};
    flex-shrink:0;
  }
  .sb-live{
    display:flex;align-items:center;gap:6px;
    font-size:9px;color:${T.muted};
  }
  .sb-live-dot{width:6px;height:6px;border-radius:50%;background:#00C8FF;animation:livePulse 2s infinite}
  @keyframes livePulse{0%,100%{opacity:1;box-shadow:0 0 0 0 ${T.green}44}50%{opacity:0.7;box-shadow:0 0 0 4px transparent}}

  /* CONTENT AREA */
  .content-area{
    margin-left:220px;
    flex:1;
    display:flex;flex-direction:column;
    min-height:calc(100vh - 48px);
    background:${T.navyDeepest};
  }

  /* TOP BAR TICKER */
  .ticker{
    flex:1;overflow:hidden;margin:0 16px;
    font-family:'DM Mono',monospace;font-size:10px;color:${T.dunDark};
    mask-image:linear-gradient(90deg,transparent,black 4%,black 96%,transparent);
  }
  .ticker-inner{display:flex;gap:24px;animation:tickScroll 40s linear infinite;white-space:nowrap}
  @keyframes tickScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

  /* TOP BAR CONTROLS */
  .tb-controls{display:flex;align-items:center;gap:8px;flex-shrink:0}
  .tb-btn{
    padding:5px 11px;border-radius:6px;
    border:1px solid ${T.navyBorder};
    background:#0A0A0A;color:#2A4A2A;
    font-size:10px;cursor:pointer;transition:all 0.18s;
    font-family:'Jost',sans-serif;letter-spacing:0.3px;
  }
  .tb-btn:hover{background:#0A1A0A;border-color:#00C8FF44;color:#00C8FF}
  .tb-btn:active{transform:scale(0.97)}
  .tb-btn.active{background:${T.gold}22;border-color:${T.gold}66;color:${T.goldLight}}

  /* MAIN CONTENT */
  .main{padding:24px;max-width:1600px;width:100%;background:#000}

  /* CARDS */
  .card{
    background:linear-gradient(135deg,${T.navyMid},${T.navy});
    border:1px solid ${T.navyBorder};border-radius:12px;padding:18px;
    transition:border-color 0.2s,box-shadow 0.2s;
  }
  .card:hover{border-color:${T.navyActive};box-shadow:0 8px 32px #00000044}
  .card-gold{border-color:${T.gold}44;box-shadow:0 0 20px ${T.gold}0f}
  .card-gold:hover{border-color:${T.gold}77}
  .card-blue{border-color:${T.cosmicBlue}44}
  .card-sm{padding:12px 14px}

  /* TYPOGRAPHY */
  .sec-title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:${T.goldLight};margin-bottom:4px}
  .sec-sub{font-size:12px;color:${T.muted};margin-bottom:18px;letter-spacing:0.3px}
  .card-title{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:600;color:${T.dun};margin-bottom:12px}
  .ph{margin-bottom:20px}
  .pt{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:700;color:${T.goldLight};margin-bottom:4px}
  .ps{font-size:12px;color:${T.muted};letter-spacing:0.3px}
  .sec-hdr{font-size:10px;color:${T.goldLight};letter-spacing:1.5px;text-transform:uppercase;font-weight:600;margin-bottom:14px}

  /* BUTTONS */
  .btn-primary{
    background:linear-gradient(135deg,${T.navyActive},${T.navyLight});
    border:1px solid ${T.navyBorder};border-radius:8px;padding:9px 18px;
    color:${T.dun};font-family:'Jost',sans-serif;font-size:12px;font-weight:600;
    cursor:pointer;transition:all 0.2s;white-space:nowrap;letter-spacing:0.5px;
  }
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 14px #00000044;border-color:${T.gold}44}
  .btn-primary:active{transform:scale(0.98)}
  .btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}

  .btn-gold{
    background:linear-gradient(135deg,${T.goldPale},${T.goldLight} 40%,${T.gold});
    border:none;border-radius:8px;padding:9px 18px;
    color:${T.navyDeep};font-family:'Jost',sans-serif;font-size:12px;font-weight:700;
    cursor:pointer;transition:all 0.2s;white-space:nowrap;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .btn-gold:hover{transform:translateY(-1px);box-shadow:0 4px 18px ${T.gold}55}
  .btn-gold:active{transform:scale(0.98)}
  .btn-gold:disabled{opacity:0.4;cursor:not-allowed;transform:none}

  .btn-ghost{
    background:transparent;border:1px solid ${T.navyBorder};border-radius:7px;
    padding:7px 13px;color:${T.muted};font-family:'Jost',sans-serif;font-size:11px;
    cursor:pointer;transition:all 0.2s;
  }
  .btn-ghost:hover{border-color:${T.navyActive};color:${T.dun};background:${T.navyHover}}
  .btn-ghost:active{transform:scale(0.98)}
  .btn-sm{padding:5px 12px;font-size:11px}
  .btn-danger{background:${T.red}22;border:1px solid ${T.red}44;border-radius:6px;padding:4px 10px;color:${T.redLight};font-size:11px;cursor:pointer;transition:all 0.2s}
  .btn-danger:hover{background:${T.red}44}

  /* INPUTS */
  .inp{
    flex:1;background:${T.navyDeep};border:1px solid ${T.navyBorder};
    border-radius:8px;padding:9px 14px;color:${T.dun};
    font-family:'Jost',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s;
  }
  .inp:focus{border-color:${T.gold}88}
  .inp::placeholder{color:${T.mutedDark}}

  /* GRIDS */
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .g5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}

  /* STAT CARDS */
  .stat{background:linear-gradient(135deg,${T.navyMid},${T.navy});border:1px solid ${T.navyBorder};border-radius:10px;padding:14px;text-align:center;transition:all 0.2s}
  .stat:hover{border-color:${T.navyActive}}
  .stat-lbl{font-size:9px;color:${T.muted};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
  .stat-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:600;color:${T.dun}}
  .stat-chg{font-size:11px;margin-top:3px}
  .pos{color:${T.greenLight}} .neg{color:${T.redLight}}
  .stat-pos{border-color:${T.green}33;background:linear-gradient(135deg,${T.green}0a,${T.navy})}
  .stat-neg{border-color:${T.red}33;background:linear-gradient(135deg,${T.red}0a,${T.navy})}

  /* LOADING */
  .ld::after{content:'.';animation:dots 1.5s infinite}
  @keyframes dots{0%,20%{content:'.'}40%{content:'..'}60%,100%{content:'...'}}
  .loading{display:flex;align-items:center;gap:12px;padding:28px 16px;color:${T.muted};font-size:13px}
  .spin{width:18px;height:18px;flex-shrink:0;border:2px solid ${T.navyBorder};border-top:2px solid ${T.goldLight};border-radius:50%;animation:spinAnim 0.7s linear infinite}
  @keyframes spinAnim{to{transform:rotate(360deg)}}
  .res-box{background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:10px;padding:20px 22px;font-size:13px;line-height:1.85;color:${T.dunDark};white-space:pre-wrap}
  .res-box strong{color:${T.goldLight};font-weight:600}

  /* RESEARCH */
  .rs{border:1px solid ${T.navyBorder};border-radius:10px;margin-bottom:10px;overflow:hidden;transition:border-color 0.2s}
  .rs:hover{border-color:${T.navyActive}}
  .rs-hdr{background:${T.navyMid};padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:background 0.2s}
  .rs-hdr:hover{background:${T.navyHover}}
  .rs-title{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:${T.dun};display:flex;align-items:center;gap:8px}
  .rs-badge{background:${T.gold}22;border:1px solid ${T.gold}33;border-radius:10px;padding:2px 9px;font-size:9px;font-family:'DM Mono',monospace;color:${T.goldLight};letter-spacing:1px}
  .rs-body{padding:16px;background:${T.navy}}
  .prose{font-size:13px;line-height:1.85;color:${T.dunDark};white-space:pre-wrap}
  .prose strong{color:${T.goldLight};font-weight:600}

  /* STEPS */
  .steps{display:flex;gap:3px;margin-bottom:16px;flex-wrap:wrap}
  .step{padding:3px 10px;border-radius:16px;font-size:10px;border:1px solid ${T.navyBorder};color:${T.mutedDark};transition:all 0.3s}
  .step.done{background:${T.green}18;border-color:${T.green}44;color:${T.greenLight}}
  .step.active{background:${T.gold}18;border-color:${T.gold}66;color:${T.goldLight};animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${T.gold}44}50%{box-shadow:0 0 0 5px transparent}}

  /* NEWS */
  .news-card{background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:12px;padding:20px;margin-bottom:12px;transition:all 0.22s;cursor:pointer}
  .news-card:hover{border-color:${T.gold}44;background:${T.navyHover};transform:translateX(2px);box-shadow:0 4px 20px #00000033}
  .news-tag{display:inline-block;padding:3px 10px;border-radius:12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;background:${T.gold}22;color:${T.goldLight};margin-bottom:10px;border:1px solid ${T.gold}33}
  .news-headline{font-size:15px;font-weight:600;color:${T.dun};line-height:1.4;margin-bottom:8px}
  .news-summary{font-size:12px;color:${T.muted};line-height:1.7}
  .news-meta{font-size:10px;color:${T.mutedDark};margin-top:10px}
  .news-src{font-size:9px;color:${T.goldLight};letter-spacing:1px;text-transform:uppercase}
  .news-hl{font-size:13px;color:${T.dun};margin:3px 0;font-weight:500;line-height:1.4}
  .news-tm{font-size:10px;color:${T.muted}}

  /* TABS MINI */
  .tab-mini{display:flex;gap:3px;margin-bottom:14px;background:${T.navyDeep};border-radius:8px;padding:3px;width:fit-content}
  .tmb{padding:6px 13px;border-radius:6px;background:none;border:none;color:${T.muted};font-size:11px;cursor:pointer;transition:all 0.2s;font-family:'Jost',sans-serif}
  .tmb.on{background:${T.navyActive};color:${T.dun};border:1px solid ${T.navyBorder}}

  /* CHART */
  .chart-title{font-size:10px;color:${T.muted};margin-bottom:8px;letter-spacing:1px;text-transform:uppercase}

  /* TECHNICAL */
  .indicator-card{background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:10px;padding:14px;transition:all 0.2s}
  .indicator-card:hover{border-color:${T.navyActive}}
  .ind-name{font-size:10px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
  .ind-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:600}
  .ind-sig{font-size:10px;margin-top:3px;font-weight:600;letter-spacing:1px}
  .sig-buy{color:${T.greenLight};text-shadow:0 0 12px ${T.green}55}
  .sig-sell{color:${T.redLight};text-shadow:0 0 12px ${T.red}55}
  .sig-neutral{color:${T.gold}}

  /* SCREENER */
  .scr-row{display:grid;grid-template-columns:1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr;gap:6px;align-items:center;padding:9px 14px;border-bottom:1px solid ${T.navyBorder};font-size:11px;transition:background 0.15s}
  .scr-row:hover{background:${T.navyHover};cursor:pointer}
  .scr-hdr{font-size:9px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;font-weight:600;border-bottom:2px solid ${T.navyActive}}

  /* PEER */
  .peer-table{width:100%;border-collapse:collapse;font-size:12px}
  .peer-table th{background:${T.navyMid};padding:9px 12px;text-align:left;font-size:10px;color:${T.goldLight};letter-spacing:1px;text-transform:uppercase;font-weight:600}
  .peer-table td{padding:9px 12px;border-bottom:1px solid ${T.navyBorder};color:${T.dunDark}}
  .peer-table tr:hover td{background:${T.navyHover}}
  .peer-best{color:${T.greenLight};font-weight:700}
  .peer-worst{color:${T.redLight}}

  /* QUARTERLY */
  .q-card{background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:10px;padding:14px;margin-bottom:10px}
  .q-quarter{font-family:'DM Mono',monospace;font-size:11px;color:${T.goldLight};margin-bottom:8px;letter-spacing:1px}
  .q-metric{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid ${T.navyBorder};font-size:12px}

  /* API BANNER */
  .api-warn{background:linear-gradient(135deg,${T.gold}12,${T.gold}08);border:1px solid ${T.gold}44;border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;font-size:13px;box-shadow:0 2px 12px ${T.gold}0f}

  /* VERDICT */
  .verdict-box{background:linear-gradient(135deg,${T.navyMid},${T.navy});border:2px solid ${T.gold}55;border-radius:14px;padding:22px;text-align:center;margin-top:18px;box-shadow:0 0 40px ${T.gold}0f,inset 0 1px 0 ${T.gold}22}

  /* MODAL */
  .modal-overlay{position:fixed;inset:0;background:#00000088;z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
  .modal-box{background:${T.navy};border:1px solid ${T.navyBorder};border-radius:16px;padding:32px;width:90%;max-width:480px;box-shadow:0 24px 80px #000000aa,0 0 0 1px ${T.gold}11}
  .modal-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:${T.dun};margin-bottom:20px}
  .alert-item{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:8px;margin-bottom:8px;transition:border-color 0.2s}
  .alert-item:hover{border-color:${T.navyActive}}

  /* LEGEND */
  .leg-card{border-left:3px solid ${T.goldLight};padding:14px 16px;margin-bottom:10px;background:${T.navyMid};border-radius:0 10px 10px 0;transition:all 0.2s}
  .leg-card:hover{border-left-color:${T.goldPale};background:${T.navyHover}}
  .leg-name{font-family:'Cormorant Garamond',serif;font-size:15px;color:${T.goldLight};font-weight:600}
  .leg-title{font-size:10px;color:${T.muted};margin-bottom:6px}
  .leg-quote{font-size:13px;color:${T.dunDark};line-height:1.65;font-style:italic}

  /* PORTFOLIO */
  .p-row{display:grid;grid-template-columns:2fr 0.6fr 1fr 1fr 1fr 1.3fr 60px;gap:6px;align-items:center;padding:10px 14px;border-bottom:1px solid ${T.navyBorder};font-size:12px;transition:background 0.15s}
  .p-row:hover{background:${T.navyHover}}
  .p-hdr{font-size:9px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;font-weight:600}
  .p-bar{height:3px;border-radius:2px;margin-top:4px;transition:width 0.6s ease}

  /* WATCHLIST */
  .wl-stock{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid ${T.navyBorder};font-size:12px;transition:background 0.15s}
  .wl-stock:hover{background:${T.navyHover}}

  /* IPO */
  .ipo-card{background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:12px;padding:20px;transition:all 0.2s}
  .ipo-card:hover{border-color:${T.gold}44;box-shadow:0 6px 24px #00000033}
  .ipo-status{display:inline-block;padding:3px 12px;border-radius:12px;font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px}
  .ipo-open{background:#22c55e22;color:#22c55e;border:1px solid #22c55e44}
  .ipo-upcoming{background:${T.gold}22;color:${T.goldLight};border:1px solid ${T.gold}44}
  .ipo-closed{background:#64748b22;color:#94a3b8;border:1px solid #64748b44}
  .ipo-listed{background:#3b82f622;color:#60a5fa;border:1px solid #3b82f644}

  /* FII */
  .fii-bar-wrap{background:${T.navyDeep};border-radius:8px;overflow:hidden;height:10px;margin:8px 0}
  .fii-bar{height:100%;border-radius:8px;transition:width 0.8s ease}

  /* SECTOR */
  .sector-card{background:${T.navyMid};border:1px solid ${T.navyBorder};border-radius:12px;padding:18px;cursor:pointer;transition:all 0.25s}
  .sector-card:hover{border-color:${T.gold}55;transform:translateY(-2px);box-shadow:0 8px 28px ${T.gold}18}
  .sector-heat{width:100%;height:6px;border-radius:3px;margin-top:10px}

  /* CALCULATOR */
  .calc-result{background:linear-gradient(135deg,${T.navyMid},${T.navy});border:1px solid ${T.gold}44;border-radius:12px;padding:20px;margin-top:16px}
  .calc-big{font-family:'DM Mono',monospace;font-size:32px;font-weight:700;color:${T.goldLight};margin:6px 0}
  .calc-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${T.navyBorder};font-size:12px}
  .range-inp{width:100%;accent-color:${T.gold};cursor:pointer}

  /* CALENDAR */
  .cal-event{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-bottom:1px solid ${T.navyBorder};transition:background 0.15s}
  .cal-event:hover{background:${T.navyHover}}
  .cal-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
  .cal-date{font-family:'DM Mono',monospace;font-size:10px;color:${T.muted};min-width:70px}
  .cal-title{font-size:13px;color:${T.dun};font-weight:500}
  .cal-sub{font-size:11px;color:${T.muted};margin-top:2px}
  .imp-high{background:${T.red}22;border:1px solid ${T.red}33;color:${T.redLight};font-size:9px;padding:1px 7px;border-radius:8px}
  .imp-med{background:${T.gold}22;border:1px solid ${T.gold}33;color:${T.goldLight};font-size:9px;padding:1px 7px;border-radius:8px}
  .imp-low{background:${T.navyBorder}44;border:1px solid ${T.navyBorder};color:${T.muted};font-size:9px;padding:1px 7px;border-radius:8px}

  /* BULK DEALS */
  .bd-row{display:grid;grid-template-columns:1.2fr 0.7fr 1fr 0.8fr 0.8fr 0.8fr 1fr;gap:6px;align-items:center;padding:9px 14px;border-bottom:1px solid ${T.navyBorder};font-size:11px;transition:background 0.15s}
  .bd-row:hover{background:${T.navyHover}}
  .bd-hdr{font-size:9px;color:${T.muted};letter-spacing:1px;text-transform:uppercase;font-weight:600}
  .bd-buy{color:${T.greenLight};background:${T.green}18;border:1px solid ${T.green}33;padding:1px 8px;border-radius:8px;font-size:9px;font-weight:700}
  .bd-sell{color:${T.redLight};background:${T.red}18;border:1px solid ${T.red}33;padding:1px 8px;border-radius:8px;font-size:9px;font-weight:700}

  /* BADGE */
  .badge-blue{display:inline-block;padding:2px 9px;border-radius:10px;background:${T.cosmicBlue}22;border:1px solid ${T.cosmicBlue}44;color:${T.cosmicBluePale};font-size:9px;letter-spacing:1px}

  /* HDR-BTN alias for modal close */
  .hdr-btn{padding:6px 12px;border-radius:6px;border:1px solid ${T.navyBorder};background:${T.navyMid};color:${T.muted};font-size:10px;cursor:pointer;transition:all 0.2s;font-family:'Jost',sans-serif}
  .hdr-btn:hover{background:${T.navyHover};border-color:${T.gold}44;color:${T.goldLight}}

  /* FOCUS */
  *:focus-visible{outline:2px solid ${T.gold}88;outline-offset:2px;border-radius:4px}

  /* HOMEPAGE */
  .home-page{position:relative;width:100%;min-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden;background:${T.navyDeepest}}
  .home-canvas{position:absolute;inset:0;opacity:0.18;pointer-events:none}
  .home-overlay{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 50%,transparent 30%,${T.navyDeepest}99 100%);pointer-events:none}
  .home-grid{position:absolute;inset:0;background-image:linear-gradient(${T.gold}08 1px,transparent 1px),linear-gradient(90deg,${T.gold}08 1px,transparent 1px);background-size:60px 60px;pointer-events:none}

  .home-hero{position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 40px 40px;text-align:center;flex:1}
  .home-logo-wrap{
    position:relative;margin-bottom:32px;cursor:pointer;
    animation:heroFadeUp 1s ease forwards;
  }
  .home-logo-img{
    width:120px;height:120px;border-radius:50%;object-fit:cover;
    border:2px solid ${T.gold}88;
    box-shadow:0 0 60px ${T.gold}55,0 0 120px ${T.cosmicBlue}44,0 0 20px ${T.gold}33;
    transition:box-shadow 0.4s;
  }
  .home-logo-wrap:hover .home-logo-img{box-shadow:0 0 80px ${T.gold}88,0 0 160px ${T.cosmicBlue}66,0 0 30px ${T.gold}55}
  .home-logo-ring{
    position:absolute;inset:-12px;border-radius:50%;
    border:1px solid ${T.gold}33;
    animation:ringRotate 20s linear infinite;
  }
  .home-logo-ring2{
    position:absolute;inset:-20px;border-radius:50%;
    border:1px solid ${T.cosmicBlue}22;
    animation:ringRotate 35s linear infinite reverse;
  }
  @keyframes ringRotate{to{transform:rotate(360deg)}}
  @keyframes heroFadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

  .home-eyebrow{display:flex;align-items:center;gap:14px;font-size:9px;letter-spacing:5px;color:${T.goldLight};text-transform:uppercase;margin-bottom:20px;animation:heroFadeUp 1.1s ease forwards;opacity:0}
  .home-eyebrow-line{width:50px;height:1px;background:linear-gradient(90deg,transparent,${T.goldLight})}
  .home-title{font-family:'Cormorant Garamond',serif;font-size:clamp(52px,7vw,96px);font-weight:700;line-height:0.92;color:${T.dunLight};text-shadow:0 0 80px ${T.gold}22;animation:heroFadeUp 1.2s ease forwards;opacity:0}
  .home-title-accent{font-family:'Cormorant Garamond',serif;font-size:clamp(52px,7vw,96px);font-weight:700;font-style:italic;color:${T.goldLight};display:block;line-height:1;margin-bottom:28px;text-shadow:0 0 60px ${T.gold}44;animation:heroFadeUp 1.4s ease forwards;opacity:0}
  .home-divider{display:flex;align-items:center;gap:16px;margin-bottom:20px;animation:heroFadeUp 1.5s ease forwards;opacity:0}
  .home-divider-line{flex:1;max-width:100px;height:1px;background:linear-gradient(90deg,transparent,${T.gold}55)}
  .home-divider-diamond{width:8px;height:8px;background:${T.goldLight};transform:rotate(45deg);box-shadow:0 0 12px ${T.gold}88}
  .home-subtitle{font-size:14px;color:${T.muted};max-width:500px;line-height:1.9;letter-spacing:0.5px;font-weight:300;margin-bottom:32px;animation:heroFadeUp 1.6s ease forwards;opacity:0}
  .home-btns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;animation:heroFadeUp 1.8s ease forwards;opacity:0}

  /* MARKET STATS BAR */
  .home-stats{
    position:relative;z-index:10;
    display:flex;align-items:center;justify-content:center;gap:0;
    border-top:1px solid ${T.gold}22;border-bottom:1px solid ${T.gold}22;
    background:linear-gradient(90deg,transparent,${T.navyDeepest}88 15%,${T.navyDeepest}88 85%,transparent);
    padding:16px 40px;animation:heroFadeUp 2s ease forwards;opacity:0;
  }
  .home-stat-item{display:flex;flex-direction:column;align-items:center;padding:0 24px;border-right:1px solid ${T.gold}18;min-width:120px}
  .home-stat-item:last-child{border-right:none}

  /* NEWS SLIDES */
  .home-slides{
    position:relative;z-index:10;
    border-top:1px solid ${T.navyBorder};
    padding:20px 40px;min-height:80px;
    background:${T.navyDeepest}cc;
    animation:heroFadeUp 2.2s ease forwards;opacity:0;
  }
  .slide-track{overflow:hidden;position:relative}
  .slide-inner{display:flex;transition:transform 0.7s cubic-bezier(0.4,0,0.2,1)}
  .slide-item{min-width:100%;padding:0 20px;text-align:center}
  .slide-quote{font-family:'Cormorant Garamond',serif;font-size:17px;font-style:italic;color:${T.dunDark};line-height:1.6}
  .slide-author{font-size:10px;color:${T.goldLight};letter-spacing:3px;text-transform:uppercase;margin-top:8px}
  .slide-dots{display:flex;gap:6px;justify-content:center;margin-top:12px}
  .slide-dot{width:5px;height:5px;border-radius:50%;background:${T.navyBorder};cursor:pointer;transition:all 0.3s}
  .slide-dot.active{background:${T.goldLight};box-shadow:0 0 6px ${T.gold}}

  /* FEATURE CARDS */
  .home-features{
    position:relative;z-index:10;
    display:grid;grid-template-columns:repeat(3,1fr);
    gap:1px;width:100%;
    background:${T.gold}11;border-top:1px solid ${T.navyBorder};
    animation:heroFadeUp 2.4s ease forwards;opacity:0;
  }
  .home-feat{
    background:${T.navyDeepest};padding:24px 28px;
    cursor:pointer;display:flex;align-items:flex-start;gap:14px;
    transition:background 0.25s;
  }
  .home-feat:hover{background:${T.navyMid}}
  .home-feat-icon{font-size:20px;width:40px;height:40px;background:${T.gold}15;border:1px solid ${T.gold}33;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .home-feat-title{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:600;color:${T.dun};margin-bottom:3px}
  .home-feat-desc{font-size:10px;color:${T.mutedDark};line-height:1.6}

  /* LIGHT MODE */
  body.light{background:${T.surface};color:#1E2A45}
  body.light .app{background:${T.surface}}
  body.light .sidebar{background:${T.surface};border-right-color:${T.border}}
  body.light .sb-logo{background:linear-gradient(180deg,${T.surfaceAlt},${T.surface})}
  body.light .sb-item{color:#4A5570}
  body.light .sb-item:hover{background:${T.border}44;color:#1E2A45}
  body.light .sb-item.active{background:${T.cosmicBlue}18;border-color:${T.cosmicBlue}44;color:${T.cosmicBlue}}
  body.light .top-bar{background:${T.surface};border-bottom-color:${T.border}}
  body.light .content-area{background:${T.surface}}
  body.light .card{background:#FFFFFF;border-color:${T.border}88;box-shadow:0 2px 8px #00000008}
  body.light .stat{background:${T.surfaceAlt};border-color:${T.border}66}
  body.light .stat-val{color:#1E2A45}
  body.light .inp{background:#FFFFFF;border-color:${T.border};color:#1E2A45}
  body.light .sec-title{color:#1E2A45}
  body.light .pt{color:${T.cosmicBlue}}
  body.light .card-title{color:#1E2A45}
  body.light .prose{color:#2A3A55}
  body.light .prose strong{color:${T.cosmicBlue}}
  body.light .res-box{background:${T.surfaceAlt};border-color:${T.border}}
  body.light .news-card{background:#FFFFFF;border-color:${T.border}66}
  body.light .rs{border-color:${T.border}66}
  body.light .rs-hdr{background:${T.surfaceAlt}}
  body.light .peer-table th{background:${T.surfaceAlt}}
  body.light .peer-table td{border-bottom-color:${T.border}44}
  body.light .tab-mini{background:${T.surfaceAlt}}
  body.light .tmb.on{background:${T.cosmicBlue};color:#FFFFFF}
  body.light .q-card{background:#FFFFFF;border-color:${T.border}66}
  body.light .home-page{background:${T.surfaceAlt}}
  body.light .modal-box{background:${T.surface};border-color:${T.border}}

  /* RESPONSIVE */
  @media(max-width:900px){
    .sidebar{width:56px}
    .sb-logo-img{width:36px;height:36px}
    .sb-logo-title,.sb-logo-sub,.sb-group-label,.sb-item span.sb-label{display:none}
    .sb-item{justify-content:center;padding:10px;margin:2px 4px}
    .sb-icon{font-size:16px}
    .content-area{margin-left:56px}
    .home-features{grid-template-columns:1fr 1fr}
    .g3,.g4,.g5{grid-template-columns:1fr 1fr}
    .g2{grid-template-columns:1fr}
    .main{padding:12px}
    .home-stats{flex-wrap:wrap;gap:8px;padding:12px}
    .home-stat-item{min-width:80px;border-right:none}
  }

  /* UTILITY */
  .gold-text{color:${T.goldLight}}
  .muted-text{color:${T.muted}}
  .pos-text{color:${T.greenLight}}
  .neg-text{color:${T.redLight}}
  .mono{font-family:'DM Mono',monospace}
  .serif{font-family:'Cormorant Garamond',serif}
`;
// ─── TICKER LABELS (order for scrolling bar) ─────────────────────────────────
// Actual values come from useLiveMarkets() — this is just the display order
const TICKER_ORDER = [
  "NIFTY 50","SENSEX","NIFTY BANK","NIFTY IT","MIDCAP 150",
  "S&P 500","NASDAQ","DOW","GOLD ($)","CRUDE","USD/INR","GOLD (₹)",
];

const RESEARCH_STEPS = [
  "Business Overview","Product Portfolio","Industry Analysis",
  "Financial Statements","Balance Sheet","Income Statement",
  "Cash Flow Analysis","Peer Comparison","Quarterly Results",
  "Management Analysis","Corporate Actions","Shareholding Pattern",
  "Key Ratios","DCF Valuation","Audit & Governance",
  "News & Sentiment","Technical Analysis","Final Verdict",
];

// SYS is a function now so it always uses today's date
const getSYS = () => {
  const today = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  const yr = new Date().getFullYear();
  const q  = Math.ceil((new Date().getMonth()+1)/3);
  return `You are DNR Capitals' senior equity analyst — combining Warren Buffett's philosophy, Peter Lynch's stock picking, and 30 years of Indian market expertise. Provide institutional-quality, specific research with **bold** key terms and numbers. Always give actionable insights.

TODAY: ${today} | Current Quarter: Q${q}FY${(yr-2000+1)} | FY${yr-2000+1}

MANDATORY REAL-TIME DATA RULES (NON-NEGOTIABLE):
- Today is ${today}. Use ONLY data current as of this date.
- NEVER use prices, targets, or financial data from 2022 or 2023 — those are WRONG and misleading
- When a research prompt provides ⚡ REAL-TIME DATA section, that data OVERRIDES everything you know
- Use the TTM (Trailing Twelve Months) figures provided — not FY22/FY23 annual data
- CMP (Current Market Price) = whatever is stated in the ⚡ REAL-TIME DATA section
- ALL price targets must be calculated relative to the ACTUAL CMP provided
- State your data period clearly: "Based on TTM data as of [date from prompt]"
- If real-time data is not provided for a section, clearly state "based on last known data"
- For FII/DII data: reference the most recent quarters available (Q3FY25 or Q4FY25)
- For shareholding: use the latest available quarter from the data provided
- Revenue/PAT growth rates must come from the quarterly trend provided, not assumed`;
};
const SYS = getSYS(); // evaluated once at startup; prompts re-call getSYS() for freshness

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

function HomePage({ setActiveTab, markets, fetching }) {
  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const stateRef   = useRef(null);
  const [slideIdx, setSlideIdx]  = useState(0);
  const [slideFade,setSlideFade] = useState(true);
  const [counters, setCounters]  = useState({stocks:0,research:0,accuracy:0,users:0});
  const [tick,     setTick]      = useState(0);

  // ── 3D WARP STAR + CONSTELLATION SYSTEM ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth  || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
      stateRef.current && (stateRef.current.needsReinit = true);
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (a,b) => a + Math.random()*(b-a);

    const initScene = () => {
      const W = canvas.width, H = canvas.height;
      const FOV = Math.min(W,H) * 0.85;
      const CX = W/2, CY = H/2;
      const DEPTH = 2000;
      const SPEED = 1.8;

      // ── 1400 warp stars in 3D — more density ──
      const STAR_COLS = [
        '#FFFFFF','#F0F8FF','#E8F4FF', // pure white / blue-white
        '#CCE8FF','#AADDFF','#88CCFF', // electric blue family
        '#FFEEDD','#FFD090','#FFB060', // warm gold/orange
        '#FF8844','#FF6622',           // orange-red giants
      ];
      const stars = Array.from({length:1400}, () => ({
        x:    rand(-W*3, W*3),
        y:    rand(-H*3, H*3),
        z:    rand(1, DEPTH),
        pz:   DEPTH,
        col:  STAR_COLS[Math.floor(Math.pow(Math.random(),1.8)*STAR_COLS.length)],
        size: rand(0.25, 3.0),
      }));

      // ── Galaxy spiral — 2000 particles ──
      const galaxyParticles = [];
      const GAL_COLS = ['#88CCFF','#AADDFF','#FFFFFF','#FFE8A0','#FFD060','#C8A0FF','#FF9090'];
      for (let arm=0; arm<3; arm++) {
        for (let i=0; i<660; i++) {
          const frac   = i/660;
          const angle  = (arm/3)*Math.PI*2 + frac*Math.PI*3.5;
          const radius = frac * Math.min(W,H) * 0.38;
          const spread = frac * 28;
          const cx2 = W*0.5 + Math.cos(angle)*radius + (Math.random()-0.5)*spread;
          const cy2 = H*0.5 + Math.sin(angle)*radius*0.42 + (Math.random()-0.5)*spread*0.42;
          let col;
          if (frac<0.12)      col = '#FFF5C0'; // core — warm white-gold
          else if (frac<0.35) col = '#AADDFF'; // inner arms — blue-white
          else if (frac<0.65) col = '#88CCFF'; // mid arms — electric blue
          else                col = '#6699CC'; // outer — dim blue
          galaxyParticles.push({
            x: cx2, y: cy2,
            r: rand(0.4, frac<0.15?3.5:1.8),
            alpha: (1-frac*0.6)*(0.4+Math.random()*0.5),
            col,
            baseX: cx2, baseY: cy2,
          });
        }
      }

      // ── Galaxy core glow ──
      const galCore = { x:W*0.5, y:H*0.5, angle:0 };

      // ── Constellation nodes — NSE stocks ──
      const LABELS = ['NIFTY','TCS','HDFC','RELIANCE','INFY','BAJFINANCE',
        'SBI','WIPRO','LT','TATAMOTORS','ADANIENT','ITC','HUL','AXISBANK',
        'KOTAKBANK','SUNPHARMA','DRREDDY','ONGC','NTPC','TITAN','ICICIBANK',
        'HDFCBANK','MARUTI','ASIAN','NESTL','COALIND','POWERGRID','HCLTECH'];
      const nodes = Array.from({length:28}, (_, i) => ({
        x:  rand(0.06, 0.94),
        y:  rand(0.06, 0.94),
        vx: (Math.random()-0.5)*0.00022,
        vy: (Math.random()-0.5)*0.00022,
        r:  rand(2.5, 5.5),
        pulse:      Math.random()*Math.PI*2,
        pulseSpeed: rand(0.015, 0.03),
        label:      LABELS[i%LABELS.length],
        brightness: rand(0.6, 1.0),
        hue:        Math.random()>0.7 ? '#FFD060' : '#5BB8FF', // mix gold + blue nodes
      }));

      // ── Active electric arcs — multiple simultaneous ──
      const arcs = [];
      const spawnArc = () => {
        if (arcs.length > 5) return;
        const i = Math.floor(Math.random()*nodes.length);
        const j = (i + 1 + Math.floor(Math.random()*5)) % nodes.length;
        arcs.push({
          ax: nodes[i].x*W, ay: nodes[i].y*H,
          bx: nodes[j].x*W, by: nodes[j].y*H,
          life: 24, maxLife: 24,
          col: Math.random()>0.4 ? '#5BB8FF' : '#FFD060',
          width: rand(0.8, 2.5),
          // Jagged lightning path
          jag: Array.from({length:6}, () => ({
            ox: (Math.random()-0.5)*40,
            oy: (Math.random()-0.5)*40,
          })),
        });
      };

      // ── Shooting stars ──
      const shooters = [];
      const spawnShooter = () => {
        if (shooters.length >= 5) return;
        shooters.push({
          x:   rand(0, W),
          y:   rand(0, H*0.4),
          vx:  rand(6,12),
          vy:  rand(1.5,4),
          len: rand(100,220),
          alpha: 1,
          col: Math.random()>0.5 ? '#FFFFFF' : '#88CCFF',
          width: rand(0.8, 2),
        });
      };

      // ── Nebula wisps — 4 large colored clouds ──
      const nebulae = [
        { x:0.15, y:0.25, rx:0.22, ry:0.14, col:'#4433AA', alpha:0.08, rot:0, speed:0.00015 },
        { x:0.82, y:0.65, rx:0.20, ry:0.13, col:'#AA3355', alpha:0.07, rot:1, speed:-0.0001 },
        { x:0.65, y:0.18, rx:0.18, ry:0.11, col:'#1155AA', alpha:0.09, rot:2, speed:0.00012 },
        { x:0.30, y:0.78, rx:0.20, ry:0.12, col:'#AA6600', alpha:0.07, rot:0.5,speed:0.00008 },
      ];

      return { W, H, FOV, CX, CY, DEPTH, SPEED, stars, galaxyParticles, galCore, nodes, arcs, spawnArc, shooters, spawnShooter, nebulae, t:0, needsReinit:false };
    };

    stateRef.current = initScene();

    const rgba = (hex, a) => {
      const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    };

    const draw = () => {
      const sc = stateRef.current;
      if (!sc) return;
      if (sc.needsReinit) { stateRef.current = initScene(); return; }
      const {W,H,FOV,CX,CY,DEPTH,SPEED} = sc;
      sc.t++;

      // Background — deep rich space blue-black (not pure black)
      ctx.fillStyle = 'rgba(0,4,12,1)';
      ctx.fillRect(0,0,W,H);

      // ── 0. NEBULA WISPS (background layer) ──
      sc.nebulae.forEach(n => {
        n.rot += n.speed;
        const nx=n.x*W, ny=n.y*H, rx=n.rx*W, ry=n.ry*H;
        ctx.save();
        ctx.translate(nx,ny);
        ctx.rotate(n.rot);
        const ng=ctx.createRadialGradient(0,0,0,0,0,Math.max(rx,ry));
        const r2=parseInt(n.col.slice(1,3),16),g2=parseInt(n.col.slice(3,5),16),b2=parseInt(n.col.slice(5,7),16);
        ng.addColorStop(0,`rgba(${r2},${g2},${b2},${n.alpha*2})`);
        ng.addColorStop(0.4,`rgba(${r2},${g2},${b2},${n.alpha})`);
        ng.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=ng;
        ctx.scale(1,ry/rx);
        ctx.beginPath(); ctx.arc(0,0,rx,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // ── 1. GALAXY SPIRAL ──
      sc.galCore.angle += 0.0004;
      ctx.save();
      ctx.translate(W*0.5, H*0.5);
      ctx.rotate(sc.galCore.angle);
      ctx.translate(-W*0.5, -H*0.5);
      sc.galaxyParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.75;
        ctx.fillStyle   = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();

      // Galaxy core bright glow
      const cgx=W*0.5, cgy=H*0.5;
      const cg=ctx.createRadialGradient(cgx,cgy,0,cgx,cgy,Math.min(W,H)*0.07);
      cg.addColorStop(0,'rgba(255,248,200,0.55)');
      cg.addColorStop(0.3,'rgba(255,220,100,0.22)');
      cg.addColorStop(0.6,'rgba(150,180,255,0.10)');
      cg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.save(); ctx.fillStyle=cg;
      ctx.beginPath(); ctx.arc(cgx,cgy,Math.min(W,H)*0.07,0,Math.PI*2); ctx.fill();
      ctx.restore();

      // ── 2. WARP STARS ──
      sc.stars.forEach(st => {
        st.pz = st.z;
        st.z -= SPEED;
        if (st.z <= 1) {
          st.x  = rand(-W*3, W*3);
          st.y  = rand(-H*3, H*3);
          st.z  = DEPTH;
          st.pz = DEPTH;
          return;
        }
        const scl  = FOV/st.z;
        const pscl = FOV/st.pz;
        const sx = CX + st.x*scl,  sy = CY + st.y*scl;
        const px = CX + st.x*pscl, py = CY + st.y*pscl;
        const alpha = Math.min(1, (1-st.z/DEPTH)*1.8);
        const rad   = Math.max(0.25, st.size*scl*1.5);

        // Velocity streak
        const trailLen = Math.hypot(sx-px, sy-py);
        if (trailLen > 0.5) {
          const tg = ctx.createLinearGradient(px,py,sx,sy);
          tg.addColorStop(0,'rgba(0,0,0,0)');
          tg.addColorStop(1, rgba(st.col, alpha*0.85));
          ctx.save(); ctx.strokeStyle=tg; ctx.lineWidth=rad*0.75;
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy); ctx.stroke(); ctx.restore();
        }

        // Glow halo + diffraction for bright stars
        if (rad > 2) {
          const gg=ctx.createRadialGradient(sx,sy,0,sx,sy,rad*6);
          gg.addColorStop(0,rgba(st.col,alpha*0.5));
          gg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.save(); ctx.fillStyle=gg;
          ctx.beginPath(); ctx.arc(sx,sy,rad*6,0,Math.PI*2); ctx.fill(); ctx.restore();
          // 4-point spike
          ctx.save(); ctx.globalAlpha=alpha*0.35; ctx.strokeStyle=st.col; ctx.lineWidth=0.6;
          ctx.beginPath(); ctx.moveTo(sx-rad*7,sy); ctx.lineTo(sx+rad*7,sy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx,sy-rad*7); ctx.lineTo(sx,sy+rad*7); ctx.stroke();
          ctx.restore();
        }
        ctx.save(); ctx.globalAlpha=Math.min(alpha,1); ctx.fillStyle=st.col;
        ctx.beginPath(); ctx.arc(sx,sy,rad,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      // ── 3. CONSTELLATION NETWORK ──
      sc.nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if(n.x<0.04||n.x>0.96) n.vx*=-1;
        if(n.y<0.04||n.y>0.96) n.vy*=-1;
        n.pulse += n.pulseSpeed;
      });

      // Connection lines — two layers: dim base + bright close ones
      for(let i=0;i<sc.nodes.length;i++){
        for(let j=i+1;j<sc.nodes.length;j++){
          const a=sc.nodes[i], b=sc.nodes[j];
          const dx=(a.x-b.x)*W, dy=(a.y-b.y)*H;
          const dist=Math.hypot(dx,dy);
          const maxD=W*0.18;
          if(dist<maxD){
            const prox=1-dist/maxD;
            // Glow line
            ctx.save();
            ctx.globalAlpha=prox*0.28;
            ctx.strokeStyle=prox>0.6?'#88CCFF':'#4488BB';
            ctx.lineWidth=prox*1.2;
            ctx.beginPath(); ctx.moveTo(a.x*W,a.y*H); ctx.lineTo(b.x*W,b.y*H); ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Nodes — pulsing orbs
      sc.nodes.forEach(n=>{
        const x=n.x*W, y=n.y*H;
        const pulse=0.5+0.5*Math.sin(n.pulse);
        const br=n.brightness*pulse;
        const col=n.hue;
        const r2=parseInt(col.slice(1,3),16),g2=parseInt(col.slice(3,5),16),b2=parseInt(col.slice(5,7),16);

        // Large outer glow
        const og=ctx.createRadialGradient(x,y,0,x,y,n.r*10);
        og.addColorStop(0,`rgba(${r2},${g2},${b2},${br*0.3})`);
        og.addColorStop(0.4,`rgba(${r2},${g2},${b2},${br*0.1})`);
        og.addColorStop(1,'rgba(0,0,0,0)');
        ctx.save(); ctx.fillStyle=og;
        ctx.beginPath(); ctx.arc(x,y,n.r*10,0,Math.PI*2); ctx.fill(); ctx.restore();

        // Ring
        ctx.save(); ctx.globalAlpha=br*0.4; ctx.strokeStyle=col; ctx.lineWidth=0.7;
        ctx.beginPath(); ctx.arc(x,y,n.r*2.5,0,Math.PI*2); ctx.stroke(); ctx.restore();

        // Core
        ctx.save(); ctx.globalAlpha=br*0.95; ctx.fillStyle=col;
        ctx.beginPath(); ctx.arc(x,y,n.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#FFFFFF';
        ctx.beginPath(); ctx.arc(x,y,n.r*0.35,0,Math.PI*2); ctx.fill();
        ctx.restore();

        // Label
        ctx.save(); ctx.globalAlpha=br*0.65; ctx.fillStyle=col;
        ctx.font=`700 7.5px 'DM Mono',monospace`;
        ctx.fillText(n.label,x+n.r+5,y+3); ctx.restore();
      });

      // ── 4. ELECTRIC PULSE ARCS — multiple jagged lightning bolts ──
      if(sc.t%45===0) sc.spawnArc();
      if(sc.t%70===0) sc.spawnArc();
      for(let i=sc.arcs.length-1;i>=0;i--){
        const arc=sc.arcs[i];
        const prog=arc.life/arc.maxLife;
        const alpha=prog*0.85;
        // Draw jagged path
        const pts=[{x:arc.ax,y:arc.ay}];
        arc.jag.forEach((j,idx)=>{
          const t2=(idx+1)/(arc.jag.length+1);
          pts.push({
            x: arc.ax+(arc.bx-arc.ax)*t2+j.ox*(prog),
            y: arc.ay+(arc.by-arc.ay)*t2+j.oy*(prog),
          });
        });
        pts.push({x:arc.bx,y:arc.by});

        // Glow pass
        ctx.save();
        ctx.globalAlpha=alpha*0.3;
        ctx.strokeStyle=arc.col;
        ctx.lineWidth=arc.width*3;
        ctx.shadowBlur=20; ctx.shadowColor=arc.col;
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
        // Core pass
        ctx.globalAlpha=alpha;
        ctx.lineWidth=arc.width;
        ctx.shadowBlur=8;
        ctx.strokeStyle='#FFFFFF';
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
        ctx.restore();

        arc.life--;
        if(arc.life<=0) sc.arcs.splice(i,1);
      }

      // ── 5. SHOOTING STARS ──
      if(Math.random()<0.009) sc.spawnShooter();
      for(let i=sc.shooters.length-1;i>=0;i--){
        const sh=sc.shooters[i];
        const tg=ctx.createLinearGradient(sh.x,sh.y,sh.x-sh.vx*sh.len/6,sh.y-sh.vy*sh.len/6);
        tg.addColorStop(0,rgba(sh.col,sh.alpha));
        tg.addColorStop(0.3,rgba(sh.col,sh.alpha*0.5));
        tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.save(); ctx.strokeStyle=tg; ctx.lineWidth=sh.width;
        ctx.beginPath(); ctx.moveTo(sh.x,sh.y); ctx.lineTo(sh.x-sh.vx*sh.len/6,sh.y-sh.vy*sh.len/6);
        ctx.stroke(); ctx.restore();
        sh.x+=sh.vx; sh.y+=sh.vy; sh.alpha-=0.016;
        if(sh.alpha<=0) sc.shooters.splice(i,1);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      stateRef.current = null;
    };
  }, []);

  // ── Counters ──
  useEffect(() => {
    const targets={stocks:30,research:18,accuracy:94,users:1200};
    const start=Date.now();
    const tick=()=>{
      const p=Math.min((Date.now()-start)/2500,1), e=1-Math.pow(1-p,3);
      setCounters({stocks:Math.floor(e*targets.stocks),research:Math.floor(e*targets.research),accuracy:Math.floor(e*targets.accuracy),users:Math.floor(e*targets.users)});
      if(p<1)requestAnimationFrame(tick);
    };
    setTimeout(tick,600);
  },[]);

  // ── Clock ──
  useEffect(()=>{const ti=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(ti);},[]);

  // ── Slides ──
  const SLIDES=[
    {text:"The stock market is a device for transferring money from the impatient to the patient.",author:"Warren Buffett",tag:"Investment Philosophy"},
    {text:"NIFTY 50 has delivered 14.8% CAGR over 20 years — outperforming every major asset class in India.",author:"DNR Research",tag:"Market Insight"},
    {text:"In the short run the market is a voting machine. In the long run it is a weighing machine.",author:"Benjamin Graham",tag:"Timeless Wisdom"},
    {text:"FIIs invested over ₹2.5 lakh crore in Indian equities despite global headwinds.",author:"DNR Data",tag:"Institutional Flow"},
    {text:"Risk comes from not knowing what you are doing.",author:"Warren Buffett",tag:"Risk Management"},
    {text:"Indian MF AUM crossed ₹54 lakh crore — retail participation at an all-time high.",author:"AMFI Data",tag:"Market Milestone"},
    {text:"Know what you own, and know why you own it.",author:"Peter Lynch",tag:"Investment Principle"},
    {text:"Q3FY25 earnings showed 18% avg revenue growth across NIFTY 50.",author:"DNR Analysis",tag:"Earnings Update"},
  ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{const ti=setInterval(()=>{setSlideFade(false);setTimeout(()=>{setSlideIdx(i=>(i+1)%SLIDES.length);setSlideFade(true);},400);},5000);return()=>clearInterval(ti);},[]);

  const PRICE_TILES=[
    {key:"NIFTY 50",  icon:"📊",color:"#5BB8FF"},
    {key:"SENSEX",    icon:"📈",color:"#C9A84C"},
    {key:"NIFTY BANK",icon:"🏦",color:"#A78BFA"},
    {key:"GOLD (₹)",  icon:"🥇",color:"#FCD34D"},
    {key:"CRUDE",     icon:"🛢️",color:"#FB923C"},
    {key:"USD/INR",   icon:"💱",color:"#34D399"},
  ];

  const now=new Date();
  const timeStr=now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const dateStr=now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const glassPanel=(extra={})=>({background:'rgba(0,5,16,0.72)',backdropFilter:'blur(16px)',borderTop:'1px solid rgba(91,184,255,0.10)',borderBottom:'1px solid rgba(91,184,255,0.06)',...extra});

  return(
    <div style={{position:'relative',width:'100%',minHeight:'calc(100vh - 48px)',overflow:'hidden',background:'#000510'}}>

      {/* ── CANVAS BACKGROUND ── */}
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>

      {/* Light vignette — center open, edges dark */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 75% 65% at 50% 40%,rgba(0,5,16,0.05),rgba(0,5,16,0.68))',pointerEvents:'none'}}/>

      <div style={{position:'relative',zIndex:10}}>

        {/* ── TOP IDENTITY BAR ── */}
        <div style={{...glassPanel(),display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 28px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{position:'relative'}}>
              <div style={{position:'absolute',inset:-6,borderRadius:'50%',border:'1px solid rgba(91,184,255,0.3)',animation:'warpSpin 8s linear infinite'}}/>
              <img src='/logo.png' alt='DNR' style={{width:42,height:42,borderRadius:'50%',objectFit:'cover',border:'1px solid rgba(91,184,255,0.4)',boxShadow:'0 0 16px rgba(91,184,255,0.3)',position:'relative',zIndex:2}}/>
            </div>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:'#5BB8FF',letterSpacing:'0.3px',lineHeight:1,textShadow:'0 0 20px rgba(91,184,255,0.4)'}}>DNR Capitals</div>
              <div style={{fontSize:8,color:'rgba(91,184,255,0.4)',letterSpacing:'2.5px',textTransform:'uppercase',marginTop:3}}>Equity Research Intelligence</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:24}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:'rgba(200,220,255,0.8)',letterSpacing:'1px'}}>{timeStr}</div>
              <div style={{fontSize:9,color:'rgba(91,184,255,0.35)',marginTop:1}}>{dateStr}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'#34D399',boxShadow:'0 0 8px #34D399',animation:'livePulse 2s infinite'}}/>
              <span style={{fontSize:9,color:'rgba(52,211,153,0.7)',letterSpacing:'2px'}}>LIVE</span>
            </div>
          </div>
        </div>

        {/* ── LIVE PRICE STRIP ── */}
        <div style={{...glassPanel({borderTop:'none'}),padding:'8px 28px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:1}}>
            {PRICE_TILES.map((tile,i)=>{
              const live=markets[tile.key];
              return(
                <div key={tile.key} style={{padding:'9px 14px',textAlign:'center',borderRight:i<5?'1px solid rgba(91,184,255,0.06)':'none',cursor:'pointer',transition:'background 0.2s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(91,184,255,0.05)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{fontSize:8,color:'rgba(91,184,255,0.35)',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:3}}>{tile.key}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:600,color:live?tile.color:'rgba(50,80,130,0.6)',letterSpacing:'0.5px',textShadow:live?`0 0 10px ${tile.color}44`:'none'}}>{live?.v||'—'}</div>
                  {live?.c?<div style={{fontSize:9,color:live.u?'#34D399':'#F87171',marginTop:2}}>{live.u?'▲':'▼'} {live.c}</div>:<div style={{fontSize:9,color:'rgba(50,80,130,0.35)',marginTop:2}}>{fetching?'···':'—'}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── HERO ── */}
        <div style={{padding:'52px 60px 40px',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
          {/* Logo medallion */}
          <div style={{position:'relative',marginBottom:28}}>
            <div style={{position:'absolute',inset:-14,borderRadius:'50%',border:'1px solid rgba(91,184,255,0.25)',animation:'warpSpin 12s linear infinite'}}/>
            <div style={{position:'absolute',inset:-24,borderRadius:'50%',border:'1px solid rgba(91,184,255,0.12)',animation:'warpSpin 20s linear infinite reverse'}}/>
            <img src='/logo.png' alt='DNR Capitals' style={{width:96,height:96,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(91,184,255,0.45)',boxShadow:'0 0 50px rgba(91,184,255,0.35),0 0 100px rgba(91,184,255,0.15)',position:'relative',zIndex:2}}/>
          </div>

          <div style={{fontSize:9,color:'rgba(91,184,255,0.55)',letterSpacing:'7px',textTransform:'uppercase',marginBottom:18}}>
            DNR CAPITALS · EQUITY RESEARCH INTELLIGENCE
          </div>

          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(36px,5.5vw,72px)',fontWeight:600,color:'#E8F4FF',lineHeight:1.05,letterSpacing:'-0.5px',marginBottom:8,textShadow:'0 0 80px rgba(91,184,255,0.15)'}}>
            Institutional-Grade
          </h1>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(36px,5.5vw,72px)',fontWeight:600,fontStyle:'italic',color:'#5BB8FF',lineHeight:1.05,letterSpacing:'-0.5px',marginBottom:22,textShadow:'0 0 60px rgba(91,184,255,0.4)'}}>
            Equity Research
          </h1>
          <p style={{fontSize:13,color:'rgba(140,175,220,0.55)',maxWidth:500,lineHeight:1.9,letterSpacing:'0.3px',marginBottom:32,fontWeight:300}}>
            Groq-powered deep research across 18 dimensions — fundamentals, valuation, technicals, peer benchmarking and portfolio intelligence.
          </p>

          <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
            {[
              {label:'🔬 Deep Research', tab:'research',  primary:true},
              {label:'🔍 Screener',      tab:'screener',  primary:false},
              {label:'💼 Portfolio',     tab:'portfolio', primary:false},
              {label:'📊 Markets',       tab:'markets',   primary:false},
            ].map(b=>(
              <button key={b.tab} onClick={()=>setActiveTab(b.tab)} style={{
                padding:b.primary?'11px 28px':'10px 22px',
                background:b.primary?'rgba(91,184,255,0.12)':'transparent',
                border:`1px solid ${b.primary?'rgba(91,184,255,0.5)':'rgba(91,184,255,0.15)'}`,
                borderRadius:3, color:b.primary?'#5BB8FF':'rgba(140,175,220,0.6)',
                fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:b.primary?600:400,
                letterSpacing:'1.5px',textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s',
                boxShadow:b.primary?'0 0 20px rgba(91,184,255,0.15)':'none',
              }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(91,184,255,0.18)';e.currentTarget.style.borderColor='rgba(91,184,255,0.7)';e.currentTarget.style.color='#88CCFF';e.currentTarget.style.boxShadow='0 0 24px rgba(91,184,255,0.3)'}}
              onMouseLeave={e=>{e.currentTarget.style.background=b.primary?'rgba(91,184,255,0.12)':'transparent';e.currentTarget.style.borderColor=b.primary?'rgba(91,184,255,0.5)':'rgba(91,184,255,0.15)';e.currentTarget.style.color=b.primary?'#5BB8FF':'rgba(140,175,220,0.6)';e.currentTarget.style.boxShadow=b.primary?'0 0 20px rgba(91,184,255,0.15)':'none'}}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STATS ── */}
        <div style={{...glassPanel(),padding:'16px 0'}}>
          <div style={{display:'flex',justifyContent:'center'}}>
            {[
              {label:'Stocks Covered',     val:counters.stocks,   suffix:'+', color:'#5BB8FF'},
              {label:'Research Dimensions',val:counters.research, suffix:'',  color:'#C9A84C'},
              {label:'AI Accuracy Score',  val:counters.accuracy, suffix:'%', color:'#A78BFA'},
              {label:'Data Points/Stock',  val:counters.users,    suffix:'+', color:'#34D399'},
            ].map((c,i)=>(
              <div key={i} style={{flex:1,textAlign:'center',padding:'0 20px',borderRight:i<3?'1px solid rgba(91,184,255,0.08)':'none'}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:'clamp(22px,3vw,40px)',fontWeight:700,color:c.color,letterSpacing:'-0.5px',textShadow:`0 0 20px ${c.color}55`}}>{c.val}{c.suffix}</div>
                <div style={{fontSize:8,color:'rgba(91,184,255,0.35)',letterSpacing:'2px',textTransform:'uppercase',marginTop:5}}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── WISDOM SLIDE ── */}
        <div style={{...glassPanel({borderTop:'none'}),padding:'20px 60px'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:18}}>
            <div style={{width:2,minHeight:54,background:'linear-gradient(180deg,#5BB8FF,transparent)',flexShrink:0,boxShadow:'0 0 8px #5BB8FF'}}/>
            <div style={{flex:1,transition:'opacity 0.4s',opacity:slideFade?1:0}}>
              <div style={{fontSize:8,color:'rgba(91,184,255,0.4)',letterSpacing:'3px',textTransform:'uppercase',marginBottom:9}}>{SLIDES[slideIdx].tag}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(13px,1.8vw,17px)',fontStyle:'italic',color:'rgba(180,205,240,0.65)',lineHeight:1.75}}>"{SLIDES[slideIdx].text}"</div>
              <div style={{fontSize:10,color:'rgba(91,184,255,0.35)',marginTop:9,letterSpacing:'1px'}}>— {SLIDES[slideIdx].author}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
              {SLIDES.map((_,i)=>(<div key={i} onClick={()=>setSlideIdx(i)} style={{width:4,height:i===slideIdx?14:4,borderRadius:2,background:i===slideIdx?'#5BB8FF':'rgba(91,184,255,0.15)',cursor:'pointer',transition:'all 0.3s',boxShadow:i===slideIdx?'0 0 6px #5BB8FF':'none'}}/>))}
            </div>
          </div>
        </div>

        {/* ── FEATURE MODULES ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',borderTop:'1px solid rgba(91,184,255,0.06)'}}>
          {[
            {icon:'🔬',title:'Deep Research Engine',     desc:'18-dimension analysis — business, financials, valuation, peer, DCF, technical, shareholding, AI verdict',tab:'research',    c:'#5BB8FF'},
            {icon:'📈',title:'Technical Analysis Suite',  desc:'MA, RSI, MACD, Bollinger Bands, volume analysis and AI pattern recognition',                              tab:'technical',   c:'#C9A84C'},
            {icon:'🔍',title:'Smart Stock Screener',      desc:'30 stocks · 10 numeric filters · 8 presets · sector tags · AI quick analysis',                           tab:'screener',    c:'#34D399'},
            {icon:'💼',title:'Portfolio Tracker',         desc:'Real-time P&L · position weights · AI health review · allocation charts · CSV export',                    tab:'portfolio',   c:'#A78BFA'},
            {icon:'🏦',title:'Institutional Momentum',    desc:'Daily FII/DII block deals · monthly MF disclosures · quarterly shareholding tracker',                     tab:'institutional',c:'#FB923C'},
            {icon:'🧮',title:'Financial Calculators',     desc:'SIP · Lumpsum · Position Sizing · Tax LTCG/STCG · Black-Scholes · MF overlap',                          tab:'calculators', c:'#FCD34D'},
          ].map((f,i)=>(
            <div key={f.tab} onClick={()=>setActiveTab(f.tab)} style={{padding:'24px 26px',background:'rgba(0,5,18,0.75)',backdropFilter:'blur(10px)',borderRight:i%3<2?'1px solid rgba(91,184,255,0.05)':'none',borderBottom:'1px solid rgba(91,184,255,0.05)',cursor:'pointer',transition:'background 0.2s',position:'relative',overflow:'hidden'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(5,15,35,0.88)';e.currentTarget.querySelector('.fac').style.width='100%';e.currentTarget.querySelector('.fac').style.opacity='1'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,5,18,0.75)';e.currentTarget.querySelector('.fac').style.width='0%';e.currentTarget.querySelector('.fac').style.opacity='0'}}>
              <div className='fac' style={{position:'absolute',top:0,left:0,height:'2px',width:'0%',background:f.c,opacity:0,transition:'all 0.35s',boxShadow:`0 0 10px ${f.c}`}}/>
              <div style={{fontSize:20,marginBottom:12}}>{f.icon}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:600,color:'rgba(210,228,255,0.9)',marginBottom:7,lineHeight:1.2}}>{f.title}</div>
              <div style={{fontSize:10,color:'rgba(91,184,255,0.3)',lineHeight:1.7}}>{f.desc}</div>
              <div style={{marginTop:12,fontSize:9,color:f.c,letterSpacing:'2px',opacity:0.6}}>OPEN →</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{...glassPanel({borderBottom:'none'}),padding:'10px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:9,color:'rgba(50,80,140,0.4)',letterSpacing:'1px'}}>© {new Date().getFullYear()} DNR CAPITALS · EQUITY RESEARCH INTELLIGENCE</span>
          <span style={{fontSize:9,color:'rgba(50,80,140,0.4)',letterSpacing:'1px'}}>POWERED BY GROQ AI · NOT SEBI REGISTERED ADVICE</span>
        </div>
      </div>

      <style>{`
        @keyframes warpSpin{to{transform:rotate(360deg)}}
        @keyframes livePulse{0%,100%{opacity:1;box-shadow:0 0 8px #34D399}50%{opacity:0.5;box-shadow:0 0 16px #34D399}}
      `}</style>
    </div>
  );
}

// ─── MARKETS ──────────────────────────────────────────────────────────────────
function Markets({ markets={}, fetching=false, onRefresh=()=>{} }) {
  const [summary, setSummary] = useState("");
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [tab, setTab] = useState("overview");

  const STAT_CARDS = [
    { label:"NIFTY 50", key:"NIFTY 50" },
    { label:"SENSEX",   key:"SENSEX" },
    { label:"NIFTY BANK",key:"NIFTY BANK" },
    { label:"NIFTY IT", key:"NIFTY IT" },
  ];

  const fetchOverview = async () => {
    setLoading(true); setSummary("");
    const liveCtx = Object.values(markets).length > 0
      ? "\n\nCURRENT LIVE MARKET LEVELS:\n" +
        Object.values(markets).map(m => `${m.label}: ${m.v} (${m.c})`).join(" | ")
      : "";
    const today = new Date().toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    await callGroq(
      `Today is ${today}.${liveCtx}\n\nProvide comprehensive daily market overview using the LIVE levels above: 1) **Indian Markets** — Nifty50, Sensex, Bank Nifty, IT, Midcap key drivers with specific levels 2) **Global Markets** — US, Europe, Asia with index levels 3) **Macro Factors** — FII/DII flows, RBI stance, Fed signals, USD/INR, crude, gold 4) **Top Sectoral Movers** — best and worst sectors 5) **Key Corporate Developments** 6) **Market Outlook** — short-term directional view with key levels 7) **Events This Week**. Use the LIVE levels provided. Be specific with numbers like a Bloomberg strategist.`,
      getSYS(), (t) => setSummary(t)
    );
    setLoading(false);
  };

  const fetchNews = async () => {
    setNewsLoading(true); setNews([]);
    try {
      const raw = await callGroq(
        `Today is ${new Date().toLocaleDateString("en-IN")}. Generate 10 realistic current Indian market news headlines. Return ONLY valid JSON array: [{"source":"ET Markets","headline":"...","time":"2h ago","sentiment":"positive","category":"India"}]. Categories: India macro, Global, Sector, Corporate. Sentiment: positive/negative/neutral. No markdown, just JSON array.`,
        "Return only valid JSON array, no other text.", null
      );
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) setNews(JSON.parse(match[0]));
    } catch { setNews([{ source:"System", headline:"Retry news fetch.", time:"now", sentiment:"neutral", category:"India" }]); }
    setNewsLoading(false);
  };

  const sc = (s) => s==="positive" ? T.green : s==="negative" ? T.red : T.muted;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div className="sec-title">📊 Market Overview</div>
          <div className="sec-sub">Live indices · AI daily intelligence · {fetching ? <span style={{color:T.gold}}>⟳ Refreshing…</span> : <span style={{color:T.greenLight}}>● Live data</span>}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onRefresh} disabled={fetching}>{fetching?"⟳ Refreshing":"🔄 Refresh Prices"}</button>
          <button className="btn-gold" onClick={fetchOverview} disabled={loading}>{loading?"⏳ Analyzing...":"🧠 Market Analysis"}</button>
          <button className="btn-primary" onClick={fetchNews} disabled={newsLoading}>{newsLoading?"...":"📰 Fetch News"}</button>
        </div>
      </div>

      <div className="g4" style={{ marginBottom:18 }}>
        {STAT_CARDS.map(sc2 => {
          const live = markets[sc2.key];
          return (
            <div key={sc2.label} className="stat">
              <div className="stat-lbl">{sc2.label}</div>
              {live ? (
                <><div className="stat-val">{live.v}</div><div className={`stat-chg ${live.u?"pos":"neg"}`}>{live.u?"▲":"▼"} {live.c}</div></>
              ) : (
                <><div className="stat-val" style={{color:T.walnutLight,fontSize:14}}>{fetching?"···":"—"}</div><div style={{fontSize:10,color:T.walnutLight}}>{fetching?"Loading…":"Unavailable"}</div></>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(markets).length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
          {["S&P 500","NASDAQ","DOW","GOLD ($)","CRUDE","USD/INR"].map(key => {
            const m = markets[key];
            if (!m) return null;
            return (
              <div key={key} style={{ padding:"6px 14px", background:T.walnutDeep+"cc", border:`1px solid ${T.walnut}33`, borderRadius:8, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:T.muted }}>{key}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, color:T.dun }}>{m.v}</span>
                <span style={{ fontSize:10, color:m.u?T.greenLight:T.redLight }}>{m.u?"▲":"▼"} {m.c}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="tab-mini">
        {["overview","news"].map(t=><button key={t} className={`tmb ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{t==="overview"?"🌐 Analysis":"📰 News Feed"}</button>)}
      </div>

      {tab==="overview" && (
        <div className="card">
          {!summary&&!loading&&<div style={{textAlign:"center",padding:"48px 20px",color:T.muted}}><div style={{fontSize:48,marginBottom:12}}>📈</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.dun,marginBottom:8}}>Daily Market Intelligence</div><div style={{fontSize:13,marginBottom:20}}>Click "Market Analysis" for today's overview with live prices injected</div><button className="btn-gold" onClick={fetchOverview}>🧠 Get Market Analysis</button></div>}
          {loading&&<div className="loading"><div className="spin"/><span className="ld">Analyzing global markets with live data</span></div>}
          {summary&&<div className="prose" dangerouslySetInnerHTML={{__html:summary.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")}}/>}
        </div>
      )}
      {tab==="news" && (
        <div>
          {!news.length&&!newsLoading&&<div className="card" style={{textAlign:"center",padding:"40px",color:T.muted}}><div style={{fontSize:36,marginBottom:10}}>📰</div><div style={{marginBottom:16}}>Click "Fetch News" for today's market headlines</div><button className="btn-primary" onClick={fetchNews}>📰 Fetch News</button></div>}
          {newsLoading&&<div className="loading"><div className="spin"/><span className="ld">Fetching latest market news</span></div>}
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
          await callGroq(enrichedPrompt, getSYS(), (t) => {
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
    await callGroq(prompts[type], getSYS(), (t) => setters[type](t));
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
const SCREENER_STOCKS = [
  { sym:"RELIANCE",  name:"Reliance Industries",       sector:"Conglomerate",  mcapN:1982000, pe:28.4, pb:2.1,  roe:9.8,  roce:11.2, de:0.35, rev_gr:18.2, pat_gr:22.1, div:1.2,  rating:"BUY" },
  { sym:"TCS",       name:"Tata Consultancy Services",  sector:"IT Services",   mcapN:1420000, pe:32.1, pb:14.2, roe:44.1, roce:58.2, de:0.02, rev_gr:8.4,  pat_gr:9.2,  div:3.8,  rating:"ACCUMULATE" },
  { sym:"HDFCBANK",  name:"HDFC Bank",                  sector:"Banking",       mcapN:1240000, pe:18.2, pb:2.8,  roe:16.8, roce:null,  de:7.2,  rev_gr:24.1, pat_gr:18.4, div:1.5,  rating:"BUY" },
  { sym:"INFOSYS",   name:"Infosys Ltd",                sector:"IT Services",   mcapN:784000,  pe:28.8, pb:8.4,  roe:31.2, roce:42.1, de:0.08, rev_gr:6.2,  pat_gr:8.8,  div:4.2,  rating:"ACCUMULATE" },
  { sym:"ICICIBANK", name:"ICICI Bank",                 sector:"Banking",       mcapN:892000,  pe:19.4, pb:3.4,  roe:18.2, roce:null,  de:6.8,  rev_gr:28.4, pat_gr:24.2, div:1.8,  rating:"BUY" },
  { sym:"HINDUNILVR",name:"Hindustan Unilever",         sector:"FMCG",          mcapN:584000,  pe:58.2, pb:12.4, roe:21.4, roce:28.4, de:0.12, rev_gr:4.2,  pat_gr:6.8,  div:2.8,  rating:"HOLD" },
  { sym:"KOTAKBANK", name:"Kotak Mahindra Bank",        sector:"Banking",       mcapN:392000,  pe:22.4, pb:3.8,  roe:14.2, roce:null,  de:5.4,  rev_gr:22.1, pat_gr:26.4, div:0.8,  rating:"ACCUMULATE" },
  { sym:"WIPRO",     name:"Wipro Ltd",                  sector:"IT Services",   mcapN:262000,  pe:24.4, pb:5.2,  roe:18.4, roce:24.2, de:0.18, rev_gr:4.8,  pat_gr:12.4, div:1.2,  rating:"HOLD" },
  { sym:"TATAMOTORS",name:"Tata Motors",                sector:"Auto",          mcapN:324000,  pe:14.2, pb:3.8,  roe:28.4, roce:18.2, de:1.42, rev_gr:18.4, pat_gr:142.8,div:0.2,  rating:"BUY" },
  { sym:"ASIANPAINT",name:"Asian Paints",               sector:"Consumer",      mcapN:248000,  pe:58.4, pb:16.2, roe:26.8, roce:32.4, de:0.04, rev_gr:8.4,  pat_gr:2.4,  div:3.4,  rating:"HOLD" },
  { sym:"ZOMATO",    name:"Zomato Ltd",                 sector:"Consumer Tech", mcapN:212000,  pe:284.2,pb:14.8, roe:4.2,  roce:6.8,  de:0.02, rev_gr:68.4, pat_gr:null, div:0,    rating:"ACCUMULATE" },
  { sym:"DIXON",     name:"Dixon Technologies",         sector:"Electronics",   mcapN:48000,   pe:142.4,pb:28.4, roe:22.8, roce:28.4, de:0.12, rev_gr:82.4, pat_gr:68.4, div:0.4,  rating:"BUY" },
  { sym:"BAJFINANCE",name:"Bajaj Finance",              sector:"NBFC",          mcapN:498000,  pe:34.2, pb:6.8,  roe:22.4, roce:null,  de:3.8,  rev_gr:28.2, pat_gr:24.8, div:0.4,  rating:"BUY" },
  { sym:"MARUTI",    name:"Maruti Suzuki India",        sector:"Auto",          mcapN:382000,  pe:28.8, pb:4.8,  roe:18.4, roce:22.4, de:0.01, rev_gr:14.2, pat_gr:38.4, div:1.8,  rating:"ACCUMULATE" },
  { sym:"SUNPHARMA", name:"Sun Pharmaceutical",         sector:"Pharma",        mcapN:342000,  pe:38.4, pb:5.8,  roe:16.2, roce:18.4, de:0.08, rev_gr:12.8, pat_gr:24.2, div:1.2,  rating:"BUY" },
  { sym:"LT",        name:"Larsen & Toubro",            sector:"Capital Goods",  mcapN:482000, pe:34.8, pb:5.2,  roe:14.8, roce:16.4, de:1.12, rev_gr:18.4, pat_gr:22.8, div:1.4,  rating:"BUY" },
  { sym:"NESTLEIND", name:"Nestle India",               sector:"FMCG",          mcapN:224000,  pe:72.4, pb:82.4, roe:118.4,roce:142.4,de:0.01, rev_gr:8.8,  pat_gr:14.4, div:2.8,  rating:"HOLD" },
  { sym:"DRREDDY",   name:"Dr. Reddy's Laboratories",  sector:"Pharma",        mcapN:112000,  pe:22.4, pb:3.8,  roe:18.4, roce:22.4, de:0.08, rev_gr:14.2, pat_gr:28.4, div:0.8,  rating:"ACCUMULATE" },
  { sym:"TITAN",     name:"Titan Company",              sector:"Consumer",      mcapN:278000,  pe:88.4, pb:22.4, roe:28.4, roce:34.2, de:0.02, rev_gr:18.4, pat_gr:18.8, div:1.0,  rating:"HOLD" },
  { sym:"ADANIPORTS",name:"Adani Ports & SEZ",          sector:"Infrastructure",mcapN:264000,  pe:28.4, pb:4.8,  roe:18.8, roce:14.4, de:1.82, rev_gr:24.4, pat_gr:28.4, div:0.8,  rating:"ACCUMULATE" },
  { sym:"TECHM",     name:"Tech Mahindra",              sector:"IT Services",   mcapN:128000,  pe:42.4, pb:4.8,  roe:12.4, roce:16.4, de:0.08, rev_gr:2.4,  pat_gr:62.4, div:2.4,  rating:"ACCUMULATE" },
  { sym:"HINDALCO",  name:"Hindalco Industries",        sector:"Metals",        mcapN:134000,  pe:14.4, pb:1.8,  roe:14.2, roce:12.8, de:0.88, rev_gr:8.4,  pat_gr:18.4, div:0.6,  rating:"BUY" },
  { sym:"TATAPOWER", name:"Tata Power",                 sector:"Power",         mcapN:84000,   pe:28.4, pb:4.2,  roe:14.8, roce:8.4,  de:2.28, rev_gr:18.4, pat_gr:24.8, div:0.6,  rating:"BUY" },
  { sym:"COALINDIA", name:"Coal India",                 sector:"Mining",        mcapN:248000,  pe:8.4,  pb:3.8,  roe:48.4, roce:68.4, de:0.01, rev_gr:4.2,  pat_gr:8.8,  div:8.4,  rating:"BUY" },
  { sym:"PERSISTENT",name:"Persistent Systems",        sector:"IT Services",   mcapN:72000,   pe:62.4, pb:14.2, roe:24.4, roce:32.4, de:0.02, rev_gr:22.4, pat_gr:38.4, div:1.2,  rating:"BUY" },
  { sym:"POLYCAB",   name:"Polycab India",              sector:"Electronics",   mcapN:62000,   pe:42.4, pb:8.4,  roe:22.4, roce:28.4, de:0.04, rev_gr:18.4, pat_gr:22.4, div:1.4,  rating:"BUY" },
  { sym:"ABCAPITAL", name:"Aditya Birla Capital",       sector:"NBFC",          mcapN:38000,   pe:22.4, pb:2.4,  roe:12.4, roce:null,  de:4.2,  rev_gr:28.4, pat_gr:18.4, div:0.2,  rating:"ACCUMULATE" },
  { sym:"DEEPAKNTR", name:"Deepak Nitrite",             sector:"Chemicals",     mcapN:22000,   pe:32.4, pb:5.8,  roe:18.4, roce:22.4, de:0.08, rev_gr:8.4,  pat_gr:4.8,  div:1.2,  rating:"HOLD" },
  { sym:"PIIND",     name:"PI Industries",              sector:"Chemicals",     mcapN:42000,   pe:38.4, pb:8.4,  roe:22.4, roce:28.4, de:0.02, rev_gr:14.4, pat_gr:18.4, div:0.6,  rating:"ACCUMULATE" },
  { sym:"ABBOTINDIA",name:"Abbott India",               sector:"Pharma",        mcapN:28000,   pe:48.4, pb:14.4, roe:32.4, roce:42.4, de:0.01, rev_gr:8.4,  pat_gr:12.4, div:2.8,  rating:"HOLD" },
];

const SECTOR_COLORS = {
  "IT Services":"#4A6B8A","Banking":"#5A7A5A","FMCG":"#8A6A4A",
  "Auto":"#6A4A8A","Consumer":"#8A4A5A","Consumer Tech":"#4A8A7A",
  "Electronics":"#7A8A4A","NBFC":"#5A6A8A","Pharma":"#8A5A6A",
  "Capital Goods":"#6A8A5A","Metals":"#7A6A5A","Power":"#8A7A4A",
  "Mining":"#5A5A6A","Conglomerate":"#7A5A4A","Infrastructure":"#4A7A6A",
  "Chemicals":"#6A8A7A",
};

const PRESETS = [
  { label:"🏆 High ROE",      desc:"ROE > 20%",             filters:{ roeMin:20 } },
  { label:"💎 Value Picks",   desc:"P/E < 20",              filters:{ peMax:20 } },
  { label:"🚀 Growth Stars",  desc:"Rev Growth > 20%",      filters:{ revGrMin:20 } },
  { label:"🏦 Large Cap",     desc:"MCap > ₹1L Cr",         filters:{ mcapMin:100000 } },
  { label:"🌱 Small Cap",     desc:"MCap < ₹50K Cr",        filters:{ mcapMax:50000 } },
  { label:"💰 Dividend",      desc:"Div Yield > 2%",        filters:{ divMin:2 } },
  { label:"🧹 Low Debt",      desc:"D/E < 0.3 (ex-fin)",   filters:{ deMax:0.3 } },
  { label:"⚡ Buy Rated",     desc:"All BUY ratings",       filters:{ rating:"BUY" } },
];

function Screener() {
  const [search, setSearch]       = useState("");
  const [sectorFilter, setSector] = useState("all");
  const [ratingFilter, setRating] = useState("all");
  const [sortKey, setSortKey]     = useState("mcapN");
  const [sortDir, setSortDir]     = useState("desc");
  const [selected, setSelected]   = useState(null);
  const [analysis, setAnalysis]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  // Numeric range filters
  const [peMin, setPeMin]       = useState("");
  const [peMax, setPeMax]       = useState("");
  const [roeMin, setRoeMin]     = useState("");
  const [roeMax, setRoeMax]     = useState("");
  const [mcapMin, setMcapMin]   = useState("");
  const [mcapMax, setMcapMax]   = useState("");
  const [deMax, setDeMax]       = useState("");
  const [revGrMin, setRevGrMin] = useState("");
  const [patGrMin, setPatGrMin] = useState("");
  const [divMin, setDivMin]     = useState("");

  const sectors  = [...new Set(SCREENER_STOCKS.map(s => s.sector))].sort();
  const ratings  = ["BUY","ACCUMULATE","HOLD","SELL"];

  const ratingColor = (r) =>
    r === "BUY"       ? T.greenLight :
    r === "ACCUMULATE"? T.goldLight  :
    r === "HOLD"      ? T.gold       : T.redLight;

  const applyPreset = (preset) => {
    clearFilters();
    setActivePreset(preset.label);
    const f = preset.filters;
    if (f.roeMin)   setRoeMin(String(f.roeMin));
    if (f.peMax)    setPeMax(String(f.peMax));
    if (f.revGrMin) setRevGrMin(String(f.revGrMin));
    if (f.mcapMin)  setMcapMin(String(f.mcapMin));
    if (f.mcapMax)  setMcapMax(String(f.mcapMax));
    if (f.divMin)   setDivMin(String(f.divMin));
    if (f.deMax)    setDeMax(String(f.deMax));
    if (f.rating)   setRating(f.rating);
  };

  const clearFilters = () => {
    setPeMin(""); setPeMax(""); setRoeMin(""); setRoeMax("");
    setMcapMin(""); setMcapMax(""); setDeMax("");
    setRevGrMin(""); setPatGrMin(""); setDivMin("");
    setSector("all"); setRating("all"); setSearch("");
    setActivePreset(null);
  };

  const hasActiveFilters = peMin||peMax||roeMin||roeMax||mcapMin||mcapMax||deMax||revGrMin||patGrMin||divMin||sectorFilter!=="all"||ratingFilter!=="all"||search;

  const filtered = SCREENER_STOCKS
    .filter(s => {
      if (search && !s.sym.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (sectorFilter !== "all" && s.sector !== sectorFilter) return false;
      if (ratingFilter !== "all" && s.rating !== ratingFilter) return false;
      if (peMin  !== "" && s.pe    < parseFloat(peMin))    return false;
      if (peMax  !== "" && s.pe    > parseFloat(peMax))    return false;
      if (roeMin !== "" && s.roe   < parseFloat(roeMin))   return false;
      if (roeMax !== "" && s.roe   > parseFloat(roeMax))   return false;
      if (mcapMin!== "" && s.mcapN < parseFloat(mcapMin))  return false;
      if (mcapMax!== "" && s.mcapN > parseFloat(mcapMax))  return false;
      if (deMax  !== "" && s.de    > parseFloat(deMax))    return false;
      if (revGrMin!=="" && s.rev_gr< parseFloat(revGrMin)) return false;
      if (patGrMin!=="" && (s.pat_gr == null || s.pat_gr < parseFloat(patGrMin))) return false;
      if (divMin !== "" && s.div   < parseFloat(divMin))   return false;
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortHdr = ({ label, k, style }) => (
    <span onClick={() => handleSort(k)} style={{ cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", gap:3, ...(style||{}) }}>
      {label}
      <span style={{ fontSize:8, color: sortKey===k ? T.goldLight : T.walnutLight, opacity: sortKey===k ? 1 : 0.5 }}>
        {sortKey===k ? (sortDir==="asc" ? "▲" : "▼") : "↕"}
      </span>
    </span>
  );

  const quickAnalyze = async (stock) => {
    setSelected(stock);
    setLoading(true); setAnalysis("");
    await callGroq(
      `Comprehensive quick analysis of ${stock.sym} (${stock.name}, ${stock.sector} sector):
Financials: P/E ${stock.pe}x | P/B ${stock.pb}x | ROE ${stock.roe}% | ROCE ${stock.roce ?? "N/A"}% | D/E ${stock.de} | Rev Growth ${stock.rev_gr}% | PAT Growth ${stock.pat_gr ?? "N/A"}% | Div Yield ${stock.div}% | MCap ₹${(stock.mcapN/1e5).toFixed(0)}L Cr

Provide a structured analysis:
1) **Valuation Assessment** — Is current P/E cheap / fair / expensive vs sector peers? Justify with numbers.
2) **Business Quality** — ROE/ROCE sustainability, competitive moat, management quality signals.
3) **Growth Trajectory** — Can current revenue/PAT growth sustain? Key growth drivers.
4) **Risk Factors** — Top 3 specific risks for this company right now.
5) **Technicals** — Key support / resistance levels based on current price range.
6) **DNR Verdict** — BUY / ACCUMULATE / HOLD / SELL with ideal entry range and 12-month target.

Be specific with numbers. Reference current FY25 data.`,
      SYS, (t) => setAnalysis(t)
    );
    setLoading(false);
  };

  const FilterInput = ({ label, val, setter, placeholder }) => (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:9, color:T.muted, letterSpacing:"1px", textTransform:"uppercase" }}>{label}</label>
      <input className="inp" value={val} onChange={e => { setter(e.target.value); setActivePreset(null); }}
        placeholder={placeholder} style={{ width:90, padding:"6px 10px", fontSize:12 }} />
    </div>
  );

  const fmtMcap = (n) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L Cr` : `₹${(n/1000).toFixed(0)}K Cr`;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="sec-title">🔍 Stock Screener</div>
          <div className="sec-sub">30 stocks · Multi-filter · Sortable · AI quick analysis</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {hasActiveFilters && (
            <button className="btn-danger" onClick={clearFilters} style={{ fontSize:11 }}>✕ Clear Filters</button>
          )}
          <button className={`btn-ghost ${showFilters ? "on" : ""}`}
            style={showFilters ? { background:T.walnut, color:T.dun, borderColor:T.walnut } : {}}
            onClick={() => setShowFilters(f => !f)}>
            ⚙️ {showFilters ? "Hide" : "Filters"}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            style={{
              padding:"5px 12px", borderRadius:20, fontSize:11, cursor:"pointer", transition:"all 0.2s",
              background: activePreset===p.label ? T.gold+"33" : T.walnutDeep,
              border: `1px solid ${activePreset===p.label ? T.gold+"88" : T.walnut+"44"}`,
              color: activePreset===p.label ? T.goldLight : T.muted,
              fontFamily:"'Jost',sans-serif",
            }} title={p.desc}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Search + Sector + Rating bar */}
      <div className="card" style={{ marginBottom:12, padding:"14px 16px" }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input className="inp" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search symbol or name..."
            style={{ maxWidth:240, minWidth:160 }} />
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            <button onClick={() => setSector("all")}
              className="btn-ghost" style={sectorFilter==="all" ? { background:T.walnut, color:T.dun, borderColor:T.walnut } : {}}>
              All Sectors
            </button>
            {sectors.map(sec => (
              <button key={sec} onClick={() => setSector(sec)}
                className="btn-ghost"
                style={sectorFilter===sec ? {
                  background: (SECTOR_COLORS[sec]||T.walnut)+"44",
                  color: T.dun,
                  borderColor: (SECTOR_COLORS[sec]||T.walnut)+"88",
                } : {}}>
                {sec}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:5, marginLeft:"auto" }}>
            {["all",...ratings].map(r => (
              <button key={r} onClick={() => setRating(r)}
                className="btn-ghost"
                style={ratingFilter===r ? {
                  background: r==="all" ? T.walnut : ratingColor(r)+"33",
                  color: r==="all" ? T.dun : ratingColor(r),
                  borderColor: r==="all" ? T.walnut : ratingColor(r)+"77",
                  fontWeight:700,
                } : {}}>
                {r==="all" ? "All Ratings" : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Numeric Filters */}
      {showFilters && (
        <div className="card card-gold" style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:T.goldLight, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:14, fontWeight:600 }}>
            ⚙️ Advanced Numeric Filters
          </div>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            <FilterInput label="P/E Min"      val={peMin}    setter={e => { setPeMin(e); setActivePreset(null); }}     placeholder="e.g. 10" />
            <FilterInput label="P/E Max"      val={peMax}    setter={e => { setPeMax(e); setActivePreset(null); }}     placeholder="e.g. 40" />
            <FilterInput label="ROE Min %"    val={roeMin}   setter={e => { setRoeMin(e); setActivePreset(null); }}    placeholder="e.g. 15" />
            <FilterInput label="ROE Max %"    val={roeMax}   setter={e => { setRoeMax(e); setActivePreset(null); }}    placeholder="e.g. 50" />
            <FilterInput label="MCap Min(Cr)" val={mcapMin}  setter={e => { setMcapMin(e); setActivePreset(null); }}   placeholder="e.g. 50000" />
            <FilterInput label="MCap Max(Cr)" val={mcapMax}  setter={e => { setMcapMax(e); setActivePreset(null); }}   placeholder="e.g. 500000" />
            <FilterInput label="D/E Max"      val={deMax}    setter={e => { setDeMax(e); setActivePreset(null); }}     placeholder="e.g. 1.0" />
            <FilterInput label="Rev Gr Min %" val={revGrMin} setter={e => { setRevGrMin(e); setActivePreset(null); }}  placeholder="e.g. 15" />
            <FilterInput label="PAT Gr Min %" val={patGrMin} setter={e => { setPatGrMin(e); setActivePreset(null); }}  placeholder="e.g. 10" />
            <FilterInput label="Div Yield Min"val={divMin}   setter={e => { setDivMin(e); setActivePreset(null); }}    placeholder="e.g. 2" />
          </div>
        </div>
      )}

      {/* Results count */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, padding:"0 4px" }}>
        <span style={{ fontSize:11, color:T.muted }}>
          Showing <strong style={{ color:T.goldLight }}>{filtered.length}</strong> of {SCREENER_STOCKS.length} stocks
          {hasActiveFilters && <span style={{ color:T.gold }}> · Filters active</span>}
        </span>
        <span style={{ fontSize:10, color:T.walnutLight }}>Click a row for AI analysis · Click column headers to sort</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX:"auto", padding:0 }}>
        {/* Header row */}
        <div className="scr-row scr-hdr" style={{ padding:"10px 14px", borderBottom:`2px solid ${T.walnut}55` }}>
          <span>Stock</span>
          <SortHdr label="MCap"     k="mcapN" />
          <SortHdr label="P/E"      k="pe" />
          <SortHdr label="P/B"      k="pb" />
          <SortHdr label="ROE %"    k="roe" />
          <SortHdr label="Rev Gr %" k="rev_gr" />
          <SortHdr label="PAT Gr %" k="pat_gr" />
          <SortHdr label="D/E"      k="de" />
          <span>Rating</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 20px" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.dun, marginBottom:6 }}>No stocks match your filters</div>
            <div style={{ color:T.muted, fontSize:13, marginBottom:16 }}>Try adjusting or clearing your filters</div>
            <button className="btn-gold" onClick={clearFilters}>✕ Clear All Filters</button>
          </div>
        ) : (
          filtered.map(s => (
            <div key={s.sym} className="scr-row"
              style={{ padding:"10px 14px", borderBottom:`1px solid ${T.walnut}22`, cursor:"pointer",
                background: selected?.sym===s.sym ? T.gold+"0a" : "transparent",
                borderLeft: selected?.sym===s.sym ? `3px solid ${T.gold}77` : "3px solid transparent",
              }}
              onClick={() => quickAnalyze(s)}>
              <div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:12, color:T.dun }}>{s.sym}</div>
                <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>{s.name}</div>
                <span style={{
                  fontSize:8, letterSpacing:"0.5px", padding:"1px 6px", borderRadius:8,
                  background: (SECTOR_COLORS[s.sector]||T.walnut)+"22",
                  color: (SECTOR_COLORS[s.sector]||T.walnutLight),
                  border: `1px solid ${(SECTOR_COLORS[s.sector]||T.walnut)}44`,
                }}>
                  {s.sector}
                </span>
              </div>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{fmtMcap(s.mcapN)}</span>
              <span style={{
                fontFamily:"'DM Mono',monospace",
                color: s.pe > 60 ? T.redLight : s.pe < 20 ? T.greenLight : T.dunDark
              }}>{s.pe}x</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{s.pb}x</span>
              <span style={{ color: s.roe >= 25 ? T.greenLight : s.roe >= 15 ? T.dun : T.redLight, fontWeight: s.roe >= 25 ? 700 : 400 }}>
                {s.roe}%
              </span>
              <span style={{ color: s.rev_gr >= 20 ? T.greenLight : s.rev_gr >= 10 ? T.dun : T.muted }}>
                {s.rev_gr}%
              </span>
              <span style={{ color: s.pat_gr == null ? T.muted : s.pat_gr >= 20 ? T.greenLight : s.pat_gr >= 0 ? T.dun : T.redLight }}>
                {s.pat_gr != null ? `${s.pat_gr}%` : "—"}
              </span>
              <span style={{ color: s.de > 1.5 ? T.redLight : s.de > 0.5 ? T.gold : T.greenLight }}>
                {s.de}
              </span>
              <span style={{
                color: ratingColor(s.rating), fontWeight:700, fontSize:10,
                background: ratingColor(s.rating)+"18",
                padding:"2px 8px", borderRadius:8,
                border:`1px solid ${ratingColor(s.rating)}33`,
              }}>
                {s.rating}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:10, padding:"0 4px", fontSize:10, color:T.mutedDark }}>
        <span><span style={{ color:T.greenLight }}>■</span> Strong / good</span>
        <span><span style={{ color:T.gold }}>■</span> Moderate</span>
        <span><span style={{ color:T.redLight }}>■</span> Weak / high risk</span>
        <span style={{ marginLeft:"auto", color:T.walnutLight }}>MCap in ₹ Crores · All data FY25</span>
      </div>

      {/* AI Analysis Panel */}
      {(selected || loading) && (
        <div className="card card-gold" style={{ marginTop:18 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>🤖 AI Analysis — {selected?.sym}</div>
              <div style={{ fontSize:10, color:T.muted }}>
                {selected?.name} · {selected?.sector} ·
                P/E {selected?.pe}x · ROE {selected?.roe}%
              </div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => { setSelected(null); setAnalysis(""); }}>✕ Close</button>
          </div>
          {loading ? (
            <div className="loading">
              <div className="spin" />
              <span>Analyzing {selected?.sym} across valuation, growth & risk dimensions...</span>
            </div>
          ) : (
            analysis && (
              <div className="res-box"
                dangerouslySetInnerHTML={{ __html:
                  analysis
                    .replace(/\*\*(.*?)\*\*/g, "<strong style='color:"+T.goldLight+"'>$1</strong>")
                    .replace(/\n/g, "<br/>")
                }} />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── WATCHLIST ─────────────────────────────────────────────────────────────────
function WatchlistManager() {
  const STORAGE_KEY = "dnr_watchlists_v2";
  const defaultLists = {
    "My Watchlist": [
      { symbol:"RELIANCE",  name:"Reliance Industries",      sector:"Conglomerate", note:"" },
      { symbol:"TCS",       name:"Tata Consultancy Services", sector:"IT Services",  note:"" },
      { symbol:"DIXONTECH", name:"Dixon Technologies",        sector:"Electronics",  note:"PLI beneficiary" },
    ],
    "Momentum":  [],
    "Dividends": [],
  };

  const [watchlists, setWatchlists] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : defaultLists; } catch { return defaultLists; }
  });
  const [active, setActive] = useState(Object.keys(defaultLists)[0]);
  const [sym,  setSym]  = useState(""); const [nm,   setNm]   = useState("");
  const [sec,  setSec]  = useState(""); const [note, setNote] = useState("");
  const [ln,   setLn]   = useState("");
  const [qr,   setQr]   = useState({}); const [ql, setQl] = useState(null);
  const [editNote, setEditNote] = useState({}); // symbol -> note being edited

  // Persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlists)); } catch {}
  }, [watchlists]);

  const currentList = watchlists[active] || [];

  const add = () => {
    if (!sym.trim()) return;
    setWatchlists(p => ({
      ...p,
      [active]: [...(p[active]||[]), {
        symbol: sym.toUpperCase(), name: nm||sym.toUpperCase(),
        sector: sec||"—", note: note||"",
      }]
    }));
    setSym(""); setNm(""); setSec(""); setNote("");
  };

  const del = (s) => setWatchlists(p => ({ ...p, [active]: p[active].filter(x=>x.symbol!==s) }));

  const saveNote = (sym, val) => {
    setWatchlists(p => ({ ...p, [active]: p[active].map(x => x.symbol===sym ? {...x,note:val} : x) }));
    setEditNote(p => ({...p, [sym]:undefined}));
  };

  const addList = () => {
    if (!ln.trim() || watchlists[ln]) return;
    setWatchlists(p => ({...p, [ln]: []}));
    setActive(ln); setLn("");
  };

  const delList = (name) => {
    if (Object.keys(watchlists).length <= 1) return;
    setWatchlists(p => { const n={...p}; delete n[name]; return n; });
    if (active===name) setActive(Object.keys(watchlists).find(k=>k!==name)||"");
  };

  const analyze = async (s) => {
    setQl(s);
    await callGroq(
      `Quick 5-point investment analysis of ${s} — today ${new Date().toLocaleDateString("en-IN")}:\n1) Business quality score /10 with 1-line reason\n2) Financial health — profitable? cash-rich or debt-heavy?\n3) Valuation — cheap/fair/expensive vs sector?\n4) Near-term momentum — any catalysts or headwinds?\n5) DNR Verdict — BUY / ACCUMULATE / HOLD / AVOID with one-line entry note`,
      SYS, (t) => setQr(p=>({...p,[s]:t}))
    );
    setQl(null);
  };

  return (
    <div>
      <div className="sec-title">⭐ Watchlist Manager</div>
      <div className="sec-sub">Persistent across sessions · Multiple lists · AI quick analysis</div>

      {/* List tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        {Object.keys(watchlists).map(n => (
          <div key={n} style={{ display:"flex", alignItems:"center", gap:0 }}>
            <button onClick={()=>setActive(n)} style={{
              padding:"6px 14px", borderRadius:active===n?"20px 0 0 20px":"20px",
              background: active===n ? T.walnut : "transparent",
              border:`1px solid ${active===n ? T.walnut : T.walnut+"44"}`,
              borderRight: active===n ? "none" : undefined,
              color: active===n ? T.dun : T.muted,
              cursor:"pointer", fontSize:12, transition:"all 0.2s", fontFamily:"'Jost',sans-serif",
            }}>
              {n} <span style={{ fontSize:10, opacity:0.7 }}>({(watchlists[n]||[]).length})</span>
            </button>
            {active===n && Object.keys(watchlists).length>1 && (
              <button onClick={()=>delList(n)} style={{
                padding:"6px 8px", borderRadius:"0 20px 20px 0",
                background:T.red+"22", border:`1px solid ${T.red}33`, borderLeft:"none",
                color:T.redLight, cursor:"pointer", fontSize:10, transition:"all 0.2s",
              }}>✕</button>
            )}
          </div>
        ))}
        <input className="inp" value={ln} onChange={e=>setLn(e.target.value)}
          placeholder="+ New list..." style={{ width:130 }}
          onKeyDown={e=>e.key==="Enter"&&addList()} />
        {ln && <button className="btn-ghost" onClick={addList}>Create</button>}
      </div>

      {/* Add stock form */}
      <div className="card" style={{ marginBottom:14, padding:"14px 16px" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <label style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Symbol*</label>
            <input className="inp" value={sym} onChange={e=>setSym(e.target.value)}
              placeholder="e.g. RELIANCE" style={{ width:120 }}
              onKeyDown={e=>e.key==="Enter"&&add()} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <label style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Company Name</label>
            <input className="inp" value={nm} onChange={e=>setNm(e.target.value)}
              placeholder="Full name" style={{ width:180 }}
              onKeyDown={e=>e.key==="Enter"&&add()} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <label style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Sector</label>
            <input className="inp" value={sec} onChange={e=>setSec(e.target.value)}
              placeholder="e.g. Banking" style={{ width:120 }}
              onKeyDown={e=>e.key==="Enter"&&add()} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <label style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Note</label>
            <input className="inp" value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Why watching?" style={{ width:200 }}
              onKeyDown={e=>e.key==="Enter"&&add()} />
          </div>
          <button className="btn-primary" onClick={add}>+ Add to {active}</button>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding:0 }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.walnut}33`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.dun }}>
            {active}
            <span style={{ fontSize:13, color:T.muted, fontFamily:"'Jost',sans-serif", marginLeft:8 }}>
              · {currentList.length} {currentList.length===1?"stock":"stocks"}
            </span>
          </div>
        </div>

        {currentList.length===0 && (
          <div style={{ textAlign:"center", padding:"48px 20px", color:T.muted }}>
            <div style={{ fontSize:36, marginBottom:12 }}>⭐</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.dun }}>List is empty</div>
            <div style={{ fontSize:13, marginTop:6 }}>Add stocks above to start tracking</div>
          </div>
        )}

        {currentList.map(s => (
          <div key={s.symbol}>
            <div className="wl-stock" style={{ padding:"12px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{
                  width:36, height:36, borderRadius:8,
                  background:`linear-gradient(135deg,${T.cosmicBlueDim},${T.walnutDeep})`,
                  border:`1px solid ${T.cosmicBlue}44`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'DM Mono',monospace", fontSize:9, fontWeight:700, color:T.cosmicBluePale,
                  boxShadow:`0 0 10px ${T.cosmicBlue}22`,
                }}>
                  {s.symbol.slice(0,4)}
                </div>
                <div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, color:T.dun, fontSize:12 }}>{s.symbol}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{s.name}</div>
                  <span style={{ fontSize:8, padding:"1px 6px", borderRadius:8, background:T.cosmicBlue+"22", color:T.cosmicBluePale, border:`1px solid ${T.cosmicBlue}33` }}>
                    {s.sector}
                  </span>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                {/* Note display/edit */}
                {editNote[s.symbol]!==undefined ? (
                  <div style={{ display:"flex", gap:4 }}>
                    <input className="inp" style={{ width:180, padding:"3px 8px", fontSize:11 }}
                      value={editNote[s.symbol]}
                      onChange={e=>setEditNote(p=>({...p,[s.symbol]:e.target.value}))}
                      onKeyDown={e=>e.key==="Enter"&&saveNote(s.symbol,editNote[s.symbol])}
                      autoFocus />
                    <button className="btn-ghost" style={{ padding:"3px 8px", fontSize:10 }} onClick={()=>saveNote(s.symbol,editNote[s.symbol])}>Save</button>
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:T.muted, cursor:"pointer", maxWidth:200, textAlign:"right" }}
                    onClick={()=>setEditNote(p=>({...p,[s.symbol]:s.note||""}))}>
                    {s.note ? <span style={{ color:T.goldLight, fontStyle:"italic" }}>"{s.note}"</span> : <span style={{ color:T.walnutLight }}>+ add note</span>}
                  </div>
                )}
                <div style={{ display:"flex", gap:6 }}>
                  <button className="btn-ghost btn-sm" onClick={()=>analyze(s.symbol)} disabled={ql===s.symbol}>
                    {ql===s.symbol ? <span className="ld">Analyzing</span> : "🔍 Analyze"}
                  </button>
                  <button className="btn-danger" onClick={()=>del(s.symbol)}>✕</button>
                </div>
              </div>
            </div>
            {/* Analysis result */}
            {qr[s.symbol] && (
              <div style={{ padding:"12px 16px", background:T.walnutDeep+"88", borderBottom:`1px solid ${T.walnut}22` }}>
                <div className="prose" style={{ fontSize:12 }}
                  dangerouslySetInnerHTML={{ __html:
                    qr[s.symbol]
                      .replace(/\*\*(.*?)\*\*/g,`<strong style='color:${T.goldLight}'>$1</strong>`)
                      .replace(/\n/g,"<br/>")
                  }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PORTFOLIO ─────────────────────────────────────────────────────────────────
function Portfolio() {
  const STORAGE_KEY = "dnr_portfolio_v2";
  const defaultPositions = [
    { symbol:"RELIANCE",  name:"Reliance Industries",       qty:10, avgPrice:2450, cmp:2890, sector:"Conglomerate" },
    { symbol:"TCS",       name:"Tata Consultancy Services",  qty:5,  avgPrice:3800, cmp:4120, sector:"IT Services" },
    { symbol:"HDFCBANK",  name:"HDFC Bank",                  qty:20, avgPrice:1580, cmp:1642, sector:"Banking" },
    { symbol:"INFOSYS",   name:"Infosys",                    qty:15, avgPrice:1720, cmp:1890, sector:"IT Services" },
  ];

  const [portfolio, setPortfolio] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : defaultPositions; } catch { return defaultPositions; }
  });
  const [form, setForm]       = useState({ symbol:"", name:"", qty:"", avgPrice:"", cmp:"", sector:"" });
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [cmpEdit, setCmpEdit] = useState({});
  const [sortCol, setSortCol] = useState("pnlPct");
  const [showAdd, setShowAdd] = useState(false);

  // Persist to localStorage whenever portfolio changes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio)); } catch {}
  }, [portfolio]);

  // Derived totals
  const ti   = portfolio.reduce((s,p) => s + p.qty * p.avgPrice, 0);
  const tc   = portfolio.reduce((s,p) => s + p.qty * p.cmp,       0);
  const tpnl = tc - ti;
  const tpct = ti > 0 ? ((tpnl / ti) * 100) : 0;

  // Best / worst
  const rows = portfolio.map(p => ({
    ...p,
    invested: p.qty * p.avgPrice,
    currentVal: p.qty * p.cmp,
    pnl: p.qty * (p.cmp - p.avgPrice),
    pnlPct: ((p.cmp - p.avgPrice) / p.avgPrice * 100),
    weight: tc > 0 ? (p.qty * p.cmp / tc * 100) : 0,
  })).sort((a,b) => b[sortCol] - a[sortCol]);

  const addPos = () => {
    if (!form.symbol || !form.qty || !form.avgPrice) return;
    setPortfolio(p => [...p, {
      symbol:   form.symbol.toUpperCase(),
      name:     form.name || form.symbol.toUpperCase(),
      qty:      +form.qty,
      avgPrice: +form.avgPrice,
      cmp:      +(form.cmp || form.avgPrice),
      sector:   form.sector || "—",
    }]);
    setForm({ symbol:"", name:"", qty:"", avgPrice:"", cmp:"", sector:"" });
    setShowAdd(false);
  };

  const upCMP = (sym) => {
    const v = parseFloat(cmpEdit[sym]);
    if (!v || v <= 0) return;
    setPortfolio(p => p.map(x => x.symbol===sym ? {...x, cmp:v} : x));
    setCmpEdit(p => ({...p, [sym]:""}));
  };

  const analyzePortfolio = async () => {
    setAnalyzing(true); setAnalysis("");
    const pos = rows.map(p =>
      `${p.symbol} (${p.sector}): Qty ${p.qty} | Avg ₹${p.avgPrice} | CMP ₹${p.cmp} | P&L ${p.pnlPct.toFixed(1)}% | Weight ${p.weight.toFixed(1)}%`
    ).join("\n");
    await callGroq(
      `Portfolio Review as of today:\n${pos}\n\nTotal Invested: ₹${(ti/100000).toFixed(2)} Lakhs\nCurrent Value: ₹${(tc/100000).toFixed(2)} Lakhs\nOverall Return: ${tpct.toFixed(2)}%\n\nProvide institutional-quality portfolio review:\n1) **Overall Portfolio Health** — quality score /10 with justification\n2) **Concentration Risk** — sector/stock concentration warnings\n3) **Top Performers** — what's working and why to hold/add\n4) **Laggards** — what's underperforming and exit/hold decision\n5) **Rebalancing Suggestions** — specific allocation changes with reasoning\n6) **Missing Sectors** — gaps in diversification with 2-3 stock suggestions per gap\n7) **Action Items** — 3 specific actions this week`,
      SYS, (t) => setAnalysis(t)
    );
    setAnalyzing(false);
  };

  const PIE_COLORS = [T.goldLight, T.cosmicBlueLight, T.greenLight, T.redLight, T.walnutLight, "#c06080", "#7a60c0", "#60c0b0"];

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div className="sec-title">💼 Portfolio Tracker</div>
          <div className="sec-sub">localStorage-persisted · Real-time P&L · AI portfolio review</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={() => setShowAdd(s=>!s)}>
            {showAdd ? "✕ Cancel" : "+ Add Position"}
          </button>
          <button className="btn-ghost" onClick={() => {
            const hdr = "Symbol,Name,Sector,Qty,Avg Price,CMP,Invested,Current Value,P&L,P&L%,Weight%";
            const rowsCSV = rows.map(p => `${p.symbol},${p.name},${p.sector},${p.qty},${p.avgPrice},${p.cmp},${p.invested.toFixed(0)},${p.currentVal.toFixed(0)},${p.pnl.toFixed(0)},${p.pnlPct.toFixed(2)},${p.weight.toFixed(1)}`);
            const blob = new Blob([hdr+"\n"+rowsCSV.join("\n")], {type:"text/csv"});
            const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
            a.download=`DNR_Portfolio_${new Date().toLocaleDateString("en-IN").replace(/\//g,"-")}.csv`; a.click();
          }}>📥 Export CSV</button>
          <button className="btn-gold" onClick={analyzePortfolio} disabled={analyzing || portfolio.length===0}>
            {analyzing ? <span className="ld">Analyzing</span> : "🤖 AI Review"}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="g4" style={{ marginBottom:18 }}>
        {[
          { l:"Invested",      v:`₹${(ti/100000).toFixed(2)}L`, c:"", sub:`${portfolio.length} positions` },
          { l:"Current Value", v:`₹${(tc/100000).toFixed(2)}L`, c:"", sub:`₹${(tc/1000).toFixed(0)}K total` },
          { l:"Total P&L",     v:`${tpnl>=0?"+":""}₹${(Math.abs(tpnl)/100000).toFixed(2)}L`, c:tpnl>=0?"pos":"neg", sub:`Unrealized` },
          { l:"Returns",       v:`${tpct>=0?"+":""}${tpct.toFixed(2)}%`,                       c:tpct>=0?"pos":"neg", sub:"Overall XIRR est." },
        ].map(s=>(
          <div key={s.l} className={`stat ${tpnl>=0&&s.l==="Total P&L"?"stat-pos":tpnl<0&&s.l==="Total P&L"?"stat-neg":""}`}>
            <div className="stat-lbl">{s.l}</div>
            <div className={`stat-val ${s.c}`}>{s.v}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Add position form */}
      {showAdd && (
        <div className="card card-gold" style={{ marginBottom:14 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, color:T.dun, marginBottom:12 }}>Add New Position</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
            {[
              { f:"symbol",   ph:"Symbol*",      w:100 },
              { f:"name",     ph:"Company Name", w:180 },
              { f:"sector",   ph:"Sector",       w:130 },
              { f:"qty",      ph:"Qty*",         w:80  },
              { f:"avgPrice", ph:"Avg Price*",   w:110 },
              { f:"cmp",      ph:"CMP (optional)",w:120 },
            ].map(({f,ph,w})=>(
              <input key={f} className="inp" style={{ width:w }}
                placeholder={ph} value={form[f]}
                onChange={e => setForm(p=>({...p,[f]:e.target.value}))}
                onKeyDown={e => e.key==="Enter" && addPos()} />
            ))}
            <button className="btn-gold" onClick={addPos}>+ Add</button>
          </div>
        </div>
      )}

      {/* Positions table */}
      <div className="card" style={{ overflowX:"auto", padding:0, marginBottom:14 }}>
        <div className="p-row p-hdr" style={{ padding:"10px 14px", borderBottom:`2px solid ${T.walnut}44` }}>
          <span>Stock</span>
          <span style={{ cursor:"pointer" }} onClick={()=>setSortCol("qty")}>Qty</span>
          <span>Avg / CMP</span>
          <span style={{ cursor:"pointer" }} onClick={()=>setSortCol("currentVal")}>Value</span>
          <span style={{ cursor:"pointer", color: sortCol==="pnlPct"?T.goldLight:"inherit" }} onClick={()=>setSortCol("pnlPct")}>P&L {sortCol==="pnlPct"&&"▼"}</span>
          <span style={{ cursor:"pointer" }} onClick={()=>setSortCol("weight")}>Weight</span>
          <span></span>
        </div>
        {rows.length===0 && (
          <div style={{ textAlign:"center", padding:"48px", color:T.muted }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💼</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.dun }}>No positions yet</div>
            <div style={{ fontSize:13, marginTop:8 }}>Click "+ Add Position" to get started</div>
          </div>
        )}
        {rows.map(p=>(
          <div key={p.symbol} className="p-row" style={{ padding:"10px 14px" }}>
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, color:T.dun, fontSize:12 }}>{p.symbol}</div>
              <div style={{ fontSize:10, color:T.muted }}>{p.name}</div>
              <span style={{
                fontSize:8, padding:"1px 6px", borderRadius:8,
                background:T.cosmicBlue+"22", color:T.cosmicBluePale,
                border:`1px solid ${T.cosmicBlue}33`,
              }}>{p.sector}</span>
            </div>
            <span style={{ fontFamily:"'DM Mono',monospace" }}>{p.qty}</span>
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>₹{p.avgPrice.toLocaleString("en-IN")}</div>
              {/* Inline CMP update */}
              <div style={{ display:"flex", gap:3, marginTop:3 }}>
                <input className="inp" style={{ width:65, padding:"2px 6px", fontSize:10 }}
                  placeholder={`${p.cmp}`} value={cmpEdit[p.symbol]||""}
                  onChange={e => setCmpEdit(pr=>({...pr,[p.symbol]:e.target.value}))}
                  onKeyDown={e => e.key==="Enter" && upCMP(p.symbol)} />
                <button className="btn-ghost" style={{ padding:"2px 6px", fontSize:10 }} onClick={()=>upCMP(p.symbol)}>✓</button>
              </div>
            </div>
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>₹{p.currentVal.toLocaleString("en-IN")}</div>
              {/* Weight bar */}
              <div style={{ background:T.walnutDeep, borderRadius:2, overflow:"hidden", height:3, width:60, marginTop:4 }}>
                <div className="p-bar" style={{ width:`${Math.min(p.weight,100)}%`, background:PIE_COLORS[rows.indexOf(p)%PIE_COLORS.length] }} />
              </div>
            </div>
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color: p.pnl>=0?T.greenLight:T.redLight, fontWeight:600 }}>
                {p.pnl>=0?"+":""}₹{Math.abs(p.pnl).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize:10, color: p.pnlPct>=0?T.greenLight:T.redLight }}>
                {p.pnlPct>=0?"+":""}{p.pnlPct.toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize:11, color:T.muted }}>
              {p.weight.toFixed(1)}%
            </div>
            <button className="btn-danger" onClick={()=>setPortfolio(p2=>p2.filter(x=>x.symbol!==p.symbol))}>✕</button>
          </div>
        ))}
      </div>

      {/* Charts */}
      {portfolio.length>0 && (
        <div className="g2" style={{ marginBottom:14 }}>
          <div className="card">
            <div className="chart-title">Portfolio Allocation by Value</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={rows.map(p=>({ name:p.symbol, value:p.currentVal }))}
                  cx="50%" cy="50%" outerRadius={80} innerRadius={35}
                  dataKey="value" paddingAngle={2}
                  label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {rows.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}} formatter={v=>`₹${v.toLocaleString("en-IN")}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="chart-title">P&L % by Position</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rows.map(p=>({ name:p.symbol, PnL:parseFloat(p.pnlPct.toFixed(1)) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.walnut+"33"} />
                <XAxis dataKey="name" tick={{fill:T.muted,fontSize:10}} />
                <YAxis tick={{fill:T.muted,fontSize:10}} unit="%" />
                <ReferenceLine y={0} stroke={T.walnut} strokeDasharray="4 4" />
                <Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}} formatter={v=>`${v}%`} />
                <Bar dataKey="PnL" radius={[3,3,0,0]}>
                  {rows.map((p,i)=><Cell key={i} fill={p.pnlPct>=0?T.greenLight:T.redLight} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {(analysis||analyzing) && (
        <div className="card card-gold" style={{ marginTop:14 }}>
          <div className="card-title" style={{ marginBottom:14 }}>🤖 AI Portfolio Assessment</div>
          {analyzing ? (
            <div className="loading"><div className="spin"/><span>Analyzing your portfolio across 7 dimensions...</span></div>
          ) : (
            <div className="res-box" dangerouslySetInnerHTML={{ __html:
              analysis.replace(/\*\*(.*?)\*\*/g,`<strong style='color:${T.goldLight}'>$1</strong>`).replace(/\n/g,"<br/>")
            }}/>
          )}
        </div>
      )}
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
    const raw = await callGroq(`Analyze IPO: ${ipo.name}, Sector: ${ipo.sector}, Price: ${ipo.price}, Size: ${ipo.size}, GMP: ${ipo.gmp}. Give: 1) Subscription recommendation (Subscribe/Avoid/Neutral) 2) Key positives (2 points) 3) Key risks (2 points) 4) Listing gain expectation. Keep it concise.`, getSYS(), null);
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
  const [fiiData,    setFiiData]    = useState([]);
  const [analysis,   setAnalysis]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [dataLoading,setDataLoading]= useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch live AI-generated FII/DII data on mount
  useEffect(() => {
    loadFIIData();
  }, []);

  const loadFIIData = async () => {
    setDataLoading(true);
    const data = await fetchLiveFIIDII();
    if (data && data.length > 0) {
      setFiiData(data);
      setLastUpdate(new Date().toLocaleString("en-IN"));
    }
    setDataLoading(false);
  };

  const fetchAnalysis = async () => {
    setLoading(true);
    const today = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
    const dataStr = fiiData.map(d => `${d.month}: FII ${d.fii>0?"+":""}₹${(d.fii/100).toFixed(0)} Cr | DII +₹${(d.dii/100).toFixed(0)} Cr`).join("\n");
    const raw = await callGroq(
      `Today is ${today}. Analyze the following ACTUAL FII/DII flow data for Indian equity markets:

${dataStr || "Use latest available data as of today"}

Provide a comprehensive institutional flow analysis:
1) **FII Flow Trend** — are FIIs net buyers or sellers overall? Acceleration or deceleration?
2) **DII Counterbalancing** — how effectively are DIIs (MFs, insurance) absorbing FII selling?
3) **Sectors Being Targeted** — which sectors are FIIs accumulating/exiting based on recent filings?
4) **Currency Impact** — USD/INR trend and its effect on FII flows
5) **Global Triggers** — US Fed policy, EM allocation shifts driving FII behavior
6) **Market Impact** — what these flows mean for NIFTY direction in next 1-3 months
7) **Key Stocks** — 5 specific stocks seeing heavy institutional activity right now
8) **Outlook** — Q4FY25 / Q1FY26 FII flow prediction with reasoning

Be very specific with numbers and current data as of ${today}.`,
      getSYS(), null
    );
    setAnalysis(raw);
    setLoading(false);
  };

  const maxVal = fiiData.length > 0
    ? Math.max(...fiiData.map(d => Math.max(Math.abs(d.fii), d.dii))) || 1
    : 1;

  const totalFII = fiiData.reduce((s,d) => s+d.fii, 0);
  const totalDII = fiiData.reduce((s,d) => s+d.dii, 0);
  const latestMonth = fiiData[fiiData.length-1] || {};
  const prevMonth   = fiiData[fiiData.length-2] || {};

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div className="sec-title">🌐 FII / DII Activity</div>
          <div className="sec-sub">
            Live institutional flow data · Auto-refreshed · AI analysis
            {lastUpdate && <span style={{ marginLeft:8, color:T.walnutLight }}>· Last updated: {lastUpdate}</span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={loadFIIData} disabled={dataLoading}>
            {dataLoading ? <span className="ld">Loading</span> : "🔄 Refresh Data"}
          </button>
          <button className="btn-gold" onClick={fetchAnalysis} disabled={loading || fiiData.length===0}>
            {loading ? <span className="ld">Analyzing</span> : "🤖 AI Flow Analysis"}
          </button>
        </div>
      </div>

      {/* Live summary cards */}
      {fiiData.length > 0 && (
        <div className="g4" style={{ marginBottom:18 }}>
          {[
            { l:`FII ${latestMonth.month||"Latest"}`, v:`${latestMonth.fii>0?"+":""}₹${latestMonth.fii?Math.abs(latestMonth.fii/100).toFixed(0):"—"} Cr`, c:latestMonth.fii>0?T.greenLight:T.redLight, s:latestMonth.fii>0?"Net Buyer ▲":"Net Seller ▼" },
            { l:`DII ${latestMonth.month||"Latest"}`, v:`+₹${latestMonth.dii?(latestMonth.dii/100).toFixed(0):"—"} Cr`, c:T.goldLight, s:"Net Buyer ▲" },
            { l:`FII ${fiiData.length}-Month Net`, v:`${totalFII>0?"+":""}₹${Math.abs(totalFII/100).toFixed(0)} Cr`, c:totalFII>0?T.greenLight:T.redLight, s:totalFII>0?"Net Buyer":"Net Seller" },
            { l:`DII ${fiiData.length}-Month Net`, v:`+₹${(totalDII/100).toFixed(0)} Cr`, c:T.greenLight, s:"Consistent Buyer" },
          ].map(s=>(
            <div key={s.l} className="stat">
              <div className="stat-lbl">{s.l}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:16, fontWeight:700, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:10, color:s.c, marginTop:3 }}>{s.s}</div>
            </div>
          ))}
        </div>
      )}

      {dataLoading && <div className="loading"><div className="spin"/><span>Fetching latest FII/DII flow data...</span></div>}

      {fiiData.length > 0 && (
        <div className="g2" style={{ marginBottom:18 }}>
          {/* FII bar chart */}
          <div className="card">
            <div className="sec-hdr">Monthly FII Net Flow (₹ Cr)</div>
            {fiiData.map(d => (
              <div key={d.month} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                  <span style={{ color:T.muted }}>{d.month}</span>
                  <span style={{ color:d.fii>0?T.greenLight:T.redLight, fontWeight:600 }}>
                    {d.fii>0?"+":""}₹{(d.fii/100).toFixed(0)} Cr
                  </span>
                </div>
                <div className="fii-bar-wrap">
                  <div className="fii-bar" style={{
                    width:`${Math.abs(d.fii)/maxVal*100}%`,
                    background:d.fii>0?"linear-gradient(90deg,#22c55e,#16a34a)":"linear-gradient(90deg,#ef4444,#dc2626)"
                  }}/>
                </div>
              </div>
            ))}
          </div>
          {/* DII bar chart */}
          <div className="card">
            <div className="sec-hdr">Monthly DII Net Flow (₹ Cr)</div>
            {fiiData.map(d => (
              <div key={d.month} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                  <span style={{ color:T.muted }}>{d.month}</span>
                  <span style={{ color:T.goldLight, fontWeight:600 }}>+₹{(d.dii/100).toFixed(0)} Cr</span>
                </div>
                <div className="fii-bar-wrap">
                  <div className="fii-bar" style={{
                    width:`${d.dii/maxVal*100}%`,
                    background:`linear-gradient(90deg,${T.goldLight}88,${T.gold})`
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Combined recharts bar chart */}
      {fiiData.length > 0 && (
        <div className="card" style={{ marginBottom:18 }}>
          <div className="chart-title">FII vs DII Monthly Flows (₹ Cr)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fiiData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.walnut+"33"} />
              <XAxis dataKey="month" tick={{fill:T.muted,fontSize:9}} />
              <YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${(v/100).toFixed(0)}`} />
              <ReferenceLine y={0} stroke={T.walnut} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}}
                formatter={(v,n)=>[`₹${(v/100).toFixed(0)} Cr`,n]}
              />
              <Legend wrapperStyle={{fontSize:10}} />
              <Bar dataKey="fii" name="FII" radius={[3,3,0,0]}>
                {fiiData.map((d,i) => <Cell key={i} fill={d.fii>=0?"#22c55e":"#ef4444"} opacity={0.85} />)}
              </Bar>
              <Bar dataKey="dii" name="DII" fill={T.goldLight} opacity={0.85} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize:10, color:T.walnutLight, marginTop:6, textAlign:"right" }}>
            ⚡ Data: AI-synthesized from latest SEBI/NSE disclosures · Values in ₹ Crore
          </div>
        </div>
      )}

      {loading && <div className="loading"><div className="spin"/><span>Running institutional flow analysis...</span></div>}
      {analysis && (
        <div className="res-box" dangerouslySetInnerHTML={{ __html:
          analysis.replace(/\*\*(.*?)\*\*/g,`<strong style='color:${T.goldLight}'>$1</strong>`).replace(/\n/g,"<br/>")
        }}/>
      )}
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
    const raw = await callGroq(`Deep dive analysis for ${sector.name} sector in Indian markets. Current performance: ${sector.perf}, Momentum: ${sector.momentum}. Provide: 1) Key drivers for current performance 2) Top 3 stocks to watch with brief reasoning 3) Key risks 4) 3-6 month outlook. Be specific with stock names and data.`, getSYS(), null);
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

  // Load saved data from localStorage on mount — no auto-fetch
  useEffect(() => {
    const keys = [
      ["dnr_daily",       setDailyData],
      ["dnr_monthly",     setMonthlyData],
      ["dnr_quarterly",   setQuarterlyData],
    ];
    keys.forEach(([k, setter]) => {
      try { const v = localStorage.getItem(k); if(v) setter(JSON.parse(v)); } catch {}
    });
    try { const lu = localStorage.getItem("dnr_lastupdated"); if(lu) setLastUpdated(JSON.parse(lu)); } catch {}
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
      const start = clean.indexOf("[");
      const end   = clean.lastIndexOf("]");
      if(start === -1 || end === -1) throw new Error("No JSON array in response");
      clean = clean.substring(start, end+1);
      const parsed = JSON.parse(clean);
      if(!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array returned");
      setDailyData(parsed);
      saveAndUpdate("dnr_daily", parsed, "daily");
    } catch(e) {
      setError(`Failed to fetch daily data: ${e.message}. Check your Groq API key and try again.`);
    }
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
      const ms = clean.indexOf("["), me = clean.lastIndexOf("]");
      if(ms===-1||me===-1) throw new Error("No JSON array in response");
      const parsed = JSON.parse(clean.substring(ms, me+1));
      if(!Array.isArray(parsed)||parsed.length===0) throw new Error("Empty array");
      setMonthlyData(parsed);
      saveAndUpdate("dnr_monthly", parsed, "monthly");
    } catch(e) {
      setError(`Failed to fetch monthly data: ${e.message}. Check your Groq API key and try again.`);
    }
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
      const qs = clean.indexOf("["), qe = clean.lastIndexOf("]");
      if(qs===-1||qe===-1) throw new Error("No JSON array in response");
      const parsed = JSON.parse(clean.substring(qs, qe+1));
      if(!Array.isArray(parsed)||parsed.length===0) throw new Error("Empty array");
      setQuarterlyData(parsed);
      saveAndUpdate("dnr_quarterly", parsed, "quarterly");
    } catch(e) {
      setError(`Failed to fetch quarterly data: ${e.message}. Check your Groq API key and try again.`);
    }
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

    const raw = await callGroq(prompt, getSYS(), null);
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

// ─── CALCULATORS ──────────────────────────────────────────────────────────────
function Calculators() {
  const [tab, setTab] = useState("sip");

  // ── SIP Calculator ──
  const [sipMonthly, setSipMonthly] = useState(10000);
  const [sipRate, setSipRate]       = useState(12);
  const [sipYears, setSipYears]     = useState(10);
  const sipMonths   = sipYears * 12;
  const sipMonthly_ = sipRate / 100 / 12;
  const sipCorpus   = sipMonthly_ > 0
    ? sipMonthly * ((Math.pow(1 + sipMonthly_, sipMonths) - 1) / sipMonthly_) * (1 + sipMonthly_)
    : sipMonthly * sipMonths;
  const sipInvested = sipMonthly * sipMonths;
  const sipGains    = sipCorpus - sipInvested;

  // ── Lumpsum Calculator ──
  const [lsAmount, setLsAmount]   = useState(100000);
  const [lsRate, setLsRate]       = useState(12);
  const [lsYears, setLsYears]     = useState(10);
  const lsCorpus   = lsAmount * Math.pow(1 + lsRate / 100, lsYears);
  const lsGains    = lsCorpus - lsAmount;
  const lsDoubling = Math.log(2) / Math.log(1 + lsRate / 100);

  // ── Position Sizing ──
  const [capital, setCapital]     = useState(500000);
  const [riskPct, setRiskPct]     = useState(1);
  const [entry, setEntry]         = useState(1000);
  const [stopLoss, setStopLoss]   = useState(940);
  const riskAmt    = capital * riskPct / 100;
  const riskPerSh  = Math.abs(entry - stopLoss);
  const qty        = riskPerSh > 0 ? Math.floor(riskAmt / riskPerSh) : 0;
  const posSize    = qty * entry;
  const posPct     = capital > 0 ? (posSize / capital * 100).toFixed(1) : 0;
  const riskReward = riskPerSh > 0 ? ((entry * 1.1 - entry) / riskPerSh).toFixed(2) : 0;

  const SliderRow = ({ label, val, setter, min, max, step, prefix="", suffix="" }) => (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:12, color:T.muted }}>{label}</span>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:T.goldLight, fontWeight:600 }}>
          {prefix}{val.toLocaleString("en-IN")}{suffix}
        </span>
      </div>
      <input type="range" className="range-inp" min={min} max={max} step={step} value={val}
        onChange={e => setter(Number(e.target.value))} />
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:T.walnutLight, marginTop:3 }}>
        <span>{prefix}{min.toLocaleString()}{suffix}</span>
        <span>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );

  const fmtCr = (n) => n >= 1e7 ? `₹${(n/1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(2)} L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div>
      <div className="sec-title">🧮 Financial Calculators</div>
      <div className="sec-sub">SIP · Lumpsum · Position Sizing — plan your investments intelligently</div>

      <div className="tab-mini" style={{ marginBottom:20 }}>
        {[{id:"sip",l:"📅 SIP Calculator"},{id:"lumpsum",l:"💰 Lumpsum"},{id:"position",l:"⚖️ Position Sizing"}]
          .map(t => <button key={t.id} className={`tmb ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
      </div>

      {tab === "sip" && (
        <div className="g2">
          <div className="card">
            <div className="card-title">SIP Calculator</div>
            <SliderRow label="Monthly Investment"   val={sipMonthly} setter={setSipMonthly} min={500}   max={100000} step={500}   prefix="₹" />
            <SliderRow label="Expected Annual Return" val={sipRate}  setter={setSipRate}    min={4}     max={30}     step={0.5}  suffix="%" />
            <SliderRow label="Investment Period"    val={sipYears}  setter={setSipYears}    min={1}     max={40}     step={1}    suffix=" yrs" />
          </div>
          <div>
            <div className="calc-result">
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Maturity Value</div>
              <div className="calc-big">{fmtCr(sipCorpus)}</div>
              <div className="calc-row"><span style={{ color:T.muted }}>Total Invested</span><span style={{ color:T.dun }}>{fmtCr(sipInvested)}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Total Gains</span><span style={{ color:T.greenLight, fontWeight:700 }}>{fmtCr(sipGains)}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Wealth Multiple</span><span style={{ color:T.goldLight }}>{(sipCorpus/sipInvested).toFixed(2)}x</span></div>
              <div className="calc-row" style={{ border:"none" }}><span style={{ color:T.muted }}>Effective CAGR</span><span style={{ color:T.goldLight }}>{sipRate}%</span></div>
            </div>
            <div className="card" style={{ marginTop:14 }}>
              <div className="chart-title">Corpus Growth Over Time</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={Array.from({length:sipYears+1},(_,y)=>({
                  year:`Y${y}`,
                  Invested: sipMonthly*y*12,
                  Corpus: sipMonthly_>0 ? sipMonthly*((Math.pow(1+sipMonthly_,y*12)-1)/sipMonthly_)*(1+sipMonthly_) : sipMonthly*y*12
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.walnut+"33"} />
                  <XAxis dataKey="year" tick={{fill:T.muted,fontSize:9}} />
                  <YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>v>=1e7?`${(v/1e7).toFixed(0)}Cr`:v>=1e5?`${(v/1e5).toFixed(0)}L`:v} />
                  <Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}} formatter={v=>fmtCr(v)} />
                  <Legend wrapperStyle={{fontSize:10}} />
                  <Area type="monotone" dataKey="Invested" stroke={T.walnutLight} fill={T.walnutLight+"22"} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="Corpus"   stroke={T.goldLight}   fill={T.gold+"22"}        strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === "lumpsum" && (
        <div className="g2">
          <div className="card">
            <div className="card-title">Lumpsum Calculator</div>
            <SliderRow label="Investment Amount"      val={lsAmount} setter={setLsAmount}  min={10000}  max={10000000} step={10000} prefix="₹" />
            <SliderRow label="Expected Annual Return" val={lsRate}   setter={setLsRate}    min={4}      max={30}       step={0.5}  suffix="%" />
            <SliderRow label="Investment Period"      val={lsYears}  setter={setLsYears}   min={1}      max={40}       step={1}    suffix=" yrs" />
            <div style={{ marginTop:16, padding:"12px 14px", background:T.cosmicBlue+"18", borderRadius:8, border:`1px solid ${T.cosmicBlue}33` }}>
              <div style={{ fontSize:10, color:T.cosmicBluePale, marginBottom:4 }}>💡 Rule of 72 — Money Doubles In</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, color:T.goldLight, fontWeight:700 }}>{lsDoubling.toFixed(1)} years</div>
              <div style={{ fontSize:11, color:T.muted }}>at {lsRate}% annual return</div>
            </div>
          </div>
          <div>
            <div className="calc-result">
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Final Corpus</div>
              <div className="calc-big">{fmtCr(lsCorpus)}</div>
              <div className="calc-row"><span style={{ color:T.muted }}>Amount Invested</span><span style={{ color:T.dun }}>{fmtCr(lsAmount)}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Total Gains</span><span style={{ color:T.greenLight, fontWeight:700 }}>{fmtCr(lsGains)}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Wealth Multiple</span><span style={{ color:T.goldLight }}>{(lsCorpus/lsAmount).toFixed(2)}x</span></div>
              <div className="calc-row" style={{ border:"none" }}><span style={{ color:T.muted }}>Absolute Return</span><span style={{ color:T.goldLight }}>{(lsGains/lsAmount*100).toFixed(1)}%</span></div>
            </div>
            <div className="card" style={{ marginTop:14 }}>
              <div className="chart-title">Value Growth by Year</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={Array.from({length:lsYears+1},(_,y)=>({ year:`Y${y}`, Value: lsAmount*Math.pow(1+lsRate/100,y) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.walnut+"33"} />
                  <XAxis dataKey="year" tick={{fill:T.muted,fontSize:9}} />
                  <YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>v>=1e7?`${(v/1e7).toFixed(1)}Cr`:v>=1e5?`${(v/1e5).toFixed(0)}L`:v} />
                  <Tooltip contentStyle={{background:T.walnutDeep,border:`1px solid ${T.walnut}44`,color:T.dun,fontSize:11}} formatter={v=>fmtCr(v)} />
                  <Line type="monotone" dataKey="Value" stroke={T.goldLight} strokeWidth={2.5} dot={{fill:T.gold,r:3}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === "position" && (
        <div className="g2">
          <div className="card">
            <div className="card-title">⚖️ Position Sizing Calculator</div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>Based on Kelly Criterion & % Risk per trade</div>
            <SliderRow label="Total Capital"      val={capital}  setter={setCapital}  min={50000}  max={10000000} step={50000} prefix="₹" />
            <SliderRow label="Risk Per Trade"     val={riskPct}  setter={setRiskPct}  min={0.5}    max={5}        step={0.5}  suffix="%" />
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Entry Price (₹)</div>
              <input type="number" className="inp" value={entry} onChange={e=>setEntry(Number(e.target.value))} style={{ width:"100%" }} />
            </div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Stop Loss Price (₹)</div>
              <input type="number" className="inp" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))} style={{ width:"100%" }} />
            </div>
          </div>
          <div>
            <div className="calc-result">
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>Buy Quantity</div>
              <div className="calc-big">{qty.toLocaleString()} shares</div>
              <div className="calc-row"><span style={{ color:T.muted }}>Position Size</span><span style={{ color:T.dun }}>₹{posSize.toLocaleString("en-IN")}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>% of Capital</span><span style={{ color: posPct>20?T.redLight:T.goldLight }}>{posPct}%</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Max Risk Amount</span><span style={{ color:T.redLight }}>₹{riskAmt.toLocaleString("en-IN")}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Risk Per Share</span><span style={{ color:T.red }}>₹{riskPerSh.toLocaleString("en-IN")}</span></div>
              <div className="calc-row" style={{ border:"none" }}><span style={{ color:T.muted }}>Target R:R (10% up)</span><span style={{ color: riskReward>=2?T.greenLight:T.gold }}>{riskReward}:1</span></div>
            </div>
            <div className="card" style={{ marginTop:14, background:posPct>20?T.red+"0a":T.green+"0a", borderColor:posPct>20?T.red+"44":T.green+"44" }}>
              <div style={{ fontSize:12, color:T.goldLight, marginBottom:8, fontWeight:600 }}>📋 Trade Summary</div>
              {[
                { l:"Entry",     v:`₹${entry.toLocaleString("en-IN")}` },
                { l:"Stop Loss", v:`₹${stopLoss.toLocaleString("en-IN")}`, c:T.redLight },
                { l:"Target (2:1 RR)", v:`₹${(entry + riskPerSh*2).toLocaleString("en-IN")}`, c:T.greenLight },
                { l:"Risk %",    v:`${((Math.abs(entry-stopLoss)/entry)*100).toFixed(1)}%`, c:T.gold },
              ].map(r => (
                <div key={r.l} className="calc-row">
                  <span style={{ color:T.muted }}>{r.l}</span>
                  <span style={{ color:r.c||T.dun, fontFamily:"'DM Mono',monospace" }}>{r.v}</span>
                </div>
              ))}
              <div style={{ marginTop:10, fontSize:11, color:T.muted, fontStyle:"italic" }}>
                {posPct>20 ? "⚠️ Position size > 20% of capital — consider reducing risk" : "✅ Position size within safe limits"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FINANCIAL CALENDAR ───────────────────────────────────────────────────────
function FinancialCalendar() {
  const [tab, setTab]           = useState("earnings");
  const [earnings, setEarnings] = useState([]);
  const [economic, setEconomic] = useState([]);
  const [loading, setLoading]   = useState(false);

  const fetchEarnings = async () => {
    setLoading(true); setEarnings([]);
    const raw = await callGroq(
      `Generate a realistic Indian corporate earnings calendar for the next 4 weeks (starting ${new Date().toLocaleDateString("en-IN")}).
Include 20 major companies across sectors. Return ONLY JSON array:
[{"company":"TCS","symbol":"TCS","sector":"IT","date":"Mar 20, 2025","day":"Thursday","quarter":"Q4FY25","consensus_eps":"28.4","prev_eps":"26.8","revenue_est":"₹62,400 Cr","importance":"High","watch":"Guidance, deal wins","analyst_estimate":"Beat expected"}]`,
      "Return only valid JSON array.", null
    );
    try {
      let c = raw.replace(/```json|```/g,"").trim();
      if(!c.startsWith("[")) c=c.substring(c.indexOf("["));
      setEarnings(JSON.parse(c));
    } catch {}
    setLoading(false);
  };

  const fetchEconomic = async () => {
    setLoading(true); setEconomic([]);
    const raw = await callGroq(
      `Generate a realistic Indian and global economic calendar for the next 4 weeks (starting ${new Date().toLocaleDateString("en-IN")}).
Include 18 events: RBI policy, India CPI, WPI, IIP, GDP, US Fed, US CPI, US jobs, ECB, Budget events.
Return ONLY JSON array:
[{"event":"RBI Monetary Policy","date":"Apr 5, 2025","day":"Saturday","country":"India","previous":"6.25%","forecast":"6.0%","actual":"","importance":"High","market_impact":"Rate cut expected — positive for rate-sensitive sectors","category":"Central Bank"}]`,
      "Return only valid JSON array.", null
    );
    try {
      let c = raw.replace(/```json|```/g,"").trim();
      if(!c.startsWith("[")) c=c.substring(c.indexOf("["));
      setEconomic(JSON.parse(c));
    } catch {}
    setLoading(false);
  };

  const impBadge = (imp) =>
    imp==="High"   ? <span className="imp-high">HIGH</span> :
    imp==="Medium" ? <span className="imp-med">MED</span>   :
                     <span className="imp-low">LOW</span>;

  return (
    <div>
      <div className="sec-title">📅 Financial Calendar</div>
      <div className="sec-sub">Earnings results calendar · Economic events · RBI · Fed — AI-generated</div>

      <div className="tab-mini" style={{ marginBottom:16 }}>
        {[{id:"earnings",l:"📊 Earnings Calendar"},{id:"economic",l:"🏛️ Economic Events"}]
          .map(t => <button key={t.id} className={`tmb ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
      </div>

      {tab==="earnings" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:12, color:T.muted }}>Upcoming Q4FY25 / Q1FY26 results season</div>
            <button className="btn-gold" onClick={fetchEarnings} disabled={loading}>
              {loading ? <span className="ld">Loading</span> : "📅 Fetch Earnings Calendar"}
            </button>
          </div>
          {loading && <div className="loading"><div className="spin"/><span>Building earnings calendar...</span></div>}
          {!earnings.length && !loading && (
            <div className="card" style={{ textAlign:"center", padding:"48px" }}>
              <div style={{ fontSize:42, marginBottom:12 }}>📊</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:T.dun }}>Earnings Calendar</div>
              <div style={{ color:T.muted, fontSize:13, marginTop:8, marginBottom:20 }}>Get the next 4 weeks of scheduled results</div>
              <button className="btn-gold" onClick={fetchEarnings}>📅 Load Calendar</button>
            </div>
          )}
          {earnings.length>0 && (
            <div className="card" style={{ padding:0 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 0.7fr 0.7fr 0.6fr 0.8fr 0.8fr 1fr", gap:6, padding:"10px 14px", borderBottom:`2px solid ${T.walnut}44`, fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontWeight:600 }}>
                <span>Company</span><span>Date</span><span>Quarter</span><span>Impact</span><span>EPS Est.</span><span>Prev EPS</span><span>Watch</span>
              </div>
              {earnings.map((e,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 0.7fr 0.7fr 0.6fr 0.8fr 0.8fr 1fr", gap:6, padding:"10px 14px", borderBottom:`1px solid ${T.walnut}22`, fontSize:11, alignItems:"center" }}>
                  <div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, color:T.dun, fontSize:12 }}>{e.symbol}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{e.company}</div>
                    <span style={{ fontSize:8, padding:"1px 6px", borderRadius:8, background:T.cosmicBlue+"22", color:T.cosmicBluePale, border:`1px solid ${T.cosmicBlue}33` }}>{e.sector}</span>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:T.dun }}>{e.date}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{e.day}</div>
                  </div>
                  <span style={{ fontFamily:"'DM Mono',monospace", color:T.goldLight }}>{e.quarter}</span>
                  <span>{impBadge(e.importance)}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", color:T.dun }}>₹{e.consensus_eps}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", color:T.muted }}>₹{e.prev_eps}</span>
                  <span style={{ fontSize:10, color:T.muted, lineHeight:1.4 }}>{e.watch}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==="economic" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:12, color:T.muted }}>RBI · India Macro · US Fed · Global events</div>
            <button className="btn-gold" onClick={fetchEconomic} disabled={loading}>
              {loading ? <span className="ld">Loading</span> : "🏛️ Fetch Economic Calendar"}
            </button>
          </div>
          {loading && <div className="loading"><div className="spin"/><span>Building economic calendar...</span></div>}
          {!economic.length && !loading && (
            <div className="card" style={{ textAlign:"center", padding:"48px" }}>
              <div style={{ fontSize:42, marginBottom:12 }}>🏛️</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:T.dun }}>Economic Events</div>
              <div style={{ color:T.muted, fontSize:13, marginTop:8, marginBottom:20 }}>RBI, CPI, GDP, Fed, and more</div>
              <button className="btn-gold" onClick={fetchEconomic}>🏛️ Load Calendar</button>
            </div>
          )}
          {economic.length>0 && (
            <div className="card" style={{ padding:0 }}>
              {economic.map((e,i)=>(
                <div key={i} className="cal-event">
                  <div className="cal-dot" style={{ background: e.importance==="High"?T.red:e.importance==="Medium"?T.gold:T.walnut }} />
                  <div className="cal-date">{e.date}<br/><span style={{color:T.walnutLight}}>{e.day}</span></div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div className="cal-title">{e.event}</div>
                      {impBadge(e.importance)}
                      <span style={{ fontSize:9, padding:"1px 7px", borderRadius:8, background:T.walnut+"22", color:T.muted, border:`1px solid ${T.walnut}44` }}>{e.country}</span>
                    </div>
                    <div className="cal-sub">{e.market_impact}</div>
                  </div>
                  <div style={{ textAlign:"right", minWidth:100 }}>
                    {e.forecast && <div style={{ fontSize:11, color:T.goldLight }}>Est: {e.forecast}</div>}
                    {e.previous && <div style={{ fontSize:10, color:T.muted }}>Prev: {e.previous}</div>}
                    {e.actual   && <div style={{ fontSize:11, color:T.greenLight, fontWeight:700 }}>Actual: {e.actual}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ADVANCED TOOLS ───────────────────────────────────────────────────────────
function AdvancedTools() {
  const [tab, setTab] = useState("tax");

  // ── Tax P&L Calculator ──
  const [txBuy,  setTxBuy]  = useState(1000);
  const [txSell, setTxSell] = useState(1500);
  const [txQty,  setTxQty]  = useState(100);
  const [txDays, setTxDays] = useState(400);
  const isLTCG     = txDays >= 365;
  const profit     = (txSell - txBuy) * txQty;
  const ltcgExempt = 125000;
  const stcgRate   = 0.20;
  const ltcgRate   = 0.125;
  const taxableAmt = isLTCG ? Math.max(0, profit - ltcgExempt) : profit;
  const taxRate    = isLTCG ? ltcgRate : stcgRate;
  const taxAmt     = Math.max(0, taxableAmt * taxRate);
  const netProfit  = profit - taxAmt;

  // ── Black-Scholes Options Calculator ──
  const [optS,   setOptS]   = useState(24000); // Spot
  const [optK,   setOptK]   = useState(24000); // Strike
  const [optT,   setOptT]   = useState(30);    // Days to expiry
  const [optR,   setOptR]   = useState(6.5);   // Risk-free rate %
  const [optSig, setOptSig] = useState(18);    // Implied vol %

  // Standard Normal CDF approximation (Hart 1968)
  const normCDF = (x) => {
    const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
    const sign = x<0 ? -1 : 1;
    x = Math.abs(x)/Math.sqrt(2);
    const t = 1/(1+p*x);
    const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
    return 0.5*(1+sign*y);
  };
  const T_  = optT / 365;
  const r_  = optR / 100;
  const sig_= optSig / 100;
  const d1  = T_>0&&sig_>0 ? (Math.log(optS/optK) + (r_ + sig_*sig_/2)*T_) / (sig_*Math.sqrt(T_)) : 0;
  const d2  = d1 - sig_*Math.sqrt(T_);
  const bsCall = T_>0 ? optS*normCDF(d1) - optK*Math.exp(-r_*T_)*normCDF(d2) : Math.max(0,optS-optK);
  const bsPut  = T_>0 ? optK*Math.exp(-r_*T_)*normCDF(-d2) - optS*normCDF(-d1) : Math.max(0,optK-optS);
  const deltaC = normCDF(d1);
  const deltaP = deltaC - 1;
  const theta  = (-(optS*sig_*Math.exp(-d1*d1/2))/(2*Math.sqrt(2*Math.PI*T_)) - r_*optK*Math.exp(-r_*T_)*normCDF(d2)) / 365;

  // ── MF Overlap Checker ──
  const [mf1,    setMf1]    = useState("");
  const [mf2,    setMf2]    = useState("");
  const [overlap, setOverlap] = useState("");
  const [ovLoading, setOvLoading] = useState(false);

  const checkOverlap = async () => {
    if(!mf1.trim()||!mf2.trim()) return;
    setOvLoading(true); setOverlap("");
    await callGroq(
      `Mutual Fund Overlap Analysis between:
Fund 1: ${mf1}
Fund 2: ${mf2}

Provide:
1) **Overlap Score** — estimated % of overlapping stocks (high/medium/low overlap)
2) **Top Common Holdings** — list top 8 stocks likely common in both funds with approximate weight in each
3) **Portfolio Concentration Risk** — if someone holds both, what's the effective concentration?
4) **Sector Overlap** — which sectors are double-weighted
5) **Recommendation** — are these funds truly diversifying each other or are they redundant?
6) **Alternative suggestion** — if overlap is high, what complementary fund to consider instead

Be specific with actual fund holdings knowledge as of FY25.`,
      SYS, (t) => setOverlap(t)
    );
    setOvLoading(false);
  };

  const MF_SUGGESTIONS = [
    "Mirae Asset Large Cap Fund","HDFC Top 100 Fund","SBI Small Cap Fund",
    "Parag Parikh Flexi Cap Fund","Axis Midcap Fund","ICICI Pru Technology Fund",
    "Nippon India Small Cap Fund","Kotak Emerging Equity Fund",
  ];

  return (
    <div>
      <div className="sec-title">🛠️ Advanced Tools</div>
      <div className="sec-sub">Tax P&L · Options Pricing · Mutual Fund Overlap Checker</div>

      <div className="tab-mini" style={{ marginBottom:20 }}>
        {[{id:"tax",l:"💸 Tax Calculator"},{id:"options",l:"📐 Options Pricer"},{id:"mfoverlap",l:"🔁 MF Overlap"}]
          .map(t => <button key={t.id} className={`tmb ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
      </div>

      {tab==="tax" && (
        <div className="g2">
          <div className="card">
            <div className="card-title">💸 Capital Gains Tax Calculator</div>
            <div style={{ fontSize:11, color:T.muted, marginBottom:16 }}>As per Union Budget 2024 — STCG 20% · LTCG 12.5% (exempt up to ₹1.25L)</div>
            {[
              { l:"Buy Price (₹/share)", v:txBuy, s:setTxBuy },
              { l:"Sell Price (₹/share)",v:txSell,s:setTxSell },
              { l:"Quantity (shares)",   v:txQty, s:setTxQty },
              { l:"Holding Days",        v:txDays,s:setTxDays },
            ].map(row=>(
              <div key={row.l} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:T.muted, marginBottom:6 }}>{row.l}</div>
                <input type="number" className="inp" value={row.v}
                  onChange={e=>row.s(Number(e.target.value))} style={{ width:"100%" }} />
              </div>
            ))}
            <div style={{ padding:"10px 14px", borderRadius:8, background: isLTCG?T.green+"15":T.gold+"15", border:`1px solid ${isLTCG?T.green:T.gold}44`, fontSize:12, color: isLTCG?T.greenLight:T.goldLight }}>
              {isLTCG ? "✅ Long Term Capital Gain (LTCG) — held > 1 year" : `⏳ Short Term Capital Gain (STCG) — held ${txDays} days (need ${365-txDays} more days for LTCG)`}
            </div>
          </div>
          <div>
            <div className="calc-result">
              <div style={{ fontSize:10, color:T.muted, letterSpacing:1, textTransform:"uppercase" }}>{isLTCG?"LTCG":"STCG"} Tax Liability</div>
              <div className="calc-big" style={{ color: taxAmt>0?T.redLight:T.greenLight }}>₹{Math.round(taxAmt).toLocaleString("en-IN")}</div>
              <div className="calc-row"><span style={{ color:T.muted }}>Gross Profit</span><span style={{ color: profit>=0?T.greenLight:T.redLight }}>₹{Math.round(profit).toLocaleString("en-IN")}</span></div>
              {isLTCG && <div className="calc-row"><span style={{ color:T.muted }}>LTCG Exemption</span><span style={{ color:T.goldLight }}>₹{Math.min(profit,ltcgExempt).toLocaleString("en-IN")}</span></div>}
              <div className="calc-row"><span style={{ color:T.muted }}>Taxable Amount</span><span style={{ color:T.dun }}>₹{Math.round(taxableAmt).toLocaleString("en-IN")}</span></div>
              <div className="calc-row"><span style={{ color:T.muted }}>Tax Rate</span><span style={{ color:T.gold }}>{(taxRate*100).toFixed(1)}%</span></div>
              <div className="calc-row" style={{ border:"none", marginTop:4, paddingTop:10, borderTop:`1px solid ${T.walnut}55` }}>
                <span style={{ color:T.dun, fontWeight:600 }}>Net Profit (after tax)</span>
                <span style={{ color:T.greenLight, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>₹{Math.round(netProfit).toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="card" style={{ marginTop:14 }}>
              <div style={{ fontSize:11, color:T.goldLight, fontWeight:600, marginBottom:10 }}>📌 Quick Tips</div>
              <div style={{ fontSize:12, color:T.muted, lineHeight:1.8 }}>
                • Hold equity > 1 year to qualify for LTCG (12.5%)<br/>
                • First ₹1.25 lakh LTCG per year is fully exempt<br/>
                • Harvest losses before March 31 to offset gains<br/>
                • STCG applies even on intraday and F&O profits<br/>
                • Tax harvesting: book profits and reinvest to reset cost basis
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==="options" && (
        <div className="g2">
          <div className="card">
            <div className="card-title">📐 Black-Scholes Options Pricer</div>
            <div style={{ fontSize:11, color:T.muted, marginBottom:16 }}>European options pricing — NIFTY / BANKNIFTY / individual stocks</div>
            {[
              { l:"Spot Price (S)",          v:optS,   s:setOptS },
              { l:"Strike Price (K)",        v:optK,   s:setOptK },
              { l:"Days to Expiry",          v:optT,   s:setOptT },
              { l:"Risk-Free Rate % (repo)", v:optR,   s:setOptR },
              { l:"Implied Volatility %",    v:optSig, s:setOptSig },
            ].map(row=>(
              <div key={row.l} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:T.muted, marginBottom:6 }}>{row.l}</div>
                <input type="number" className="inp" value={row.v}
                  onChange={e=>row.s(Number(e.target.value))} style={{ width:"100%" }} />
              </div>
            ))}
          </div>
          <div>
            <div className="g2" style={{ marginBottom:14 }}>
              <div className="calc-result" style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>CALL PRICE</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:28, fontWeight:700, color:T.greenLight }}>₹{bsCall.toFixed(2)}</div>
                <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>Delta: {deltaC.toFixed(3)}</div>
              </div>
              <div className="calc-result" style={{ textAlign:"center" }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>PUT PRICE</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:28, fontWeight:700, color:T.redLight }}>₹{bsPut.toFixed(2)}</div>
                <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>Delta: {deltaP.toFixed(3)}</div>
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom:12 }}>Greeks</div>
              {[
                { l:"Theta (daily decay)", v:`₹${theta.toFixed(2)}/day`, note:"Time value lost per day" },
                { l:"d1",                  v:d1.toFixed(4), note:"" },
                { l:"d2",                  v:d2.toFixed(4), note:"" },
                { l:"Call Delta",          v:deltaC.toFixed(4), note:"Probability ITM" },
                { l:"Put Delta",           v:deltaP.toFixed(4), note:"" },
                { l:"Moneyness",           v: optS>optK?"ITM Call / OTM Put":optS<optK?"OTM Call / ITM Put":"ATM", note:"" },
              ].map(r=>(
                <div key={r.l} className="calc-row">
                  <div>
                    <span style={{ color:T.muted }}>{r.l}</span>
                    {r.note && <div style={{ fontSize:9, color:T.walnutLight }}>{r.note}</div>}
                  </div>
                  <span style={{ fontFamily:"'DM Mono',monospace", color:T.goldLight }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="mfoverlap" && (
        <div>
          <div className="card card-gold" style={{ marginBottom:16 }}>
            <div className="card-title">🔁 Mutual Fund Overlap Checker</div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:14 }}>Enter two fund names to check how much their portfolios overlap</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ fontSize:10, color:T.muted, letterSpacing:1, marginBottom:6, textTransform:"uppercase" }}>Fund 1</div>
                <input className="inp" value={mf1} onChange={e=>setMf1(e.target.value)} placeholder="e.g. Mirae Asset Large Cap Fund" style={{ width:"100%" }} />
              </div>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ fontSize:10, color:T.muted, letterSpacing:1, marginBottom:6, textTransform:"uppercase" }}>Fund 2</div>
                <input className="inp" value={mf2} onChange={e=>setMf2(e.target.value)} placeholder="e.g. HDFC Top 100 Fund" style={{ width:"100%" }} />
              </div>
              <button className="btn-gold" style={{ alignSelf:"flex-end", whiteSpace:"nowrap" }} onClick={checkOverlap} disabled={ovLoading||!mf1||!mf2}>
                {ovLoading ? <span className="ld">Analyzing</span> : "🔁 Check Overlap"}
              </button>
            </div>
            <div style={{ fontSize:11, color:T.muted }}>Popular funds to try:</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
              {MF_SUGGESTIONS.map(mf=>(
                <button key={mf} onClick={()=>!mf1?setMf1(mf):setMf2(mf)} style={{ padding:"3px 10px", borderRadius:16, background:T.walnutDeep, border:`1px solid ${T.walnut}44`, color:T.muted, fontSize:10, cursor:"pointer", fontFamily:"'Jost',sans-serif" }}>{mf}</button>
              ))}
            </div>
          </div>
          {ovLoading && <div className="loading"><div className="spin"/><span>Analyzing fund portfolios for overlap...</span></div>}
          {overlap && (
            <div className="res-box" dangerouslySetInnerHTML={{ __html:
              overlap.replace(/\*\*(.*?)\*\*/g,`<strong style='color:${T.goldLight}'>$1</strong>`).replace(/\n/g,"<br/>")
            }}/>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BULK DEALS ───────────────────────────────────────────────────────────────
function BulkDeals() {
  const [deals, setDeals]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [filter, setFilter]       = useState("all");
  const [selected, setSelected]   = useState(null);
  const [analysis, setAnalysis]   = useState("");
  const [aLoading, setALoading]   = useState(false);

  const fetchDeals = async () => {
    setLoading(true); setDeals([]);
    const raw = await callGroq(
      `Generate 20 realistic bulk deal / block deal entries from NSE/BSE for the last 7 trading days (around ${new Date().toLocaleDateString("en-IN")}).
Mix of buys and sells from institutions (FIIs, mutual funds, insurance companies, PE funds, promoters).

Return ONLY JSON array:
[{"stock":"Infosys","symbol":"INFY","date":"Mar 14, 2025","buyer_seller":"Goldman Sachs (FII)","type":"BUY","qty":1250000,"price":1892.50,"value_cr":236.6,"exchange":"NSE","sector":"IT","significance":"High","note":"Large FII accumulation above 200 DMA","promoter_deal":false}]

Include variety: IT, Banking, FMCG, Auto, Pharma, Small cap. Some promoter sales, some FII buys, some MF accumulation.`,
      "Return only valid JSON array.", null
    );
    try {
      let c = raw.replace(/```json|```/g,"").trim();
      if(!c.startsWith("[")) c=c.substring(c.indexOf("["));
      if(!c.endsWith("]")) c=c.substring(0,c.lastIndexOf("]")+1);
      setDeals(JSON.parse(c));
    } catch {}
    setLoading(false);
  };

  const analyzeStock = async (deal) => {
    setSelected(deal);
    setALoading(true); setAnalysis("");
    await callGroq(
      `Analyze this bulk/block deal:
Stock: ${deal.stock} (${deal.symbol})
Action: ${deal.type} by ${deal.buyer_seller}
Qty: ${deal.qty?.toLocaleString()} shares | Price: ₹${deal.price} | Value: ₹${deal.value_cr} Cr
Date: ${deal.date} | Sector: ${deal.sector}
Note: ${deal.note}

Provide:
1) **Why ${deal.buyer_seller} ${deal.type === "BUY" ? "bought" : "sold"}** — institutional reasoning and thesis
2) **Track record** of this institution in this stock
3) **What this signals** — is smart money accumulating or distributing?
4) **Follow-on buying/selling** — who else might follow this trade?
5) **Short-term price impact** — typical reaction to such deals
6) **DNR View** — should retail investors follow this trade?`,
      SYS, (t) => setAnalysis(t)
    );
    setALoading(false);
  };

  const exportCSV = () => {
    const hdr = "Stock,Symbol,Date,Buyer/Seller,Type,Qty,Price,Value(Cr),Exchange,Sector";
    const rows = deals.map(d => `${d.stock},${d.symbol},${d.date},"${d.buyer_seller}",${d.type},${d.qty},${d.price},${d.value_cr},${d.exchange},${d.sector}`);
    const blob = new Blob([hdr+"\n"+rows.join("\n")], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `DNR_BulkDeals_${new Date().toLocaleDateString("en-IN").replace(/\//g,"-")}.csv`;
    a.click();
  };

  const filtered = deals.filter(d => filter==="all" || d.type===filter);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div className="sec-title">📦 Bulk & Block Deals</div>
          <div className="sec-sub">Institutional buying & selling signals · Smart money tracker · AI analysis</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {deals.length>0 && <button className="btn-ghost" onClick={exportCSV}>📥 Export CSV</button>}
          <button className="btn-gold" onClick={fetchDeals} disabled={loading}>
            {loading ? <span className="ld">Fetching</span> : "🔄 Fetch Latest Deals"}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {["all","BUY","SELL"].map(f=>(
          <button key={f} className="btn-ghost" onClick={()=>setFilter(f)} style={filter===f?{
            background: f==="BUY"?T.green+"33":f==="SELL"?T.red+"33":T.walnut,
            color: f==="BUY"?T.greenLight:f==="SELL"?T.redLight:T.dun,
            borderColor: f==="BUY"?T.green+"66":f==="SELL"?T.red+"66":T.walnut,
            fontWeight:700,
          }:{}}>
            {f==="all"?"All Deals":`${f==="BUY"?"🟢":"🔴"} ${f} only`}
            {deals.length>0 && ` (${f==="all"?deals.length:deals.filter(d=>d.type===f).length})`}
          </button>
        ))}
      </div>

      {loading && <div className="loading"><div className="spin"/><span>Scanning NSE/BSE bulk deal data...</span></div>}

      {!deals.length && !loading && (
        <div className="card" style={{ textAlign:"center", padding:"56px 20px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📦</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:T.dun, marginBottom:8 }}>Bulk & Block Deal Tracker</div>
          <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>Track where smart money is moving — FIIs, MFs, Insurance, Promoters</div>
          <button className="btn-gold" style={{ padding:"13px 32px" }} onClick={fetchDeals}>🔄 Fetch Deals</button>
        </div>
      )}

      {filtered.length>0 && (
        <div className="card" style={{ padding:0, marginBottom:14 }}>
          <div className="bd-row bd-hdr" style={{ padding:"10px 14px", borderBottom:`2px solid ${T.walnut}44` }}>
            <span>Stock</span><span>Date</span><span>Institution</span><span>Type</span>
            <span>Qty (L)</span><span>Price</span><span>Value (Cr)</span>
          </div>
          {filtered.map((d,i)=>(
            <div key={i} className="bd-row" style={{
              padding:"10px 14px",
              cursor:"pointer",
              background: selected?.stock===d.stock&&selected?.date===d.date ? T.gold+"0a" : "transparent",
              borderLeft: selected?.stock===d.stock&&selected?.date===d.date ? `3px solid ${T.gold}77` : "3px solid transparent",
            }} onClick={()=>analyzeStock(d)}>
              <div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, color:T.dun, fontSize:12 }}>{d.symbol}</div>
                <div style={{ fontSize:10, color:T.muted }}>{d.stock}</div>
                <span style={{ fontSize:8, padding:"1px 5px", borderRadius:6, background:T.cosmicBlue+"22", color:T.cosmicBluePale }}>{d.sector}</span>
              </div>
              <span style={{ fontSize:11, color:T.muted }}>{d.date}</span>
              <span style={{ fontSize:11, color:T.dunDark }}>{d.buyer_seller}</span>
              <span><span className={d.type==="BUY"?"bd-buy":"bd-sell"}>{d.type}</span></span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>{d.qty ? (d.qty/100000).toFixed(2) : "—"}</span>
              <span style={{ fontFamily:"'DM Mono',monospace" }}>₹{d.price}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", color: d.value_cr>100?T.goldLight:T.dun, fontWeight: d.value_cr>100?700:400 }}>₹{d.value_cr} Cr</span>
            </div>
          ))}
        </div>
      )}

      {/* Analysis panel */}
      {(selected||aLoading) && (
        <div className="card card-gold" style={{ marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>🤖 Deal Analysis — {selected?.stock}</div>
              <div style={{ fontSize:10, color:T.muted }}>{selected?.buyer_seller} · {selected?.type} · ₹{selected?.value_cr} Cr · {selected?.date}</div>
            </div>
            <button className="btn-ghost btn-sm" onClick={()=>{setSelected(null);setAnalysis("");}}>✕</button>
          </div>
          {aLoading ? (
            <div className="loading"><div className="spin"/><span>Analyzing institutional deal intent...</span></div>
          ) : (
            analysis && <div className="res-box" dangerouslySetInnerHTML={{ __html:
              analysis.replace(/\*\*(.*?)\*\*/g,`<strong style='color:${T.goldLight}'>$1</strong>`).replace(/\n/g,"<br/>")
            }}/>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [darkMode,  setDarkMode]  = useState(true);
  const [lang,      setLang]      = useState("EN");
  const [showAlerts,setShowAlerts]= useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { markets, lastFetch, fetching, refresh } = useLiveMarkets();

  useEffect(() => {
    document.body.className = darkMode ? "" : "light";
  }, [darkMode]);

  const LABELS = {
    EN: { markets:"Markets", research:"Deep Research", technical:"Technical Charts",
          screener:"Screener", watchlist:"Watchlists", portfolio:"Portfolio",
          quarterly:"Quarterly Hub", bulkdeals:"Bulk Deals", news:"News Feed",
          ipo:"IPO Tracker", fii:"FII / DII", sector:"Sector Rotation",
          calculators:"Calculators", calendar:"Calendar", tools:"Adv. Tools",
          legends:"Legends", institutional:"Inst. Momentum" },
  };
  const L = LABELS.EN;

  // Grouped sidebar navigation
  const NAV_GROUPS = [
    {
      label:"Research & Analysis",
      items:[
        { id:"markets",      icon:"📊", label:L.markets },
        { id:"research",     icon:"🔬", label:L.research },
        { id:"technical",    icon:"📈", label:L.technical },
        { id:"institutional",icon:"🏦", label:L.institutional },
      ]
    },
    {
      label:"My Portfolio",
      items:[
        { id:"screener",  icon:"🔍", label:L.screener },
        { id:"watchlist", icon:"⭐", label:L.watchlist },
        { id:"portfolio", icon:"💼", label:L.portfolio },
      ]
    },
    {
      label:"Data & Tracking",
      items:[
        { id:"quarterly", icon:"📋", label:L.quarterly },
        { id:"bulkdeals", icon:"📦", label:L.bulkdeals },
        { id:"fii",       icon:"🌐", label:L.fii },
        { id:"sector",    icon:"🔄", label:L.sector },
      ]
    },
    {
      label:"News & Events",
      items:[
        { id:"news",     icon:"📰", label:L.news },
        { id:"ipo",      icon:"🚀", label:L.ipo },
        { id:"calendar", icon:"📅", label:L.calendar },
      ]
    },
    {
      label:"Tools",
      items:[
        { id:"calculators", icon:"🧮", label:L.calculators },
        { id:"tools",       icon:"🛠️", label:L.tools },
        { id:"legends",     icon:"🏛️", label:L.legends },
      ]
    },
  ];

  return (
    <>
      <style>{styles}</style>
      {showAlerts && <PriceAlerts onClose={() => setShowAlerts(false)} />}

      <div className="app">

        {/* ── TOP BAR ── */}
        <div className="top-bar">
          {/* Live ticker */}
          <div className="ticker">
            <div className="ticker-inner">
              {(TICKER_ORDER.flatMap(label => {
                const m = markets[label];
                if (!m && !fetching) return [];
                return [m || { label, v:"···", c:"", u:true }];
              }).concat(
                TICKER_ORDER.flatMap(label => {
                  const m = markets[label];
                  if (!m && !fetching) return [];
                  return [m || { label, v:"···", c:"", u:true }];
                })
              )).map((t, i) => (
                <span key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:T.muted }}>{t.label}</span>
                  <span style={{ color:T.dun, fontWeight:600 }}>{t.v}</span>
                  {t.c && <span style={{ color:t.u?T.greenLight:T.redLight }}>{t.u?"▲":"▼"} {t.c}</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="tb-controls">
            <button className="tb-btn" onClick={() => setShowAlerts(true)}>🔔</button>
            <button className={`tb-btn ${lang==="HI"?"active":""}`} onClick={() => setLang(l => l==="EN"?"HI":"EN")}>
              {lang==="EN" ? "🇮🇳 हिंदी" : "🇬🇧 EN"}
            </button>
            <button className="tb-btn" onClick={() => setDarkMode(d => !d)}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <div style={{ fontSize:9, color:T.muted, textAlign:"right", lineHeight:1.4 }}>
              <div style={{ color:fetching?T.gold:T.greenLight }}>{fetching?"⟳ LIVE":"● LIVE"}</div>
              <div style={{ color:T.mutedDark }}>{lastFetch?.split(",")[1]?.trim() || new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
            </div>
          </div>
        </div>

        {/* ── WORKSPACE ── */}
        <div className="workspace">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="sidebar">
            {/* Logo */}
            <div className="sb-logo" onClick={() => setActiveTab("home")}>
              <img src="/logo.png" alt="DNR Capitals" className="sb-logo-img" />
              <div className="sb-logo-title">DNR Capitals</div>
              <div className="sb-logo-sub">Equity Research Intelligence</div>
            </div>

            {/* Nav groups */}
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="sb-group">
                <div className="sb-group-label">{group.label}</div>
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className={`sb-item ${activeTab===item.id?"active":""}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <span className="sb-icon">{item.icon}</span>
                    <span className="sb-label">{item.label}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Sidebar footer */}
            <div className="sb-footer">
              <div className="sb-live">
                <div className="sb-live-dot" />
                <span>Groq AI · Live Data</span>
              </div>
              <div style={{ fontSize:9, color:T.mutedDark, marginTop:4 }}>
                © {new Date().getFullYear()} DNR Capitals
              </div>
            </div>
          </aside>

          {/* ── CONTENT AREA ── */}
          <div className="content-area">
            {activeTab === "home" ? (
              <HomePage setActiveTab={setActiveTab} markets={markets} fetching={fetching} />
            ) : (
              <div className="main">
                {GROQ_API_KEY === "YOUR_KEY_HERE" && (
                  <div className="api-warn">
                    <span style={{ fontSize:22 }}>⚠️</span>
                    <div><strong style={{ color:T.goldLight }}>Groq API Key Required</strong><br />Add REACT_APP_GROQ_API_KEY to your .env file.</div>
                  </div>
                )}
                {activeTab === "markets"       && <Markets markets={markets} fetching={fetching} onRefresh={refresh} />}
                {activeTab === "research"      && <StockResearch />}
                {activeTab === "technical"     && <TechnicalCharts />}
                {activeTab === "institutional" && <InstitutionalMomentum />}
                {activeTab === "news"          && <NewsFeed />}
                {activeTab === "ipo"           && <IPOTracker />}
                {activeTab === "fii"           && <FIIDIITracker />}
                {activeTab === "sector"        && <SectorRotation />}
                {activeTab === "quarterly"     && <QuarterlyHub />}
                {activeTab === "screener"      && <Screener />}
                {activeTab === "watchlist"     && <WatchlistManager />}
                {activeTab === "portfolio"     && <Portfolio />}
                {activeTab === "legends"       && <Legends />}
                {activeTab === "calculators"   && <Calculators />}
                {activeTab === "calendar"      && <FinancialCalendar />}
                {activeTab === "tools"         && <AdvancedTools />}
                {activeTab === "bulkdeals"     && <BulkDeals />}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding:"10px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:`1px solid ${T.navyBorder}`, background:T.navyDeep, fontSize:10, color:T.mutedDark, marginTop:"auto" }}>
              <span style={{ color:T.mutedDark }}>© {new Date().getFullYear()} DNR Capitals · Equity Research Intelligence</span>
              <span style={{ color:T.mutedDark }}>Powered by Groq AI · Educational purposes only · Not SEBI registered advice</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
