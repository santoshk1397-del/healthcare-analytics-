import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───
const DISTRICTS_META = [
  { id: 1, name: "Raipur", zone: "Central", population: 4063872 },
  { id: 2, name: "Bilaspur", zone: "North", population: 2663629 },
  { id: 3, name: "Durg", zone: "Central", population: 3343079 },
  { id: 4, name: "Korba", zone: "North", population: 1206640 },
  { id: 5, name: "Rajnandgaon", zone: "West", population: 1537133 },
  { id: 6, name: "Bastar", zone: "South", population: 1411644 },
  { id: 7, name: "Surguja", zone: "North", population: 2361329 },
  { id: 8, name: "Janjgir-Champa", zone: "East", population: 1619707 },
  { id: 9, name: "Mahasamund", zone: "East", population: 1032754 },
  { id: 10, name: "Kawardha", zone: "West", population: 822526 },
  { id: 11, name: "Dhamtari", zone: "South", population: 799781 },
  { id: 12, name: "Kanker", zone: "South", population: 748593 },
];

const DISEASES = ["Diabetes", "Hypertension", "Cardiovascular", "COPD", "Cancer", "Stroke"];
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const QUARTERS = ["Q1 2024-25", "Q2 2024-25", "Q3 2024-25", "Q4 2024-25"];
const YEAR = 2026

// ─── CSV Template Generator ───
const CSV_HEADERS = "district_name,month,year,disease_type,cases,screening_target,screening_achieved,budget_allocated_lakhs,budget_utilized_lakhs,hr_sanctioned,hr_in_position,drug_availability_pct";

function generateSampleCSV() {
  const rows = [CSV_HEADERS];
  const sample = [
    ["Raipur", "Apr", YEAR, "Diabetes"],
    ["Bilaspur", "May", YEAR, "Hypertension"],
    ["Durg", "Jun", YEAR, "Cardiovascular"],
  ];
  sample.forEach(([district, month, year, disease]) => {
    rows.push(`${district},${month},${year},${disease},120,50000,32000,15,10,6,4,75`);
  });
  return rows.join("\n");
}

// ─── CSV Parser ───
const parseCSV = (file) => {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      const rawRows = res.data;

      // 🔹 KEEP YOUR EXISTING LOGIC HERE
      // (this is whatever you already do to build charts / district data)
      const processed = buildDistrictData(rawRows); 
      // 👆 replace with your actual function / logic

      setResult({
        data: processed,     // ✅ UI data (unchanged)
        rawRows: rawRows,    // 🔥 ADD THIS (important)
        rowCount: rawRows.length,
        districtCount: new Set(rawRows.map(r => r.district_name)).size,
      });
    },
  });
};

  const data = Object.values(districtMap).map(d => ({
    id: d.id, name: d.name, zone: d.zone, population: d.population,
    totalCases: d._cases,
    prevalenceRate: d.population > 0 ? (d._cases / d.population * 10000).toFixed(1) : "0",
    screeningRate: d._scrT > 0 ? (d._scrA / d._scrT * 100).toFixed(1) : "0",
    screeningTarget: d._scrT, screeningAchieved: d._scrA,
    budgetAllocated: d._budA * 100000,
    budgetUtilized: d._budA > 0 ? d._budU / d._budA : 0,
    hrSanctioned: d._hrS, hrFilled: d._hrS > 0 ? d._hrF / d._hrS : 0,
    drugAvailability: d._drugN > 0 ? (d._drugSum / d._drugN).toFixed(1) : "0",
    diseaseBreakdown: DISEASES.map(disease => ({ disease, cases: d._disease[disease] || 0, trend: -5 + Math.random() * 15 })),
    monthlyTrend: MONTHS.map(m => ({ month: m, cases: d._month[m] || 0, screenings: d._monthScr[m] || 0 })),
    quarterlyBudget: QUARTERS.map(q => ({ quarter: q, allocated: Math.round(d._budA * 100000 / 4), utilized: Math.round(d._budU * 100000 / 4) })),
  }));

  return { data, error: null, warnings: errors, rowCount: rows.length, districtCount: data.length };
}

