import { useState, useEffect, useRef, useCallback } from "react";

// ─── Synthetic NCD Data ───
const DISTRICTS = [
  { id: 1, name: "Raipur", zone: "Central", population: 4063872, lat: 21.25, lng: 81.63 },
  { id: 2, name: "Bilaspur", zone: "North", population: 2663629, lat: 22.09, lng: 82.15 },
  { id: 3, name: "Durg", zone: "Central", population: 3343079, lat: 21.19, lng: 81.28 },
  { id: 4, name: "Korba", zone: "North", population: 1206640, lat: 22.35, lng: 82.68 },
  { id: 5, name: "Rajnandgaon", zone: "West", population: 1537133, lat: 21.10, lng: 81.03 },
  { id: 6, name: "Bastar", zone: "South", population: 1411644, lat: 19.10, lng: 81.95 },
  { id: 7, name: "Surguja", zone: "North", population: 2361329, lat: 23.12, lng: 83.09 },
  { id: 8, name: "Janjgir-Champa", zone: "East", population: 1619707, lat: 22.01, lng: 82.58 },
  { id: 9, name: "Mahasamund", zone: "East", population: 1032754, lat: 21.11, lng: 82.10 },
  { id: 10, name: "Kawardha", zone: "West", population: 822526, lat: 22.02, lng: 81.23 },
  { id: 11, name: "Dhamtari", zone: "South", population: 799781, lat: 20.71, lng: 81.55 },
  { id: 12, name: "Kanker", zone: "South", population: 748593, lat: 20.27, lng: 81.49 },
];

const DISEASES = ["Diabetes", "Hypertension", "Cardiovascular", "COPD", "Cancer", "Stroke"];
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const QUARTERS = ["Q1 2024-25", "Q2 2024-25", "Q3 2024-25", "Q4 2024-25"];

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateData() {
  const rng = seededRandom(42);
  const districtData = DISTRICTS.map(d => {
    const basePrev = 800 + rng() * 2200;
    const screeningRate = 0.35 + rng() * 0.55;
    const budgetUtil = 0.45 + rng() * 0.50;
    const hrFill = 0.50 + rng() * 0.45;
    const drugAvail = 0.55 + rng() * 0.40;
    return {
      ...d,
      totalCases: Math.round(basePrev * (d.population / 1000000)),
      prevalenceRate: (basePrev / 10000).toFixed(1),
      screeningRate: (screeningRate * 100).toFixed(1),
      screeningTarget: Math.round(d.population * 0.3),
      screeningAchieved: Math.round(d.population * 0.3 * screeningRate),
      budgetAllocated: Math.round(d.population * 12 + rng() * 5000000),
      budgetUtilized: budgetUtil,
      hrSanctioned: Math.round(d.population / 15000),
      hrFilled: hrFill,
      drugAvailability: (drugAvail * 100).toFixed(1),
      diseaseBreakdown: DISEASES.map(disease => ({
        disease,
        cases: Math.round((basePrev * (d.population / 1000000)) * (0.05 + rng() * 0.35)),
        trend: -5 + rng() * 15,
      })),
      monthlyTrend: MONTHS.map((m, i) => ({
        month: m,
        cases: Math.round(basePrev * (d.population / 1000000) / 12 * (0.7 + rng() * 0.6)),
        screenings: Math.round(d.population * 0.025 * (0.6 + rng() * 0.8)),
      })),
      quarterlyBudget: QUARTERS.map(q => ({
        quarter: q,
        allocated: Math.round(d.population * 3 + rng() * 1200000),
        utilized: Math.round(d.population * 3 * budgetUtil * (0.8 + rng() * 0.4)),
      })),
    };
  });

  const stateTotals = {
    totalPopulation: DISTRICTS.reduce((s, d) => s + d.population, 0),
    totalCases: districtData.reduce((s, d) => s + d.totalCases, 0),
    avgScreening: (districtData.reduce((s, d) => s + parseFloat(d.screeningRate), 0) / districtData.length).toFixed(1),
    avgBudgetUtil: (districtData.reduce((s, d) => s + d.budgetUtilized, 0) / districtData.length * 100).toFixed(1),
    totalBudget: districtData.reduce((s, d) => s + d.budgetAllocated, 0),
    avgDrugAvail: (districtData.reduce((s, d) => s + parseFloat(d.drugAvailability), 0) / districtData.length).toFixed(1),
    avgHrFill: (districtData.reduce((s, d) => s + d.hrFilled, 0) / districtData.length * 100).toFixed(1),
  };

  return { districtData, stateTotals };
}

const { districtData, stateTotals } = generateData();

// ─── Styles ───
const palette = {
  bg: "#0B0F1A",
  surface: "#111827",
  surfaceAlt: "#1A2035",
  border: "#1E293B",
  borderLight: "#334155",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  textDim: "#64748B",
  accent: "#06B6D4",
  accentDark: "#0E7490",
  accentGlow: "rgba(6, 182, 212, 0.15)",
  green: "#10B981",
  greenDim: "rgba(16, 185, 129, 0.15)",
  red: "#EF4444",
  redDim: "rgba(239, 68, 68, 0.15)",
  amber: "#F59E0B",
  amberDim: "rgba(245, 158, 11, 0.15)",
  purple: "#8B5CF6",
  purpleDim: "rgba(139, 92, 246, 0.15)",
  blue: "#3B82F6",
  blueDim: "rgba(59, 130, 246, 0.15)",
};