// ─── Seed Data ───
function generateSeedData() {
  const rng = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  return DISTRICTS_META.map(d => {
    const bp = 800 + rng() * 2200, sr = 0.35 + rng() * 0.55, bu = 0.45 + rng() * 0.50, hf = 0.50 + rng() * 0.45, da = 0.55 + rng() * 0.40;
    return { ...d, totalCases: Math.round(bp * (d.population / 1e6)), prevalenceRate: (bp / 10000).toFixed(1), screeningRate: (sr * 100).toFixed(1), screeningTarget: Math.round(d.population * 0.3), screeningAchieved: Math.round(d.population * 0.3 * sr), budgetAllocated: Math.round(d.population * 12 + rng() * 5e6), budgetUtilized: bu, hrSanctioned: Math.round(d.population / 15000), hrFilled: hf, drugAvailability: (da * 100).toFixed(1),
      diseaseBreakdown: DISEASES.map(disease => ({ disease, cases: Math.round((bp * (d.population / 1e6)) * (0.05 + rng() * 0.35)), trend: -5 + rng() * 15 })),
      monthlyTrend: MONTHS.map(m => ({ month: m, cases: Math.round(bp * (d.population / 1e6) / 12 * (0.7 + rng() * 0.6)), screenings: Math.round(d.population * 0.025 * (0.6 + rng() * 0.8)) })),
      quarterlyBudget: QUARTERS.map(q => ({ quarter: q, allocated: Math.round(d.population * 3 + rng() * 1.2e6), utilized: Math.round(d.population * 3 * bu * (0.8 + rng() * 0.4)) })),
    };
  });
}

function computeTotals(dd) {
  const n = dd.length || 1;
  return { totalPopulation: dd.reduce((s, d) => s + (d.population || 0), 0), totalCases: dd.reduce((s, d) => s + d.totalCases, 0), avgScreening: (dd.reduce((s, d) => s + parseFloat(d.screeningRate), 0) / n).toFixed(1), avgBudgetUtil: (dd.reduce((s, d) => s + d.budgetUtilized, 0) / n * 100).toFixed(1), totalBudget: dd.reduce((s, d) => s + d.budgetAllocated, 0), avgDrugAvail: (dd.reduce((s, d) => s + parseFloat(d.drugAvailability), 0) / n).toFixed(1), avgHrFill: (dd.reduce((s, d) => s + d.hrFilled, 0) / n * 100).toFixed(1) };
}

// ─── Palette ───
const P = { bg: "#0B0F1A", surface: "#111827", surfaceAlt: "#1A2035", border: "#1E293B", borderLight: "#334155", text: "#E2E8F0", textMuted: "#94A3B8", textDim: "#64748B", accent: "#06B6D4", accentGlow: "rgba(6,182,212,0.15)", green: "#10B981", red: "#EF4444", amber: "#F59E0B", purple: "#8B5CF6", blue: "#3B82F6", blueDim: "rgba(59,130,246,0.15)", purpleDim: "rgba(139,92,246,0.15)", amberDim: "rgba(245,158,11,0.15)" };
const DC = { Diabetes: "#06B6D4", Hypertension: "#EF4444", Cardiovascular: "#F59E0B", COPD: "#8B5CF6", Cancer: "#EC4899", Stroke: "#10B981" };

// ─── Icons ───
const I = {
  Report: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Chat: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Up: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Down: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Activity: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Target: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Wallet: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  Pill: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 1.5l-8 8a4.95 4.95 0 007 7l8-8a4.95 4.95 0 00-7-7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  Bot: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>,
  Upload: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Warn: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  File: () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};

// ─── Shared UI ───
function Bar({ value, max = 100, color = P.accent, h = 6 }) {
  return <div style={{ width: "100%", height: h, background: P.border, borderRadius: h / 2, overflow: "hidden" }}><div style={{ width: `${Math.min(value / max * 100, 100)}%`, height: "100%", background: color, borderRadius: h / 2, transition: "width 0.8s ease" }} /></div>;
}
function KPI({ icon: Icon, label, value, sub, color }) {
  return <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "20px 22px", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} /><div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color, marginBottom: 12 }}><Icon /></div><div style={{ fontSize: 26, fontWeight: 700, color: P.text }}>{value}</div><div style={{ fontSize: 12, color: P.textDim, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{label}</div>{sub && <div style={{ fontSize: 12, color: P.textMuted, marginTop: 4 }}>{sub}</div>}</div>;
}
function BarChart({ data, lk, vk, color = P.accent, h = 200 }) {
  const max = Math.max(...data.map(d => d[vk]), 1);
  return <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: h, padding: "0 4px" }}>{data.map((d, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><div style={{ fontSize: 9, color: P.textDim, fontWeight: 600 }}>{d[vk] >= 1000 ? (d[vk] / 1000).toFixed(0) + "k" : d[vk]}</div><div style={{ width: "100%", maxWidth: 32, height: Math.max((d[vk] / max) * (h - 24), 2), background: `linear-gradient(180deg, ${color}, ${color}88)`, borderRadius: "4px 4px 2px 2px" }} /><div style={{ fontSize: 9, color: P.textDim }}>{d[lk]}</div></div>)}</div>;
}
function Donut({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.cases, 0);
  if (!total) return <div style={{ color: P.textDim }}>No data</div>;
  let cum = 0; const segs = data.map(d => { const s = cum; cum += d.cases / total; return { ...d, s, e: cum }; });
  const r = size / 2 - 12, cx = size / 2, cy = size / 2;
  return <div style={{ display: "flex", alignItems: "center", gap: 20 }}><svg width={size} height={size}>{segs.map((seg, i) => { const sa = seg.s * 2 * Math.PI - Math.PI / 2, ea = seg.e * 2 * Math.PI - Math.PI / 2; return <path key={i} d={`M${cx},${cy} L${cx + r * Math.cos(sa)},${cy + r * Math.sin(sa)} A${r},${r} 0 ${ea - sa > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(ea)},${cy + r * Math.sin(ea)} Z`} fill={DC[seg.disease] || P.accent} opacity="0.85" stroke={P.surface} strokeWidth="2" />; })}<circle cx={cx} cy={cy} r={r * 0.55} fill={P.surface} /><text x={cx} y={cy - 4} textAnchor="middle" fill={P.text} fontSize="18" fontWeight="700">{(total / 1000).toFixed(0)}k</text><text x={cx} y={cy + 12} textAnchor="middle" fill={P.textDim} fontSize="9">TOTAL</text></svg><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{data.map(d => <div key={d.disease} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: DC[d.disease] || P.accent }} /><span style={{ color: P.textMuted, minWidth: 90 }}>{d.disease}</span><span style={{ color: P.text, fontWeight: 600 }}>{d.cases.toLocaleString()}</span></div>)}</div></div>;
}