const diseaseColors = {
  Diabetes: "#06B6D4",
  Hypertension: "#EF4444",
  Cardiovascular: "#F59E0B",
  COPD: "#8B5CF6",
  Cancer: "#EC4899",
  Stroke: "#10B981",
};

// ─── Icon Components ───
const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  Chat: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  TrendUp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Activity: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Target: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Wallet: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  Pill: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 1.5l-8 8a4.95 4.95 0 007 7l8-8a4.95 4.95 0 00-7-7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>,
  Sparkle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z"/></svg>,
  Report: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Bot: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>,
};

// ─── Utility Components ───
function MiniBar({ value, max = 100, color = palette.accent, height = 6 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ width: "100%", height, background: palette.border, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: height / 2, transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }} />
    </div>
  );
}

function Sparkline({ data, color = palette.accent, width = 120, height = 32 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

function KPICard({ icon: Icon, label, value, subvalue, color, trend }) {
  return (
    <div style={{
      background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12,
      padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          <Icon />
        </div>
        {trend !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: trend >= 0 ? palette.green : palette.red }}>
            {trend >= 0 ? <Icons.TrendUp /> : <Icons.TrendDown />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: palette.text, letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
        <div style={{ fontSize: 12, color: palette.textDim, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{label}</div>
        {subvalue && <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>{subvalue}</div>}
      </div>
    </div>
  );
}

// ─── Bar Chart ───
function BarChart({ data, labelKey, valueKey, color = palette.accent, height = 200 }) {
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, padding: "0 4px" }}>
      {data.map((d, i) => {
        const h = (d[valueKey] / max) * (height - 24);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 9, color: palette.textDim, fontWeight: 600 }}>{(d[valueKey] / 1000).toFixed(0)}k</div>
            <div style={{ width: "100%", maxWidth: 32, height: h, background: `linear-gradient(180deg, ${color}, ${color}88)`, borderRadius: "4px 4px 2px 2px", transition: "height 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }} />
            <div style={{ fontSize: 9, color: palette.textDim, fontWeight: 500 }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Disease Donut ───
function DiseaseDonut({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.cases, 0);
  let cumulative = 0;
  const segments = data.map(d => {
    const start = cumulative;
    cumulative += d.cases / total;
    return { ...d, start, end: cumulative };
  });
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={size} height={size}>
        {segments.map((seg, i) => {
          const startAngle = seg.start * 2 * Math.PI - Math.PI / 2;
          const endAngle = seg.end * 2 * Math.PI - Math.PI / 2;
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
          return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`} fill={diseaseColors[seg.disease]} opacity="0.85" stroke={palette.surface} strokeWidth="2" />;
        })}
        <circle cx={cx} cy={cy} r={r * 0.55} fill={palette.surface} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={palette.text} fontSize="18" fontWeight="700" fontFamily="'DM Sans', sans-serif">{(total / 1000).toFixed(0)}k</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={palette.textDim} fontSize="9" fontWeight="500">TOTAL</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map(d => (
          <div key={d.disease} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: diseaseColors[d.disease] }} />
            <span style={{ color: palette.textMuted, minWidth: 90 }}>{d.disease}</span>
            <span style={{ color: palette.text, fontWeight: 600 }}>{d.cases.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── District Table ───
function DistrictTable({ data, onSelect, selectedId }) {
  const [sortCol, setSortCol] = useState("totalCases");
  const [sortDir, setSortDir] = useState(-1);
  const sorted = [...data].sort((a, b) => {
    const av = typeof a[sortCol] === "string" ? parseFloat(a[sortCol]) : a[sortCol];
    const bv = typeof b[sortCol] === "string" ? parseFloat(b[sortCol]) : b[sortCol];
    return (av - bv) * sortDir;
  });
  const cols = [
    { key: "name", label: "District", width: "22%" },
    { key: "totalCases", label: "Cases", width: "14%" },
    { key: "prevalenceRate", label: "Prev/10k", width: "14%" },
    { key: "screeningRate", label: "Screening %", width: "16%" },
    { key: "drugAvailability", label: "Drug Avail.", width: "16%" },
    { key: "budgetUtilized", label: "Budget Util.", width: "18%" },
  ];
  const toggleSort = (key) => { if (sortCol === key) setSortDir(-sortDir); else { setSortCol(key); setSortDir(-1); } };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{
                width: c.width, textAlign: c.key === "name" ? "left" : "right", padding: "10px 14px",
                color: palette.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
                borderBottom: `1px solid ${palette.border}`, cursor: "pointer", userSelect: "none",
              }}>
                {c.label} {sortCol === c.key && (sortDir === 1 ? "↑" : "↓")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => (
            <tr key={d.id} onClick={() => onSelect(d.id)} style={{
              cursor: "pointer", background: selectedId === d.id ? palette.accentGlow : "transparent",
              transition: "background 0.15s",
            }} onMouseEnter={e => { if (selectedId !== d.id) e.currentTarget.style.background = `${palette.surfaceAlt}`; }} onMouseLeave={e => { if (selectedId !== d.id) e.currentTarget.style.background = "transparent"; }}>
              <td style={{ padding: "11px 14px", color: palette.text, fontWeight: 600, borderBottom: `1px solid ${palette.border}` }}>{d.name}</td>
              <td style={{ padding: "11px 14px", textAlign: "right", color: palette.text, borderBottom: `1px solid ${palette.border}`, fontWeight: 600, fontFeatureSettings: "'tnum'" }}>{d.totalCases.toLocaleString()}</td>
              <td style={{ padding: "11px 14px", textAlign: "right", color: palette.text, borderBottom: `1px solid ${palette.border}`, fontFeatureSettings: "'tnum'" }}>{d.prevalenceRate}</td>
              <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${palette.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                  <MiniBar value={parseFloat(d.screeningRate)} color={parseFloat(d.screeningRate) > 65 ? palette.green : parseFloat(d.screeningRate) > 45 ? palette.amber : palette.red} />
                  <span style={{ color: palette.text, fontFeatureSettings: "'tnum'", minWidth: 36 }}>{d.screeningRate}%</span>
                </div>
              </td>
              <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${palette.border}` }}>
                <span style={{ color: parseFloat(d.drugAvailability) > 75 ? palette.green : parseFloat(d.drugAvailability) > 55 ? palette.amber : palette.red, fontWeight: 600, fontFeatureSettings: "'tnum'" }}>{d.drugAvailability}%</span>
              </td>
              <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${palette.border}` }}>
                <span style={{ color: d.budgetUtilized > 0.75 ? palette.green : d.budgetUtilized > 0.55 ? palette.amber : palette.red, fontWeight: 600, fontFeatureSettings: "'tnum'" }}>{(d.budgetUtilized * 100).toFixed(1)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Disease Heatmap ───
function HeatmapReport() {
  const [metric, setMetric] = useState("cases"); // cases | prevalence | trend
  const [hoveredCell, setHoveredCell] = useState(null);
  const [sortBy, setSortBy] = useState("name");

  // Build heatmap data matrix
  const matrix = districtData.map(d => ({
    district: d.name,
    zone: d.zone,
    population: d.population,
    values: DISEASES.map(disease => {
      const entry = d.diseaseBreakdown.find(x => x.disease === disease);
      return {
        disease,
        cases: entry.cases,
        prevalence: ((entry.cases / d.population) * 100000).toFixed(1),
        trend: entry.trend,
      };
    }),
    totalCases: d.diseaseBreakdown.reduce((s, x) => s + x.cases, 0),
  }));

  // Get min/max for color scaling
  const allValues = matrix.flatMap(r => r.values.map(v =>
    metric === "cases" ? v.cases : metric === "prevalence" ? parseFloat(v.prevalence) : v.trend
  ));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);

  // Sort districts
  const sorted = [...matrix].sort((a, b) => {
    if (sortBy === "name") return a.district.localeCompare(b.district);
    if (sortBy === "zone") return a.zone.localeCompare(b.zone) || a.district.localeCompare(b.district);
    if (sortBy === "total") return b.totalCases - a.totalCases;
    // Sort by a specific disease
    const di = DISEASES.indexOf(sortBy);
    if (di >= 0) {
      const av = metric === "cases" ? a.values[di].cases : metric === "prevalence" ? parseFloat(a.values[di].prevalence) : a.values[di].trend;
      const bv = metric === "cases" ? b.values[di].cases : metric === "prevalence" ? parseFloat(b.values[di].prevalence) : b.values[di].trend;
      return bv - av;
    }
    return 0;
  });

  // Color interpolation
  function getColor(value) {
    if (metric === "trend") {
      // Diverging: green (negative/improving) → neutral → red (positive/worsening)
      const mid = 0;
      if (value <= mid) {
        const t = Math.max(0, Math.min(1, (mid - value) / Math.max(Math.abs(minVal), 1)));
        return `rgba(16, 185, 129, ${0.15 + t * 0.75})`;
      } else {
        const t = Math.max(0, Math.min(1, (value - mid) / Math.max(Math.abs(maxVal), 1)));
        return `rgba(239, 68, 68, ${0.15 + t * 0.75})`;
      }
    }
    // Sequential: low (cool) → high (hot)
    const range = maxVal - minVal || 1;
    const t = (value - minVal) / range;
    if (t < 0.25) return `rgba(6, 182, 212, ${0.12 + t * 1.2})`;
    if (t < 0.5) return `rgba(245, 158, 11, ${0.15 + (t - 0.25) * 2.4})`;
    if (t < 0.75) return `rgba(239, 68, 68, ${0.25 + (t - 0.5) * 2.0})`;
    return `rgba(239, 68, 68, ${0.65 + (t - 0.75) * 1.4})`;
  }

  function getTextColor(value) {
    if (metric === "trend") {
      return Math.abs(value) > (Math.max(Math.abs(minVal), Math.abs(maxVal)) * 0.5) ? "#fff" : palette.text;
    }
    const range = maxVal - minVal || 1;
    const t = (value - minVal) / range;
    return t > 0.55 ? "#fff" : palette.text;
  }

  function formatValue(v) {
    if (metric === "cases") return v.cases.toLocaleString();
    if (metric === "prevalence") return v.prevalence;
    return (v.trend >= 0 ? "+" : "") + v.trend.toFixed(1) + "%";
  }

  const cellW = `${Math.floor(100 / (DISEASES.length + 1))}%`;

  const metricOptions = [
    { id: "cases", label: "Absolute Cases" },
    { id: "prevalence", label: "Prevalence / 100k" },
    { id: "trend", label: "YoY Trend %" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>Disease Heatmap</div>
          <div style={{ fontSize: 12, color: palette.textDim, marginTop: 4 }}>
            District × Disease intensity matrix — {metric === "cases" ? "absolute case counts" : metric === "prevalence" ? "cases per 100,000 population" : "year-over-year change"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {metricOptions.map(m => (
            <button key={m.id} onClick={() => setMetric(m.id)} style={{
              padding: "7px 14px", borderRadius: 8, border: `1px solid ${metric === m.id ? palette.accent : palette.border}`,
              background: metric === m.id ? palette.accentGlow : palette.surface,
              color: metric === m.id ? palette.accent : palette.textMuted,
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
              fontFamily: "'DM Sans', sans-serif",
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: palette.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Intensity</span>
        {metric === "trend" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(16, 185, 129, 0.8)" }} />
              <span style={{ fontSize: 10, color: palette.textMuted }}>Improving</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(16, 185, 129, 0.2)" }} />
              <span style={{ fontSize: 10, color: palette.textMuted }}>Slight ↓</span>
            </div>
            <div style={{ width: 18, height: 12, borderRadius: 3, background: palette.surfaceAlt, border: `1px solid ${palette.border}` }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(239, 68, 68, 0.3)" }} />
              <span style={{ fontSize: 10, color: palette.textMuted }}>Slight ↑</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 18, height: 12, borderRadius: 3, background: "rgba(239, 68, 68, 0.85)" }} />
              <span style={{ fontSize: 10, color: palette.textMuted }}>Worsening</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[0, 0.25, 0.5, 0.75, 1.0].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 24, height: 12, borderRadius: 3, background: getColor(minVal + t * (maxVal - minVal)) }} />
                {(i === 0 || i === 4) && <span style={{ fontSize: 10, color: palette.textMuted }}>{i === 0 ? "Low" : "High"}</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: palette.textDim }}>Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 6,
            padding: "4px 8px", color: palette.text, fontSize: 11, fontFamily: "'DM Sans', sans-serif",
            outline: "none", cursor: "pointer",
          }}>
            <option value="name">Name</option>
            <option value="zone">Zone</option>
            <option value="total">Total Cases</option>
            {DISEASES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Column Headers */}
        <div style={{ display: "flex", borderBottom: `1px solid ${palette.border}` }}>
          <div style={{ width: 160, minWidth: 160, padding: "14px 18px", fontSize: 11, fontWeight: 700, color: palette.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>District</div>
          {DISEASES.map(disease => (
            <div key={disease} onClick={() => setSortBy(disease)} style={{
              flex: 1, padding: "14px 8px", textAlign: "center", fontSize: 11, fontWeight: 700,
              color: sortBy === disease ? palette.accent : palette.textDim,
              textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer",
              borderBottom: sortBy === disease ? `2px solid ${palette.accent}` : "2px solid transparent",
              transition: "all 0.15s", userSelect: "none",
            }}>{disease}</div>
          ))}
          <div style={{ width: 90, minWidth: 90, padding: "14px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: palette.textDim, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total</div>
        </div>

        {/* Rows */}
        {sorted.map((row, ri) => (
          <div key={row.district} style={{
            display: "flex", borderBottom: ri < sorted.length - 1 ? `1px solid ${palette.border}` : "none",
            transition: "background 0.1s",
          }} onMouseEnter={e => e.currentTarget.style.background = palette.surfaceAlt}
             onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {/* District label */}
            <div style={{
              width: 160, minWidth: 160, padding: "12px 18px", display: "flex", flexDirection: "column",
              justifyContent: "center", borderRight: `1px solid ${palette.border}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>{row.district}</div>
              <div style={{ fontSize: 10, color: palette.textDim, marginTop: 1 }}>{row.zone} · {(row.population / 100000).toFixed(1)}L</div>
            </div>

            {/* Disease cells */}
            {row.values.map((v, ci) => {
              const val = metric === "cases" ? v.cases : metric === "prevalence" ? parseFloat(v.prevalence) : v.trend;
              const isHovered = hoveredCell?.r === ri && hoveredCell?.c === ci;
              return (
                <div key={v.disease} onMouseEnter={() => setHoveredCell({ r: ri, c: ci })} onMouseLeave={() => setHoveredCell(null)} style={{
                  flex: 1, padding: "10px 6px", display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  <div style={{
                    width: "100%", height: 44, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                    background: getColor(val), color: getTextColor(val),
                    fontSize: 12, fontWeight: 700, fontFeatureSettings: "'tnum'",
                    transition: "all 0.2s", transform: isHovered ? "scale(1.08)" : "scale(1)",
                    boxShadow: isHovered ? `0 4px 16px ${getColor(val)}` : "none",
                    cursor: "default",
                  }}>
                    {formatValue(v)}
                  </div>
                  {/* Tooltip */}
                  {isHovered && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
                      background: palette.bg, border: `1px solid ${palette.borderLight}`, borderRadius: 8,
                      padding: "10px 14px", zIndex: 50, minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      pointerEvents: "none",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: palette.text, marginBottom: 6 }}>{row.district} — {v.disease}</div>
                      <div style={{ fontSize: 11, color: palette.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>
                        <span>Cases: <b style={{ color: palette.text }}>{v.cases.toLocaleString()}</b></span>
                        <span>Prevalence: <b style={{ color: palette.text }}>{v.prevalence}/100k</b></span>
                        <span>Trend: <b style={{ color: v.trend > 0 ? palette.red : palette.green }}>{v.trend >= 0 ? "+" : ""}{v.trend.toFixed(1)}%</b></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total */}
            <div style={{
              width: 90, minWidth: 90, display: "flex", alignItems: "center", justifyContent: "center",
              borderLeft: `1px solid ${palette.border}`, padding: "10px 8px",
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: palette.text, fontFeatureSettings: "'tnum'" }}>
                {row.totalCases.toLocaleString()}
              </span>
            </div>
          </div>
        ))}

        {/* Column Totals */}
        <div style={{ display: "flex", borderTop: `2px solid ${palette.borderLight}`, background: palette.surfaceAlt }}>
          <div style={{ width: 160, minWidth: 160, padding: "14px 18px", fontSize: 12, fontWeight: 800, color: palette.accent }}>STATE TOTAL</div>
          {DISEASES.map(disease => {
            const total = districtData.reduce((s, d) => s + d.diseaseBreakdown.find(x => x.disease === disease).cases, 0);
            return (
              <div key={disease} style={{ flex: 1, padding: "14px 8px", textAlign: "center", fontSize: 13, fontWeight: 800, color: palette.text, fontFeatureSettings: "'tnum'" }}>
                {total.toLocaleString()}
              </div>
            );
          })}
          <div style={{ width: 90, minWidth: 90, padding: "14px 8px", textAlign: "center", fontSize: 13, fontWeight: 800, color: palette.accent, fontFeatureSettings: "'tnum'" }}>
            {matrix.reduce((s, r) => s + r.totalCases, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {(() => {
          const hotspots = [];
          matrix.forEach(r => r.values.forEach(v => {
            hotspots.push({ district: r.district, disease: v.disease, cases: v.cases, prevalence: parseFloat(v.prevalence), trend: v.trend });
          }));
          const topPrev = [...hotspots].sort((a, b) => b.prevalence - a.prevalence).slice(0, 5);
          const worsening = [...hotspots].sort((a, b) => b.trend - a.trend).slice(0, 5);
          const improving = [...hotspots].sort((a, b) => a.trend - b.trend).slice(0, 5);
          return (
            <>
              <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: palette.red, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: palette.red }} /> Highest Prevalence
                </div>
                {topPrev.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 4 ? `1px solid ${palette.border}` : "none", fontSize: 12 }}>
                    <span style={{ color: palette.textMuted }}>{h.district} · {h.disease}</span>
                    <span style={{ color: palette.text, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>{h.prevalence}/100k</span>
                  </div>
                ))}
              </div>
              <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: palette.amber, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.TrendUp /> Fastest Worsening
                </div>
                {worsening.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 4 ? `1px solid ${palette.border}` : "none", fontSize: 12 }}>
                    <span style={{ color: palette.textMuted }}>{h.district} · {h.disease}</span>
                    <span style={{ color: palette.red, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>+{h.trend.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: palette.green, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.TrendDown /> Most Improved
                </div>
                {improving.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 4 ? `1px solid ${palette.border}` : "none", fontSize: 12 }}>
                    <span style={{ color: palette.textMuted }}>{h.district} · {h.disease}</span>
                    <span style={{ color: palette.green, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>{h.trend.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Reports Section ───
function ReportsSection() {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [activeReport, setActiveReport] = useState("dashboard");
  const selected = districtData.find(d => d.id === selectedDistrict);

  const reports = [
    { id: "dashboard", label: "State Dashboard" },
    { id: "heatmap", label: "Disease Heatmap" },
    { id: "screening", label: "Screening Coverage" },
    { id: "disease", label: "Disease Trends" },
    { id: "budget", label: "Budget & Resources" },
  ];

  const totalDisease = DISEASES.map(disease => ({
    disease,
    cases: districtData.reduce((s, d) => s + d.diseaseBreakdown.find(x => x.disease === disease).cases, 0),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      {/* Report Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "0 28px", borderBottom: `1px solid ${palette.border}`,
        background: palette.surface,
      }}>
        {reports.map(r => (
          <button key={r.id} onClick={() => setActiveReport(r.id)} style={{
            padding: "12px 18px", background: "none", border: "none", color: activeReport === r.id ? palette.accent : palette.textDim,
            fontSize: 13, fontWeight: 600, cursor: "pointer", position: "relative",
            borderBottom: activeReport === r.id ? `2px solid ${palette.accent}` : "2px solid transparent",
            marginBottom: -1, transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
          }}>{r.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
        {activeReport === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <KPICard icon={Icons.Activity} label="Total NCD Cases" value={stateTotals.totalCases.toLocaleString()} subvalue={`Pop: ${(stateTotals.totalPopulation / 1000000).toFixed(1)}M`} color={palette.accent} trend={3.2} />
              <KPICard icon={Icons.Target} label="Screening Coverage" value={`${stateTotals.avgScreening}%`} subvalue="State average" color={palette.green} trend={5.8} />
              <KPICard icon={Icons.Wallet} label="Budget Utilization" value={`${stateTotals.avgBudgetUtil}%`} subvalue={`₹${(stateTotals.totalBudget / 10000000).toFixed(0)} Cr allocated`} color={palette.purple} trend={-2.1} />
              <KPICard icon={Icons.Pill} label="Drug Availability" value={`${stateTotals.avgDrugAvail}%`} subvalue="Across all facilities" color={palette.amber} trend={1.4} />
              <KPICard icon={Icons.Users} label="HR Positions Filled" value={`${stateTotals.avgHrFill}%`} subvalue="Sanctioned vs filled" color={palette.blue} />
            </div>

            {/* Charts Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: palette.text, marginBottom: 4 }}>Disease Distribution</div>
                <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 18 }}>State-wide NCD burden by type</div>
                <DiseaseDonut data={totalDisease} />
              </div>
              <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: palette.text, marginBottom: 4 }}>Monthly Case Registrations</div>
                <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 18 }}>FY 2024-25 (all districts)</div>
                <BarChart data={MONTHS.map((m, i) => ({ month: m, cases: districtData.reduce((s, d) => s + d.monthlyTrend[i].cases, 0) }))} labelKey="month" valueKey="cases" height={180} />
              </div>
            </div>

            {/* District Table */}
            <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: palette.text }}>District Performance Matrix</div>
                  <div style={{ fontSize: 11, color: palette.textDim, marginTop: 2 }}>Click a district for detailed view</div>
                </div>
              </div>
              <DistrictTable data={districtData} onSelect={setSelectedDistrict} selectedId={selectedDistrict} />
            </div>

            {/* Selected District Detail */}
            {selected && (
              <div style={{ background: palette.surface, border: `1px solid ${palette.accent}40`, borderRadius: 12, padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>{selected.name} District</div>
                    <div style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>{selected.zone} Zone · Pop: {(selected.population / 100000).toFixed(1)} L</div>
                  </div>
                  <button onClick={() => setSelectedDistrict(null)} style={{ background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 6, padding: "6px 14px", color: palette.textMuted, fontSize: 12, cursor: "pointer" }}>Close</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: palette.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Disease Breakdown</div>
                    {selected.diseaseBreakdown.map(d => (
                      <div key={d.disease} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: diseaseColors[d.disease] }} />
                        <span style={{ fontSize: 12, color: palette.textMuted, flex: 1 }}>{d.disease}</span>
                        <span style={{ fontSize: 12, color: palette.text, fontWeight: 600, fontFeatureSettings: "'tnum'", minWidth: 50, textAlign: "right" }}>{d.cases.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: d.trend > 0 ? palette.red : palette.green, fontWeight: 600, minWidth: 45, textAlign: "right" }}>{d.trend > 0 ? "+" : ""}{d.trend.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: palette.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Monthly Trend</div>
                    <BarChart data={selected.monthlyTrend} labelKey="month" valueKey="cases" color={palette.accent} height={160} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeReport === "heatmap" && (
          <HeatmapReport />
        )}

        {activeReport === "screening" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>Screening Coverage Report</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {districtData.sort((a, b) => parseFloat(a.screeningRate) - parseFloat(b.screeningRate)).map(d => {
                const rate = parseFloat(d.screeningRate);
                const col = rate > 65 ? palette.green : rate > 45 ? palette.amber : palette.red;
                return (
                  <div key={d.id} style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: palette.text }}>{d.name}</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: col, fontFeatureSettings: "'tnum'" }}>{d.screeningRate}%</span>
                    </div>
                    <MiniBar value={rate} color={col} height={8} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: palette.textDim }}>
                      <span>Target: {(d.screeningTarget / 1000).toFixed(0)}k</span>
                      <span>Achieved: {(d.screeningAchieved / 1000).toFixed(0)}k</span>
                      <span>Gap: {((d.screeningTarget - d.screeningAchieved) / 1000).toFixed(0)}k</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeReport === "disease" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>Disease Trend Analysis</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {DISEASES.map(disease => {
                const monthlyAgg = MONTHS.map((m, i) => ({
                  month: m,
                  cases: districtData.reduce((s, d) => s + Math.round(d.diseaseBreakdown.find(x => x.disease === disease).cases / 12 * (0.8 + Math.sin(i * 0.7) * 0.3)), 0),
                }));
                const totalD = districtData.reduce((s, d) => s + d.diseaseBreakdown.find(x => x.disease === disease).cases, 0);
                return (
                  <div key={disease} style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: diseaseColors[disease] }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: palette.text }}>{disease}</span>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 800, color: palette.text, fontFeatureSettings: "'tnum'" }}>{totalD.toLocaleString()}</span>
                    </div>
                    <BarChart data={monthlyAgg} labelKey="month" valueKey="cases" color={diseaseColors[disease]} height={120} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeReport === "budget" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>Budget & Resource Utilization</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {districtData.sort((a, b) => a.budgetUtilized - b.budgetUtilized).map(d => (
                <div key={d.id} style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: palette.text, marginBottom: 14 }}>{d.name}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.textDim, marginBottom: 5 }}>
                        <span>Budget Utilization</span>
                        <span style={{ color: d.budgetUtilized > 0.75 ? palette.green : d.budgetUtilized > 0.55 ? palette.amber : palette.red, fontWeight: 700 }}>{(d.budgetUtilized * 100).toFixed(0)}%</span>
                      </div>
                      <MiniBar value={d.budgetUtilized * 100} color={d.budgetUtilized > 0.75 ? palette.green : d.budgetUtilized > 0.55 ? palette.amber : palette.red} height={7} />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.textDim, marginBottom: 5 }}>
                        <span>HR Fill Rate</span>
                        <span style={{ fontWeight: 700, color: palette.text }}>{(d.hrFilled * 100).toFixed(0)}%</span>
                      </div>
                      <MiniBar value={d.hrFilled * 100} color={palette.blue} height={7} />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: palette.textDim, marginBottom: 5 }}>
                        <span>Drug Availability</span>
                        <span style={{ fontWeight: 700, color: palette.text }}>{d.drugAvailability}%</span>
                      </div>
                      <MiniBar value={parseFloat(d.drugAvailability)} color={palette.amber} height={7} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: palette.textDim, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${palette.border}` }}>
                    Allocated: ₹{(d.budgetAllocated / 10000000).toFixed(2)} Cr · Sanctioned posts: {d.hrSanctioned}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Chat Section ───
function AIChatSection() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Welcome to the NCD Analytics AI Assistant. I have access to the complete NCD surveillance dataset for your state covering 12 districts, 6 disease categories, screening coverage, budget utilization, and facility-level data.\n\nYou can ask me questions like:\n• Which districts need urgent attention on screening coverage?\n• What's the diabetes trend in Bastar district?\n• Compare budget utilization across northern zone districts\n• Recommend interventions for improving NCD outcomes\n\nHow can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const summaryRows = districtData.map(d =>
        `${d.name}: Cases=${d.totalCases}, Screening=${d.screeningRate}%, DrugAvail=${d.drugAvailability}%, BudgetUtil=${(d.budgetUtilized*100).toFixed(0)}%, HRFill=${(d.hrFilled*100).toFixed(0)}%, Prevalence=${d.prevalenceRate}/10k, Zone=${d.zone}, Pop=${(d.population/100000).toFixed(1)}L, Diseases=[${d.diseaseBreakdown.map(x => `${x.disease}:${x.cases}(${x.trend>0?'+':''}${x.trend.toFixed(1)}%)`).join(', ')}]`
      ).join("\n");
      const diseaseAgg = DISEASES.map(disease => {
        const total = districtData.reduce((s, d) => s + d.diseaseBreakdown.find(x => x.disease === disease).cases, 0);
        return `${disease}: ${total.toLocaleString()} cases`;
      }).join(", ");
      const dataCtx = `STATE NCD DATA SUMMARY (FY 2024-25, Chhattisgarh):\nTotal Population: ${(stateTotals.totalPopulation/1000000).toFixed(1)}M | Total Cases: ${stateTotals.totalCases.toLocaleString()} | Avg Screening: ${stateTotals.avgScreening}% | Avg Budget Util: ${stateTotals.avgBudgetUtil}% | Drug Availability: ${stateTotals.avgDrugAvail}% | HR Fill: ${stateTotals.avgHrFill}%\n\nDISEASE TOTALS: ${diseaseAgg}\n\nDISTRICT DATA:\n${summaryRows}`;

      // Build API messages — filter out the welcome message, ensure it starts with user
      const apiMessages = newMessages
        .filter((m, i) => !(i === 0 && m.role === "assistant"))
        .slice(-10);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an AI analytics assistant for state government health officials monitoring Non-Communicable Disease (NCD) data in Chhattisgarh. You have access to the following real-time surveillance dataset:\n\n${dataCtx}\n\nYour role:\n1. Answer questions about NCD patterns, screening coverage, budget utilization, and district performance using specific numbers from the data above\n2. Provide data-driven insights — always cite exact figures\n3. Recommend evidence-based interventions based on WHO and NPCDCS guidelines\n4. Flag districts needing urgent attention (low screening, poor drug availability, budget underutilization)\n5. Compare performance across districts and zones\n\nGuidelines:\n- Always reference specific data points from the dataset\n- Be concise but thorough — use bullet points for clarity\n- When recommending interventions, consider the district's population size, zone, and existing resource levels\n- Use a professional tone suitable for senior government officials (District Collectors, CMHOs, State Health Directors)\n- If asked about data you don't have, say so clearly`,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("API error:", response.status, errText);
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.map(i => i.text || "").filter(Boolean).join("\n") || "I apologize, I encountered an issue processing your request. Please try rephrasing your question.";
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "I'm unable to connect to the AI service at the moment. This could be a temporary issue — please try again in a moment." }]);
    }
    setLoading(false);
  }, [input, loading, messages]);

  const suggestedQueries = [
    "Which districts have critically low screening coverage?",
    "Recommend interventions for Bastar district",
    "Compare zone-wise NCD performance",
    "What's driving the rise in diabetes cases?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: palette.bg }}>
      {/* Chat Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
            {msg.role === "assistant" && (
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${palette.accent}, ${palette.purple})`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icons.Bot />
              </div>
            )}
            <div style={{
              maxWidth: "75%", padding: "14px 18px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? palette.accent : palette.surface,
              border: msg.role === "user" ? "none" : `1px solid ${palette.border}`,
              color: msg.role === "user" ? "#fff" : palette.text,
              fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${palette.accent}, ${palette.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icons.Bot />
            </div>
            <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: "16px 16px 16px 4px", padding: "14px 20px", display: "flex", gap: 6, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: "50%", background: palette.accent,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ padding: "0 28px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {suggestedQueries.map((q, i) => (
            <button key={i} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }} style={{
              background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 20, padding: "8px 16px",
              color: palette.textMuted, fontSize: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
            }} onMouseEnter={e => { e.target.style.borderColor = palette.accent; e.target.style.color = palette.accent; }}
               onMouseLeave={e => { e.target.style.borderColor = palette.border; e.target.style.color = palette.textMuted; }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "16px 28px 24px", borderTop: `1px solid ${palette.border}` }}>
        <div style={{
          display: "flex", gap: 10, alignItems: "center", background: palette.surface,
          border: `1px solid ${palette.borderLight}`, borderRadius: 14, padding: "6px 8px 6px 18px",
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about NCD data, trends, or recommendations..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none", color: palette.text,
              fontSize: 14, fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
            width: 38, height: 38, borderRadius: 10, border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
            background: input.trim() && !loading ? palette.accent : palette.surfaceAlt,
            color: input.trim() && !loading ? "#fff" : palette.textDim,
            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
          }}>
            <Icons.Send />
          </button>
        </div>
        <div style={{ fontSize: 10, color: palette.textDim, marginTop: 8, textAlign: "center" }}>
          AI responses are based on available NCD surveillance data. Verify critical decisions with domain experts.
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───
export default function NCDAnalytics() {
  const [activeSection, setActiveSection] = useState("reports");
  const [time] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  });

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", flexDirection: "column",
      background: palette.bg, color: palette.text,
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${palette.borderLight}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${palette.textDim}; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Header */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px", borderBottom: `1px solid ${palette.border}`,
        background: palette.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `linear-gradient(135deg, ${palette.accent}, ${palette.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 15, color: "#fff",
          }}>N</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: palette.text, letterSpacing: "-0.01em" }}>NCD Analytics</div>
            <div style={{ fontSize: 10, color: palette.textDim, letterSpacing: "0.04em", textTransform: "uppercase" }}>State Health Department — AI-Powered Surveillance</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: palette.textDim }}>{time}</span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: palette.surfaceAlt, border: `1px solid ${palette.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: palette.accent }}>DM</div>
        </div>
      </header>

      {/* Section Toggle */}
      <div style={{ display: "flex", borderBottom: `1px solid ${palette.border}`, background: palette.bg }}>
        {[
          { id: "reports", icon: Icons.Report, label: "Reports & Dashboards" },
          { id: "chat", icon: Icons.Chat, label: "AI Analytics Assistant" },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "14px 20px", background: activeSection === s.id ? palette.surface : "transparent",
            border: "none", borderBottom: activeSection === s.id ? `2px solid ${palette.accent}` : "2px solid transparent",
            color: activeSection === s.id ? palette.accent : palette.textDim,
            fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <s.icon /> {s.label}
            {s.id === "chat" && <span style={{ fontSize: 9, background: palette.accentGlow, color: palette.accent, padding: "2px 8px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.04em" }}>AI</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeSection === "reports" ? <ReportsSection /> : <AIChatSection />}
      </div>
    </div>
  );
}