// ─── Heatmap ───
function Heatmap({ dd }) {
  const [metric, setMetric] = useState("cases");
  const [hov, setHov] = useState(null);
  const matrix = dd.map(d => ({ name: d.name, zone: d.zone, pop: d.population, vals: DISEASES.map(dis => { const e = d.diseaseBreakdown.find(x => x.disease === dis) || { cases: 0, trend: 0 }; return { disease: dis, cases: e.cases, prev: d.population > 0 ? ((e.cases / d.population) * 1e5).toFixed(1) : "0", trend: e.trend }; }), total: d.diseaseBreakdown.reduce((s, x) => s + x.cases, 0) }));
  const all = matrix.flatMap(r => r.vals.map(v => metric === "cases" ? v.cases : metric === "prev" ? parseFloat(v.prev) : v.trend));
  const mn = Math.min(...all), mx = Math.max(...all);
  const getCol = (v) => { if (metric === "trend") { return v <= 0 ? `rgba(16,185,129,${0.15 + Math.min(1, Math.abs(v) / Math.max(Math.abs(mn), 1)) * 0.75})` : `rgba(239,68,68,${0.15 + Math.min(1, v / Math.max(mx, 1)) * 0.75})`; } const t = (v - mn) / (mx - mn || 1); return t < 0.33 ? `rgba(6,182,212,${0.15 + t * 2})` : t < 0.66 ? `rgba(245,158,11,${0.2 + (t - 0.33) * 2})` : `rgba(239,68,68,${0.3 + (t - 0.66) * 2})`; };
  const getTxt = (v) => { if (metric === "trend") return Math.abs(v) > Math.max(Math.abs(mn), Math.abs(mx)) * 0.5 ? "#fff" : P.text; return ((v - mn) / (mx - mn || 1)) > 0.5 ? "#fff" : P.text; };
  const fmt = (v) => metric === "cases" ? v.cases.toLocaleString() : metric === "prev" ? v.prev : (v.trend >= 0 ? "+" : "") + v.trend.toFixed(1) + "%";

  return <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Disease Heatmap</div><div style={{ fontSize: 12, color: P.textDim, marginTop: 4 }}>District × Disease intensity</div></div>
      <div style={{ display: "flex", gap: 6 }}>{[{ id: "cases", l: "Cases" }, { id: "prev", l: "Per 100k" }, { id: "trend", l: "Trend %" }].map(m => <button key={m.id} onClick={() => setMetric(m.id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${metric === m.id ? P.accent : P.border}`, background: metric === m.id ? P.accentGlow : P.surface, color: metric === m.id ? P.accent : P.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>{m.l}</button>)}</div>
    </div>
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ width: 130, minWidth: 130, padding: "12px 14px", fontSize: 10, fontWeight: 700, color: P.textDim, textTransform: "uppercase" }}>District</div>
        {DISEASES.map(d => <div key={d} style={{ flex: 1, padding: "12px 4px", textAlign: "center", fontSize: 9, fontWeight: 700, color: P.textDim, textTransform: "uppercase" }}>{d}</div>)}
        <div style={{ width: 70, minWidth: 70, padding: "12px 4px", textAlign: "center", fontSize: 10, fontWeight: 700, color: P.textDim }}>TOTAL</div>
      </div>
      {matrix.map((row, ri) => <div key={row.name} style={{ display: "flex", borderBottom: ri < matrix.length - 1 ? `1px solid ${P.border}` : "none" }} onMouseEnter={e => e.currentTarget.style.background = P.surfaceAlt} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ width: 130, minWidth: 130, padding: "10px 14px", borderRight: `1px solid ${P.border}` }}><div style={{ fontSize: 12, fontWeight: 700, color: P.text }}>{row.name}</div><div style={{ fontSize: 10, color: P.textDim }}>{row.zone}</div></div>
        {row.vals.map((v, ci) => { const val = metric === "cases" ? v.cases : metric === "prev" ? parseFloat(v.prev) : v.trend; const isH = hov?.r === ri && hov?.c === ci;
          return <div key={v.disease} onMouseEnter={() => setHov({ r: ri, c: ci })} onMouseLeave={() => setHov(null)} style={{ flex: 1, padding: "8px 3px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ width: "100%", height: 38, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", background: getCol(val), color: getTxt(val), fontSize: 11, fontWeight: 700, transform: isH ? "scale(1.08)" : "scale(1)", transition: "all 0.15s" }}>{fmt(v)}</div>
            {isH && <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", background: P.bg, border: `1px solid ${P.borderLight}`, borderRadius: 8, padding: "8px 12px", zIndex: 50, minWidth: 150, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.text, marginBottom: 4 }}>{row.name} — {v.disease}</div>
              <div style={{ fontSize: 10, color: P.textMuted }}><div>Cases: <b style={{ color: P.text }}>{v.cases.toLocaleString()}</b></div><div>Prev: <b style={{ color: P.text }}>{v.prev}/100k</b></div><div>Trend: <b style={{ color: v.trend > 0 ? P.red : P.green }}>{v.trend >= 0 ? "+" : ""}{v.trend.toFixed(1)}%</b></div></div>
            </div>}
          </div>; })}
        <div style={{ width: 70, minWidth: 70, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: `1px solid ${P.border}`, fontSize: 12, fontWeight: 800, color: P.text }}>{row.total.toLocaleString()}</div>
      </div>)}
    </div>
  </div>;
}

// ─── Reports ───
function Reports({ dd, st }) {
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const s = dd.find(d => d.id === sel);
  const tabs = [{ id: "dashboard", l: "Dashboard" }, { id: "heatmap", l: "Heatmap" }, { id: "screening", l: "Screening" }, { id: "disease", l: "Disease Trends" }, { id: "budget", l: "Budget" }];
  const totDis = DISEASES.map(dis => ({ disease: dis, cases: dd.reduce((sum, d) => sum + (d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0), 0) }));

  return <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ display: "flex", gap: 2, padding: "0 28px", borderBottom: `1px solid ${P.border}`, background: P.surface, overflowX: "auto" }}>
      {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "12px 16px", background: "none", border: "none", color: tab === t.id ? P.accent : P.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${P.accent}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", fontFamily: "'DM Sans'" }}>{t.l}</button>)}
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
      {tab === "dashboard" && <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
          <KPI icon={I.Activity} label="Total Cases" value={st.totalCases.toLocaleString()} sub={`Pop: ${(st.totalPopulation / 1e6).toFixed(1)}M`} color={P.accent} />
          <KPI icon={I.Target} label="Screening" value={`${st.avgScreening}%`} color={P.green} />
          <KPI icon={I.Wallet} label="Budget Util." value={`${st.avgBudgetUtil}%`} sub={`₹${(st.totalBudget / 1e7).toFixed(0)} Cr`} color={P.purple} />
          <KPI icon={I.Pill} label="Drug Avail." value={`${st.avgDrugAvail}%`} color={P.amber} />
          <KPI icon={I.Users} label="HR Filled" value={`${st.avgHrFill}%`} color={P.blue} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}><div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>Disease Distribution</div><Donut data={totDis} /></div>
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}><div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>Monthly Registrations</div><BarChart data={MONTHS.map((m, i) => ({ m, c: dd.reduce((sum, d) => sum + (d.monthlyTrend[i]?.cases || 0), 0) }))} lk="m" vk="c" h={180} /></div>
        </div>
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>District Performance</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["District", "Cases", "Screening", "Drugs", "Budget"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: h === "District" ? "left" : "right", color: P.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${P.border}` }}>{h}</th>)}</tr></thead>
              <tbody>{dd.map(d => <tr key={d.id} onClick={() => setSel(d.id)} style={{ cursor: "pointer", background: sel === d.id ? P.accentGlow : "transparent" }} onMouseEnter={e => { if (sel !== d.id) e.currentTarget.style.background = P.surfaceAlt; }} onMouseLeave={e => { if (sel !== d.id) e.currentTarget.style.background = "transparent"; }}>
                <td style={{ padding: "11px 14px", fontWeight: 600, color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.name}</td>
                <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.totalCases.toLocaleString()}</td>
                <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${P.border}` }}><div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}><Bar value={parseFloat(d.screeningRate)} color={parseFloat(d.screeningRate) > 65 ? P.green : parseFloat(d.screeningRate) > 45 ? P.amber : P.red} /><span style={{ color: P.text, minWidth: 36 }}>{d.screeningRate}%</span></div></td>
                <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${P.border}`, color: parseFloat(d.drugAvailability) > 75 ? P.green : parseFloat(d.drugAvailability) > 55 ? P.amber : P.red, fontWeight: 600 }}>{d.drugAvailability}%</td>
                <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${P.border}`, color: d.budgetUtilized > 0.75 ? P.green : d.budgetUtilized > 0.55 ? P.amber : P.red, fontWeight: 600 }}>{(d.budgetUtilized * 100).toFixed(1)}%</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        {s && <div style={{ background: P.surface, border: `1px solid ${P.accent}40`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}><div><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>{s.name}</div><div style={{ fontSize: 12, color: P.textDim }}>{s.zone} Zone · Pop: {(s.population / 1e5).toFixed(1)}L</div></div><button onClick={() => setSel(null)} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 6, padding: "6px 14px", color: P.textMuted, fontSize: 12, cursor: "pointer" }}>Close</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>{s.diseaseBreakdown.map(d => <div key={d.disease} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: DC[d.disease] }} /><span style={{ fontSize: 12, color: P.textMuted, flex: 1 }}>{d.disease}</span><span style={{ fontSize: 12, color: P.text, fontWeight: 600 }}>{d.cases.toLocaleString()}</span></div>)}</div>
            <BarChart data={s.monthlyTrend} lk="month" vk="cases" color={P.accent} h={160} />
          </div>
        </div>}
      </div>}
      {tab === "heatmap" && <Heatmap dd={dd} />}
      {tab === "screening" && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Screening Coverage</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>{[...dd].sort((a, b) => parseFloat(a.screeningRate) - parseFloat(b.screeningRate)).map(d => { const r = parseFloat(d.screeningRate); const c = r > 65 ? P.green : r > 45 ? P.amber : P.red; return <div key={d.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{d.name}</span><span style={{ fontSize: 22, fontWeight: 800, color: c }}>{d.screeningRate}%</span></div><Bar value={r} color={c} h={8} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: P.textDim }}><span>Target: {(d.screeningTarget / 1000).toFixed(0)}k</span><span>Done: {(d.screeningAchieved / 1000).toFixed(0)}k</span></div></div>; })}</div></div>}
      {tab === "disease" && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Disease Trends</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>{DISEASES.map(dis => { const ma = MONTHS.map((m, i) => ({ m, c: dd.reduce((sum, d) => sum + Math.round((d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0) / 12 * (0.8 + Math.sin(i * 0.7) * 0.3)), 0) })); const t = dd.reduce((sum, d) => sum + (d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0), 0); return <div key={dis} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: DC[dis] }} /><span style={{ fontSize: 15, fontWeight: 700, color: P.text }}>{dis}</span></div><span style={{ fontSize: 18, fontWeight: 800, color: P.text }}>{t.toLocaleString()}</span></div><BarChart data={ma} lk="m" vk="c" color={DC[dis]} h={120} /></div>; })}</div></div>}
      {tab === "budget" && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Budget & Resources</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{[...dd].sort((a, b) => a.budgetUtilized - b.budgetUtilized).map(d => <div key={d.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 18 }}><div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 14 }}>{d.name}</div>{[{ l: "Budget", v: d.budgetUtilized * 100, c: d.budgetUtilized > 0.75 ? P.green : d.budgetUtilized > 0.55 ? P.amber : P.red }, { l: "HR Fill", v: d.hrFilled * 100, c: P.blue }, { l: "Drugs", v: parseFloat(d.drugAvailability), c: P.amber }].map(m => <div key={m.l} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.textDim, marginBottom: 5 }}><span>{m.l}</span><span style={{ fontWeight: 700, color: P.text }}>{m.v.toFixed(0)}%</span></div><Bar value={m.v} color={m.c} h={7} /></div>)}</div>)}</div></div>}
    </div>
  </div>;
}

// ─── AI Chat ───
function Chat({ dd, st }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Welcome to the NCD Analytics AI Assistant. I have access to the complete NCD surveillance dataset for your state.\n\nAsk me about district performance, disease trends, screening coverage, or budget utilization.\n\nHow can I help?" }]);
  const [inp, setInp] = useState(""); const [loading, setLoading] = useState(false);
  const endRef = useRef(null); const inpRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = useCallback(async () => {
    if (!inp.trim() || loading) return;
    const msg = inp.trim(); setInp("");
    const next = [...msgs, { role: "user", content: msg }]; setMsgs(next); setLoading(true);
    try {
      const ctx = dd.map(d => `${d.name}: Cases=${d.totalCases}, Screening=${d.screeningRate}%, Drug=${d.drugAvailability}%, Budget=${(d.budgetUtilized*100).toFixed(0)}%, HR=${(d.hrFilled*100).toFixed(0)}%, Zone=${d.zone}, Pop=${(d.population/1e5).toFixed(1)}L, [${d.diseaseBreakdown.map(x => `${x.disease}:${x.cases}`).join(',')}]`).join("\n");
      const apiMsgs = next.filter((m, i) => !(i === 0 && m.role === "assistant")).slice(-10);
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: `You are an NCD analytics AI for Chhattisgarh state health officials.\n\nData:\nState: Pop ${(st.totalPopulation/1e6).toFixed(1)}M, Cases ${st.totalCases.toLocaleString()}, Screening ${st.avgScreening}%, Budget ${st.avgBudgetUtil}%, Drugs ${st.avgDrugAvail}%\n\n${ctx}\n\nCite specific numbers. Be concise. Recommend WHO/NPCDCS interventions. Professional tone.`, messages: apiMsgs }) });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setMsgs(p => [...p, { role: "assistant", content: data.content?.map(i => i.text || "").filter(Boolean).join("\n") || "Could not process. Try again." }]);
    } catch (e) { console.error(e); setMsgs(p => [...p, { role: "assistant", content: "Unable to connect. Please try again." }]); }
    setLoading(false);
  }, [inp, loading, msgs, dd, st]);

  const sugg = ["Which districts need urgent screening attention?", "Recommend interventions for Bastar", "Compare zone-wise performance", "Diabetes trend analysis"];

  return <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      {msgs.map((m, i) => <div key={i} style={{ display: "flex", gap: 12, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
        {m.role === "assistant" && <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Bot /></div>}
        <div style={{ maxWidth: "75%", padding: "14px 18px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? P.accent : P.surface, border: m.role === "user" ? "none" : `1px solid ${P.border}`, color: m.role === "user" ? "#fff" : P.text, fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{m.content}</div>
      </div>)}
      {loading && <div style={{ display: "flex", gap: 12 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Bot /></div><div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: "16px 16px 16px 4px", padding: "14px 20px", display: "flex", gap: 6 }}>{[0,1,2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: P.accent, animation: `pulse 1.2s ease ${j*0.2}s infinite` }} />)}</div></div>}
      <div ref={endRef} />
    </div>
    {msgs.length <= 1 && <div style={{ padding: "0 28px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>{sugg.map((q, i) => <button key={i} onClick={() => { setInp(q); setTimeout(() => inpRef.current?.focus(), 50); }} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 20, padding: "8px 16px", color: P.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans'" }} onMouseEnter={e => { e.target.style.borderColor = P.accent; e.target.style.color = P.accent; }} onMouseLeave={e => { e.target.style.borderColor = P.border; e.target.style.color = P.textMuted; }}>{q}</button>)}</div>}
    <div style={{ padding: "16px 28px 24px", borderTop: `1px solid ${P.border}` }}>
      <div style={{ display: "flex", gap: 10, background: P.surface, border: `1px solid ${P.borderLight}`, borderRadius: 14, padding: "6px 8px 6px 18px" }}>
        <input ref={inpRef} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about NCD data..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: P.text, fontSize: 14, fontFamily: "'DM Sans'" }} />
        <button onClick={send} disabled={!inp.trim() || loading} style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: inp.trim() && !loading ? "pointer" : "default", background: inp.trim() && !loading ? P.accent : P.surfaceAlt, color: inp.trim() && !loading ? "#fff" : P.textDim, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Send /></button>
      </div>
    </div>
  </div>;
}

// ─── Data Ingestion ───
function Ingest({ dd, onUpdate, history, onHistory }) {
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const handle = (file) => { if (!file) return; const r = new FileReader(); r.onload = e => { const res = parseCSV(e.target.result); setResult(res); }; r.readAsText(file); };

const confirm = async () => {
  if (!result?.rawRows || result.rawRows.length === 0) {
    alert("No data to upload");
    return;
  }
  setImporting(true);
  try {
    // 🔥 send RAW CSV rows only
    const res = await fetch("/api/aggregate/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: result.rawRows,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Upload failed");
    }
    // ✅ keep your UI working
    onUpdate(result.data);
    alert(`Uploaded ${json.inserted} rows`);
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    alert(err.message);
  }
  setImporting(false);
  setResult(null);
};

  const dlTemplate = () => { const b = new Blob([generateSampleCSV()], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "ncd_template.csv"; a.click(); };

  return <div style={{ height: "100%", overflow: "auto", padding: 28 }}><div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
    <div><div style={{ fontSize: 20, fontWeight: 800, color: P.text }}>Data Ingestion Portal</div><div style={{ fontSize: 13, color: P.textDim, marginTop: 4 }}>Upload district-level NCD data via CSV. Data flows into reports and AI chat.</div></div>

    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.textDim, textTransform: "uppercase", marginBottom: 14 }}>Current Dataset</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.accent }}>{dd.length}</div><div style={{ fontSize: 11, color: P.textDim }}>Districts</div></div>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.text }}>{dd.reduce((s, d) => s + d.totalCases, 0).toLocaleString()}</div><div style={{ fontSize: 11, color: P.textDim }}>Total Cases</div></div>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.text }}>{DISEASES.length}</div><div style={{ fontSize: 11, color: P.textDim }}>Diseases</div></div>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.text }}>12</div><div style={{ fontSize: 11, color: P.textDim }}>Months</div></div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={dlTemplate} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, color: P.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}><I.Download /> Download CSV Template</button>
    </div>

    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.textDim, textTransform: "uppercase", marginBottom: 10 }}>CSV Schema (one row = district + month + disease)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {[{ c: "district_name", d: "e.g. Raipur", r: true }, { c: "month", d: "Apr, May...Mar", r: true },{ c: "year", d: "2026", r: true }, { c: "disease_type", d: "Diabetes, Hypertension...", r: true }, { c: "cases", d: "Count", r: true }, { c: "screening_target", d: "Target count" }, { c: "screening_achieved", d: "Achieved count" }, { c: "budget_allocated_lakhs", d: "₹ in lakhs" }, { c: "budget_utilized_lakhs", d: "₹ spent" }, { c: "hr_sanctioned", d: "Positions" }, { c: "hr_in_position", d: "Filled" }, { c: "drug_availability_pct", d: "0-100" }].map(x => <div key={x.c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 5, background: P.surfaceAlt, fontSize: 11 }}><code style={{ color: P.accent, fontWeight: 600, minWidth: 170 }}>{x.c}</code><span style={{ color: P.textMuted }}>{x.d}</span>{x.r && <span style={{ color: P.red, fontSize: 9, fontWeight: 800 }}>REQ</span>}</div>)}
      </div>
    </div>

    <div onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) handle(f); }} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${dragOver ? P.accent : P.borderLight}`, borderRadius: 14, padding: 48, textAlign: "center", cursor: "pointer", background: dragOver ? P.accentGlow : P.surface, transition: "all 0.2s" }}>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handle(e.target.files[0])} />
      <div style={{ color: dragOver ? P.accent : P.textDim, marginBottom: 12 }}><I.File /></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: P.text }}>Drop CSV here or click to browse</div>
      <div style={{ fontSize: 12, color: P.textDim, marginTop: 6 }}>District-level NCD data (.csv)</div>
    </div>

    {result && <div style={{ background: P.surface, border: `1px solid ${result.error ? P.red : P.green}40`, borderRadius: 12, padding: 22 }}>
      {result.error ? <div style={{ display: "flex", alignItems: "center", gap: 10, color: P.red }}><I.Warn /><div><div style={{ fontWeight: 700 }}>Error</div><div style={{ fontSize: 12, marginTop: 4 }}>{result.error}</div></div></div> : <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: P.green, marginBottom: 16 }}><I.Check /><span style={{ fontWeight: 700, fontSize: 14 }}>Parsed successfully</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
          <div style={{ background: P.surfaceAlt, borderRadius: 8, padding: 14, textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: P.accent }}>{result.rowCount.toLocaleString()}</div><div style={{ fontSize: 11, color: P.textDim }}>Rows</div></div>
          <div style={{ background: P.surfaceAlt, borderRadius: 8, padding: 14, textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: P.text }}>{result.districtCount}</div><div style={{ fontSize: 11, color: P.textDim }}>Districts</div></div>
          <div style={{ background: P.surfaceAlt, borderRadius: 8, padding: 14, textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: result.warnings?.length ? P.amber : P.green }}>{result.warnings?.length || 0}</div><div style={{ fontSize: 11, color: P.textDim }}>Warnings</div></div>
        </div>
        {result.warnings?.length > 0 && <div style={{ background: P.amberDim, borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 11, color: P.textMuted }}>{result.warnings.slice(0, 5).map((w, i) => <div key={i}>{w}</div>)}</div>}
        <div style={{ fontSize: 12, fontWeight: 600, color: P.textDim, marginBottom: 8 }}>Preview:</div>
        <div style={{ overflowX: "auto", maxHeight: 220, borderRadius: 8, border: `1px solid ${P.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: P.surfaceAlt }}>{["District", "Zone", "Cases", "Screening", "Drugs", "Budget"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: P.textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${P.border}` }}>{h}</th>)}</tr></thead>
            <tbody>{result.data.map(d => <tr key={d.id}><td style={{ padding: "7px 12px", fontWeight: 600, color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.name}</td><td style={{ padding: "7px 12px", color: P.textMuted, borderBottom: `1px solid ${P.border}` }}>{d.zone}</td><td style={{ padding: "7px 12px", color: P.text, fontWeight: 600, borderBottom: `1px solid ${P.border}` }}>{d.totalCases.toLocaleString()}</td><td style={{ padding: "7px 12px", color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.screeningRate}%</td><td style={{ padding: "7px 12px", color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.drugAvailability}%</td><td style={{ padding: "7px 12px", color: P.text, borderBottom: `1px solid ${P.border}` }}>{(d.budgetUtilized * 100).toFixed(1)}%</td></tr>)}</tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 18, alignItems: "center" }}>
          <button onClick={confirm} disabled={importing} style={{ padding: "10px 28px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'", background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`, color: "#fff", opacity: importing ? 0.6 : 1 }}>{importing ? "Importing..." : `Import ${result.rowCount.toLocaleString()} rows`}</button>
          <button onClick={() => setResult(null)} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${P.border}`, background: "none", color: P.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans'" }}>Cancel</button>
        </div>
      </div>}
    </div>}

    {history.length > 0 && <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.textDim, textTransform: "uppercase", marginBottom: 12 }}>Upload History</div>
      {history.map((h, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < history.length - 1 ? `1px solid ${P.border}` : "none" }}>
        <span style={{ fontSize: 11, color: P.textDim }}>{new Date(h.date).toLocaleString("en-IN")}</span>
      </div>)}
    </div>}
  </div></div>;
}

// ─── Main App ───
export default function App() {
  const [section, setSection] = useState("reports");
  const [dd, setDd] = useState(generateSeedData());
  const [hist, setHist] = useState([]);

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("ncd-data"); if (r?.value) setDd(JSON.parse(r.value)); } catch (e) {}
      try { const r = await window.storage.get("ncd-history"); if (r?.value) setHist(JSON.parse(r.value)); } catch (e) {}
    })();
  }, []);

  const st = computeTotals(dd);
  const addHist = async (entry) => { const nh = [entry, ...hist].slice(0, 20); setHist(nh); try { await window.storage.set("ncd-history", JSON.stringify(nh)); } catch (e) {} };
  const time = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: P.bg, color: P.text, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${P.borderLight};border-radius:3px}@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>

    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", borderBottom: `1px solid ${P.border}`, background: P.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${P.accent}, ${P.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#fff" }}>N</div>
        <div><div style={{ fontSize: 16, fontWeight: 800 }}>NCD Analytics</div><div style={{ fontSize: 10, color: P.textDim, textTransform: "uppercase", letterSpacing: "0.04em" }}>State Health Dept — AI Surveillance</div></div>
      </div>
      <span style={{ fontSize: 12, color: P.textDim }}>{time}</span>
    </header>

    <div style={{ display: "flex", borderBottom: `1px solid ${P.border}` }}>
      {[{ id: "reports", icon: I.Report, l: "Reports" }, { id: "chat", icon: I.Chat, l: "AI Assistant", badge: "AI" }, { id: "ingest", icon: I.Upload, l: "Data Upload" }].map(s => <button key={s.id} onClick={() => setSection(s.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 20px", background: section === s.id ? P.surface : "transparent", border: "none", borderBottom: section === s.id ? `2px solid ${P.accent}` : "2px solid transparent", color: section === s.id ? P.accent : P.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'" }}><s.icon /> {s.l}{s.badge && <span style={{ fontSize: 9, background: P.accentGlow, color: P.accent, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{s.badge}</span>}</button>)}
    </div>

    <div style={{ flex: 1, overflow: "hidden" }}>
      {section === "reports" && <Reports dd={dd} st={st} />}
      {section === "chat" && <Chat dd={dd} st={st} />}
      {section === "ingest" && <Ingest dd={dd} onUpdate={setDd} history={hist} onHistory={addHist} />}
    </div>
  </div>;
}
