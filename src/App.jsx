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
const YEARS = [2024, 2025, 2026];
const SEVERITY = ["Mild", "Moderate", "Severe"];
const GENDERS = ["Male", "Female", "Other"];
const AGE_GROUPS = ["0-14", "15-29", "30-44", "45-59", "60+"];

// ─── NPCDCS / NHM National Benchmarks ───
// Sources: NPCDCS Operational Guidelines 2023-24, NHM Framework for Implementation,
// WHO PEN Protocol, NPHCE targets, India Hypertension Control Initiative (IHCI)
const BENCHMARKS = {
  screening: { target: 65, label: "NPCDCS Target", national_avg: 52.3, source: "NPCDCS Operational Guidelines 2023-24" },
  drug_availability: { target: 80, label: "NHM Essential Drug List", national_avg: 68.5, source: "NHM Drug Procurement Guidelines" },
  budget_utilization: { target: 75, label: "NHM Financial Target", national_avg: 62.1, source: "NHM RoP 2023-24" },
  hr_fill: { target: 80, label: "IPHS Staffing Norm", national_avg: 64.8, source: "IPHS Guidelines 2022" },
  prevalence: {
    Diabetes: { rate_per_lakh: 7700, label: "ICMR INDIAB Study", trend: "rising" },
    Hypertension: { rate_per_lakh: 28900, label: "NFHS-5 / IHCI", trend: "rising" },
    Cardiovascular: { rate_per_lakh: 5400, label: "GBD India 2021", trend: "stable" },
    COPD: { rate_per_lakh: 5500, label: "BOLD India Study", trend: "stable" },
    Cancer: { rate_per_lakh: 940, label: "ICMR NCDIR 2022", trend: "rising" },
    Stroke: { rate_per_lakh: 1190, label: "ICMR Stroke Registry", trend: "stable" },
  },
  // State-level comparisons (latest available NHM data)
  state_comparisons: [
    { state: "Chhattisgarh", screening: 0, drug: 0, budget: 0, hr: 0 }, // will be filled from live data
    { state: "Madhya Pradesh", screening: 48.2, drug: 62.0, budget: 58.5, hr: 58.0 },
    { state: "Rajasthan", screening: 58.7, drug: 71.3, budget: 68.2, hr: 66.5 },
    { state: "Odisha", screening: 55.1, drug: 65.8, budget: 64.0, hr: 61.2 },
    { state: "Jharkhand", screening: 42.5, drug: 55.2, budget: 52.8, hr: 54.0 },
    { state: "National Avg", screening: 52.3, drug: 68.5, budget: 62.1, hr: 64.8 },
  ],
};

// ─── RBAC ───
const ROLES = {
  admin: { label: "Admin", sections: ["reports", "chat", "ingest"], allDistricts: true },
  district_manager: { label: "District Manager — Raipur", sections: ["reports", "chat", "ingest"], allDistricts: false, district: "Raipur", districtId: 1 },
  field_worker: { label: "Field Worker", sections: ["fieldwork"], allDistricts: false },
  analyst: { label: "Analyst", sections: ["reports", "chat"], allDistricts: true },
};

// ─── Time Ranges ───
const TIME_RANGES = [
  { id: "1m", label: "Last Month", months: 1 },
  { id: "3m", label: "Last Quarter", months: 3 },
  { id: "6m", label: "Last 6 Months", months: 6 },
  { id: "12m", label: "Last 12 Months", months: 12 },
  { id: "all", label: "All Time", months: null },
  { id: "custom", label: "Custom", months: null },
];

function getDateRange(rangeId, customFrom, customTo) {
  if (rangeId === "all") return { from: null, to: null };
  if (rangeId === "custom") return { from: customFrom || null, to: customTo || null };
  const range = TIME_RANGES.find(r => r.id === rangeId);
  if (!range?.months) return { from: null, to: null };
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - range.months);
  return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
}

function getRowDate(r) {
  if (r.month_date) return r.month_date.split("T")[0];
  const MN = { Jan:"01", Feb:"02", Mar:"03", Apr:"04", May:"05", Jun:"06", Jul:"07", Aug:"08", Sep:"09", Oct:"10", Nov:"11", Dec:"12" };
  if (MN[r.month] && r.year) return `${r.year}-${MN[r.month]}-01`;
  return null;
}

// Build time-series buckets from filtered raw rows
function buildTimeSeries(rawRows, { district = "all", dateFrom = null, dateTo = null } = {}) {
  const MLABEL = { "01":"Jan", "02":"Feb", "03":"Mar", "04":"Apr", "05":"May", "06":"Jun", "07":"Jul", "08":"Aug", "09":"Sep", "10":"Oct", "11":"Nov", "12":"Dec" };
  let rows = rawRows;
  if (district !== "all") rows = rows.filter(r => r.district_name === district);
  if (dateFrom || dateTo) {
    rows = rows.filter(r => {
      const d = getRowDate(r);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }
  // Bucket by YYYY-MM
  const buckets = {};
  rows.forEach(r => {
    const d = getRowDate(r);
    if (!d) return;
    const ym = d.slice(0, 7); // "2024-04"
    if (!buckets[ym]) buckets[ym] = { cases: 0, scrT: 0, scrA: 0, budA: 0, budU: 0, diseases: {} };
    const b = buckets[ym];
    b.cases += Number(r.cases) || 0;
    b.scrT += Number(r.screening_target) || 0;
    b.scrA += Number(r.screening_achieved) || 0;
    b.budA += Number(r.budget_allocated_lakhs) || 0;
    b.budU += Number(r.budget_utilized_lakhs) || 0;
    const dis = r.disease_type;
    if (dis) b.diseases[dis] = (b.diseases[dis] || 0) + (Number(r.cases) || 0);
  });
  // Sort by key and build array
  return Object.keys(buckets).sort().map(ym => {
    const [y, m] = ym.split("-");
    return { ym, label: `${MLABEL[m]} '${y.slice(2)}`, ...buckets[ym], scrPct: buckets[ym].scrT > 0 ? (buckets[ym].scrA / buckets[ym].scrT * 100) : 0, budPct: buckets[ym].budA > 0 ? (buckets[ym].budU / buckets[ym].budA * 100) : 0 };
  });
}

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
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { data: null, error: "CSV is empty" };
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const missing = ["district_name", "month", "disease_type", "cases"].filter(r => !headers.includes(r));
  if (missing.length) return { data: null, error: `Missing columns: ${missing.join(", ")}` };

  const rows = []; const errors = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(",").map(v => v.trim());
    const row = {}; headers.forEach((h, j) => row[h] = vals[j] || "");
    if (!row.district_name || !row.disease_type) { errors.push(`Row ${i + 1}: missing district/disease`); continue; }
    row.year = parseInt(row.year) || 2026;
    row.cases = parseInt(row.cases) || 0;
    row.screening_target = parseInt(row.screening_target) || 0;
    row.screening_achieved = parseInt(row.screening_achieved) || 0;
    row.budget_allocated_lakhs = parseFloat(row.budget_allocated_lakhs) || 0;
    row.budget_utilized_lakhs = parseFloat(row.budget_utilized_lakhs) || 0;
    row.hr_sanctioned = parseInt(row.hr_sanctioned) || 0;
    row.hr_in_position = parseInt(row.hr_in_position) || 0;
    row.drug_availability_pct = parseFloat(row.drug_availability_pct) || 0;
    rows.push(row);
  }

  const districtMap = {};
  rows.forEach(r => {
    const key = r.district_name;
    if (!districtMap[key]) {
      const meta = DISTRICTS_META.find(m => m.name.toLowerCase() === key.toLowerCase()) || { id: Object.keys(districtMap).length + 100, name: key, zone: "Other", population: 0 };
      districtMap[key] = { ...meta, name: key, _cases: 0, _scrT: 0, _scrA: 0, _budA: 0, _budU: 0, _hrS: 0, _hrF: 0, _drugSum: 0, _drugN: 0, _disease: {}, _month: {}, _monthScr: {} };
    }
    const d = districtMap[key];
    d._cases += r.cases; d._scrT += r.screening_target; d._scrA += r.screening_achieved;
    d._budA += r.budget_allocated_lakhs; d._budU += r.budget_utilized_lakhs;
    d._hrS += r.hr_sanctioned; d._hrF += r.hr_in_position;
    if (r.drug_availability_pct) { d._drugSum += r.drug_availability_pct; d._drugN++; }
    d._disease[r.disease_type] = (d._disease[r.disease_type] || 0) + r.cases;
    if (r.month) { d._month[r.month] = (d._month[r.month] || 0) + r.cases; d._monthScr[r.month] = (d._monthScr[r.month] || 0) + r.screening_achieved; }
  });

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
    diseaseBreakdown: DISEASES.map(disease => ({ disease, cases: d._disease[disease] || 0, trend: 0 })),
    monthlyTrend: MONTHS.map(m => ({ month: m, cases: d._month[m] || 0, screenings: d._monthScr[m] || 0 })),
    quarterlyBudget: QUARTERS.map(q => ({ quarter: q, allocated: Math.round(d._budA * 100000 / 4), utilized: Math.round(d._budU * 100000 / 4) })),
  }));

  return { data, rows, error: null, warnings: errors, rowCount: rows.length, districtCount: data.length };
}

function calculateAge(dob) {
  if (!dob) return "";
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
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

// ─── Diease Monthly Data ─── 
function getDiseaseMonthlyData(rows, district, dateFrom, dateTo) {
  return rows
    .filter(r =>
      (!district || r.district_name === district) &&
      (!dateFrom || r.month_date >= dateFrom) &&
      (!dateTo || r.month_date <= dateTo)
    )
    .map(r => ({
      label: r.month_date,
      disease: r.disease_type,
      cases: Number(r.cases || 0)
    }))
    .sort((a, b) => new Date(a.label) - new Date(b.label));
}

// ─── Aggregate raw rows with filters ───
function aggregateRows(rows, { district = "all", month = "all", year = "all", dateFrom = null, dateTo = null } = {}, allRows = null) {
  const fullSet = allRows || rows;
  let filtered = rows;
  if (district !== "all") filtered = filtered.filter(r => r.district_name === district);
  if (month !== "all") filtered = filtered.filter(r => r.month === month);
  if (year !== "all") filtered = filtered.filter(r => {
    const rowYear = r.year || (r.month_date ? new Date(r.month_date).getFullYear() : null);
    return String(rowYear) === String(year);
  });
  if (dateFrom || dateTo) {
    filtered = filtered.filter(r => {
      const d = getRowDate(r);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }
  const districtMap = {};
  filtered.forEach(r => {
    const key = r.district_name;
    if (!districtMap[key]) {
      const meta = DISTRICTS_META.find(m => m.name.toLowerCase() === key.toLowerCase()) || { id: Object.keys(districtMap).length + 100, name: key, zone: "Other", population: 0 };
      districtMap[key] = { ...meta, name: key, _cases: 0, _scrT: 0, _scrA: 0, _budA: 0, _budU: 0, _hrS: 0, _hrF: 0, _drugSum: 0, _drugN: 0, _disease: {}, _month: {}, _monthScr: {} };
    }
    const d = districtMap[key];
    d._cases += Number(r.cases) || 0;
    d._scrT += Number(r.screening_target) || 0;
    d._scrA += Number(r.screening_achieved) || 0;
    d._budA += Number(r.budget_allocated_lakhs) || 0;
    d._budU += Number(r.budget_utilized_lakhs) || 0;
    d._hrS += Number(r.hr_sanctioned) || 0;
    d._hrF += Number(r.hr_in_position) || 0;
    const drug = Number(r.drug_availability_pct) || 0;
    if (drug) { d._drugSum += drug; d._drugN++; }
    d._disease[r.disease_type] = (d._disease[r.disease_type] || 0) + (Number(r.cases) || 0);
    if (r.month) {
      d._month[r.month] = (d._month[r.month] || 0) + (Number(r.cases) || 0);
      d._monthScr[r.month] = (d._monthScr[r.month] || 0) + (Number(r.screening_achieved) || 0);
    }
  });

  return Object.values(districtMap).map(d => ({
    id: d.id, name: d.name, zone: d.zone, population: d.population,
    totalCases: d._cases,
    prevalenceRate: d.population > 0 ? (d._cases / d.population * 10000).toFixed(1) : "0",
    screeningRate: d._scrT > 0 ? (d._scrA / d._scrT * 100).toFixed(1) : "0",
    screeningTarget: d._scrT, screeningAchieved: d._scrA,
    budgetAllocated: d._budA * 100000,
    budgetUtilized: d._budA > 0 ? d._budU / d._budA : 0,
    hrSanctioned: d._hrS, hrFilled: d._hrS > 0 ? d._hrF / d._hrS : 0,
    drugAvailability: d._drugN > 0 ? (d._drugSum / d._drugN).toFixed(1) : "0",
    diseaseBreakdown: DISEASES.map(disease => {
      const cases = d._disease[disease] || 0;
      const relevantRows = fullSet.filter(r => r.district_name === d.name && r.disease_type === disease);
      const yearsInData = [...new Set(relevantRows.map(r => {
        const y = r.year || (r.month_date ? new Date(r.month_date).getFullYear() : null);
        return y ? Number(y) : null;
      }).filter(Boolean))].sort();
      let trend = 0;
      if (yearsInData.length >= 2) {
        const currentYear = year !== "all" ? Number(year) : yearsInData[yearsInData.length - 1];
        const prevYear = yearsInData[yearsInData.indexOf(currentYear) - 1] || yearsInData[yearsInData.length - 2];
        if (currentYear && prevYear && currentYear !== prevYear) {
          const getYear = r => Number(r.year) || (r.month_date ? new Date(r.month_date).getFullYear() : null);
          let curRows = relevantRows.filter(r => getYear(r) === currentYear);
          let prevRows = relevantRows.filter(r => getYear(r) === prevYear);
          if (month !== "all") { curRows = curRows.filter(r => r.month === month); prevRows = prevRows.filter(r => r.month === month); }
          const curCases = curRows.reduce((s, r) => s + (Number(r.cases) || 0), 0);
          const prevCases = prevRows.reduce((s, r) => s + (Number(r.cases) || 0), 0);
          if (prevCases > 0) trend = ((curCases - prevCases) / prevCases) * 100;
        }
      }
      return { disease, cases, trend };
    }),
    monthlyTrend: MONTHS.map(m => ({ month: m, cases: d._month[m] || 0, screenings: d._monthScr[m] || 0 })),
    quarterlyBudget: QUARTERS.map(q => ({ quarter: q, allocated: Math.round(d._budA * 100000 / 4), utilized: Math.round(d._budU * 100000 / 4) })),
  }));
}

// ─── Palette ───
const P = {
  // 🧱 BACKGROUNDS
  bg: "#F5F5F4",
  surface: "#FDFDFC",
  surfaceAlt: "#E7E5E4",
  // 🪵 BORDERS
  border: "#E5E7EB",
  borderLight: "#F1F5F9",
  // 📝 TEXT
  text: "#1F2937",
  textMuted: "#6B7280",
  textDim: "#9CA3AF",
  // 🔶 ACCENT
  accent: "#C2410C",
  accentGlow: "rgba(194,65,12,0.08)",
  // 🚦 STATUS
  green: "#059669",
  red: "#991B1B",
  amber: "#D97706",
  purple: "#7E22CE",
  blue: "#1E40AF",
  // 🎨 subtle backgrounds
  blueDim: "rgba(30,64,175,0.08)",
  purpleDim: "rgba(126,34,206,0.08)",
  amberDim: "rgba(180,83,9,0.08)"
};
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
  Heart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  List: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Eye: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
  Alert: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
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
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const [barW, setBarW] = useState(40);
  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.offsetWidth;
      setBarW(Math.floor((w - 8) / Math.min(data.length, 12)) - 3);
    }
  }, [data]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [data, barW]);
  const bw = Math.max(barW, 28);
  return <div ref={containerRef} style={{ width: "100%" }}>
    <div ref={scrollRef} style={{ overflowX: data.length > 12 ? "auto" : "hidden", overflowY: "hidden", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: h, padding: "0 4px", width: data.length > 12 ? data.length * (bw + 3) + 8 : "100%" }}>
        {data.map((d, i) => <div key={i} style={{ flex: data.length <= 12 ? 1 : "none", width: data.length > 12 ? bw : undefined, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 9, color: P.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>{d[vk] >= 1000 ? (d[vk] / 1000).toFixed(0) + "k" : d[vk]}</div>
          <div style={{ width: "70%", maxWidth: 32, height: Math.max((d[vk] / max) * (h - 28), 2), background: `linear-gradient(180deg, ${color}, ${color}88)`, borderRadius: "4px 4px 2px 2px" }} />
          <div style={{ fontSize: 9, color: P.textDim, whiteSpace: "nowrap" }}>{d[lk]}</div>
        </div>)}
      </div>
    </div>
  </div>;
}
function Donut({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.cases, 0);
  if (!total) return <div style={{ color: P.textDim }}>No data</div>;
  let cum = 0; const segs = data.map(d => { const s = cum; cum += d.cases / total; return { ...d, s, e: cum }; });
  const r = size / 2 - 12, cx = size / 2, cy = size / 2;
  return <div style={{ display: "flex", alignItems: "center", gap: 20 }}><svg width={size} height={size}>{segs.map((seg, i) => { const sa = seg.s * 2 * Math.PI - Math.PI / 2, ea = seg.e * 2 * Math.PI - Math.PI / 2; return <path key={i} d={`M${cx},${cy} L${cx + r * Math.cos(sa)},${cy + r * Math.sin(sa)} A${r},${r} 0 ${ea - sa > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(ea)},${cy + r * Math.sin(ea)} Z`} fill={DC[seg.disease] || P.accent} opacity="0.85" stroke={P.surface} strokeWidth="2" />; })}<circle cx={cx} cy={cy} r={r * 0.55} fill={P.surface} /><text x={cx} y={cy - 4} textAnchor="middle" fill={P.text} fontSize="18" fontWeight="700">{(total / 1000).toFixed(0)}k</text><text x={cx} y={cy + 12} textAnchor="middle" fill={P.textDim} fontSize="9">TOTAL</text></svg><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{data.map(d => <div key={d.disease} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: DC[d.disease] || P.accent }} /><span style={{ color: P.textMuted, minWidth: 90 }}>{d.disease}</span><span style={{ color: P.text, fontWeight: 600 }}>{d.cases.toLocaleString()}</span></div>)}</div></div>;
}

// ─── Filter Bar ───
const selStyle = { background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 8, padding: "6px 12px", color: P.text, fontSize: 12, fontFamily: "'DM Sans'", outline: "none", cursor: "pointer", minWidth: 100 };

function FilterBar({ district, setDistrict, districts, timeRange, setTimeRange, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const dateInp = { background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 8, padding: "6px 12px", color: P.text, fontSize: 12, fontFamily: "'DM Sans'", outline: "none", minWidth: 130 };
  return <div className="ncd-filter-bar" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "12px 0" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: P.textDim, fontWeight: 600, textTransform: "uppercase" }}>District</span>
      <select value={district} onChange={e => setDistrict(e.target.value)} style={selStyle}>
        <option value="all">All Districts</option>
        {districts.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 11, color: P.textDim, fontWeight: 600, textTransform: "uppercase", marginRight: 2 }}>Period</span>
      <div className="ncd-filter-pills" style={{ display: "flex", gap: 2, background: P.surfaceAlt, borderRadius: 8, padding: 2, border: `1px solid ${P.border}` }}>
        {TIME_RANGES.map(tr => (
          <button key={tr.id} className="ncd-filter-pill" onClick={() => setTimeRange(tr.id)} style={{
            padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans'", whiteSpace: "nowrap",
            background: timeRange === tr.id ? P.accent : "transparent",
            color: timeRange === tr.id ? "#fff" : P.textMuted,
            transition: "all 0.15s",
          }}>{tr.label}</button>
        ))}
      </div>
    </div>
    {timeRange === "custom" && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input type="date" value={customFrom || ""} onChange={e => setCustomFrom(e.target.value)} style={dateInp} />
      <span style={{ fontSize: 11, color: P.textDim }}>to</span>
      <input type="date" value={customTo || ""} onChange={e => setCustomTo(e.target.value)} style={dateInp} />
    </div>}
    {(district !== "all" || timeRange !== "12m") && <button onClick={() => { setDistrict("all"); setTimeRange("12m"); setCustomFrom(""); setCustomTo(""); }} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 6, padding: "5px 12px", color: P.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans'" }}>Reset</button>}
  </div>;
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

// ─── Alerts ───
function Alerts({ dd, role }) {
  const alerts = [];
  const districts = role.allDistricts ? dd : dd.filter(d => d.name === role.district);
  districts.forEach(d => {
    const scr = parseFloat(d.screeningRate), drug = parseFloat(d.drugAvailability), bud = d.budgetUtilized * 100, hr = d.hrFilled * 100;
    if (scr < 40) alerts.push({ district: d.name, type: "critical", msg: `Screening coverage critically low at ${scr}%`, metric: "Screening", value: scr });
    else if (scr < 55) alerts.push({ district: d.name, type: "warning", msg: `Screening coverage below target at ${scr}%`, metric: "Screening", value: scr });
    if (drug < 40) alerts.push({ district: d.name, type: "critical", msg: `Drug availability critically low at ${drug}%`, metric: "Drugs", value: drug });
    else if (drug < 60) alerts.push({ district: d.name, type: "warning", msg: `Drug availability below threshold at ${drug}%`, metric: "Drugs", value: drug });
    if (bud < 35) alerts.push({ district: d.name, type: "critical", msg: `Budget utilization critically low at ${bud.toFixed(0)}%`, metric: "Budget", value: bud });
    else if (bud < 55) alerts.push({ district: d.name, type: "warning", msg: `Budget underutilized at ${bud.toFixed(0)}%`, metric: "Budget", value: bud });
    if (hr < 45) alerts.push({ district: d.name, type: "critical", msg: `HR positions severely understaffed at ${hr.toFixed(0)}%`, metric: "HR", value: hr });
    else if (hr < 60) alerts.push({ district: d.name, type: "warning", msg: `HR fill rate low at ${hr.toFixed(0)}%`, metric: "HR", value: hr });
    d.diseaseBreakdown.forEach(db => {
      if (db.trend > 40) alerts.push({ district: d.name, type: "critical", msg: `${db.disease} cases spiking: +${db.trend.toFixed(0)}% YoY`, metric: db.disease, value: db.trend });
      else if (db.trend > 20) alerts.push({ district: d.name, type: "warning", msg: `${db.disease} cases rising: +${db.trend.toFixed(0)}% YoY`, metric: db.disease, value: db.trend });
    });
  });
  alerts.sort((a, b) => { if (a.type === "critical" && b.type !== "critical") return -1; if (a.type !== "critical" && b.type === "critical") return 1; return a.value - b.value; });
  const critical = alerts.filter(a => a.type === "critical"), warnings = alerts.filter(a => a.type === "warning");
  const AlertCard = ({ a, color, bg }) => (
    <div style={{ background: P.surface, border: `1px solid ${color}30`, borderRadius: 10, padding: "14px 18px", borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>{a.district}</div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${color}20`, color, fontWeight: 700 }}>{a.metric}</span>
      </div>
      <div style={{ fontSize: 12, color: P.textMuted, marginTop: 4 }}>{a.msg}</div>
    </div>
  );
  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Alerts & Notifications</div>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#EF444420", color: P.red, fontWeight: 700 }}>{critical.length} Critical</span>
        <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#F59E0B20", color: P.amber, fontWeight: 700 }}>{warnings.length} Warnings</span>
      </div>
    </div>
    {!role.allDistricts && <div style={{ fontSize: 12, color: P.accent, fontWeight: 600, padding: "8px 14px", background: P.accentGlow, borderRadius: 8 }}>Showing alerts for {role.district} only</div>}
    {alerts.length === 0 && <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: P.textDim }}>No active alerts. All metrics within thresholds.</div>}
    {critical.length > 0 && <><div style={{ fontSize: 13, fontWeight: 700, color: P.red, textTransform: "uppercase", letterSpacing: "0.05em" }}>Critical</div>{critical.map((a, i) => <AlertCard key={`c${i}`} a={a} color={P.red} />)}</>}
    {warnings.length > 0 && <><div style={{ fontSize: 13, fontWeight: 700, color: P.amber, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Warnings</div>{warnings.map((a, i) => <AlertCard key={`w${i}`} a={a} color={P.amber} />)}</>}
  </div>;
}

// ─── Reports ───
function Reports({ rawRows, role }) {
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [fDistrict, setFDistrict] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const districtNames = [...new Set(rawRows.map(r => r.district_name))].sort();

  const { from: dateFrom, to: dateTo } = getDateRange(timeRange, customFrom, customTo);
  const fdd = aggregateRows(rawRows, { district: fDistrict, dateFrom, dateTo }, rawRows);
  const fst = computeTotals(fdd);
  const s = fdd.find(d => d.id === sel);

  const fb = <FilterBar district={fDistrict} setDistrict={setFDistrict} districts={districtNames} timeRange={timeRange} setTimeRange={setTimeRange} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />;

  // Time-series data respecting filters
  const ts = buildTimeSeries(rawRows, { district: fDistrict, dateFrom, dateTo });

  const showAlerts = role && (role.label.includes("Admin") || role.label.includes("District"));
  const tabs = [{ id: "dashboard", l: "Dashboard" }, ...(showAlerts ? [{ id: "alerts", l: "⚠ Alerts" }] : []), { id: "heatmap", l: "Heatmap" }, { id: "screening", l: "Screening" }, { id: "disease", l: "Disease Trends" }, { id: "budget", l: "Budget" }, { id: "benchmarks", l: "Benchmarks" }];
  const totDis = DISEASES.map(dis => ({ disease: dis, cases: fdd.reduce((sum, d) => sum + (d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0), 0) }));

  // ── Shared export helpers ──
  const filterLabel = [fDistrict !== "all" ? fDistrict : "All Districts", TIME_RANGES.find(t => t.id === timeRange)?.label || "Custom", dateFrom || "", dateTo || ""].filter(Boolean).join(" · ");
  const nowStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const openPrint = (html) => { const w = window.open("", "_blank"); w.document.write(html); w.document.close(); };

  // SVG bar chart generator for print
  const svgBar = (items, { w = 600, h = 180, color = "#C2410C", labelKey = "l", valueKey = "v" } = {}) => {
    const max = Math.max(...items.map(d => d[valueKey]), 1);
    const barW = Math.min(32, (w - 60) / items.length - 4);
    const gap = 4;
    const totalW = items.length * (barW + gap);
    const startX = (w - totalW) / 2;
    let bars = "";
    items.forEach((d, i) => {
      const bh = Math.max((d[valueKey] / max) * (h - 40), 2);
      const x = startX + i * (barW + gap);
      const y = h - 20 - bh;
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${color}" rx="3"/>`;
      bars += `<text x="${x + barW/2}" y="${y - 4}" text-anchor="middle" font-size="8" fill="#64748b" font-weight="600">${d[valueKey] >= 1000 ? (d[valueKey]/1000).toFixed(0)+"k" : d[valueKey]}</text>`;
      bars += `<text x="${x + barW/2}" y="${h - 6}" text-anchor="middle" font-size="7" fill="#94a3b8">${d[labelKey]}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#f8fafc" rx="8"/>${bars}</svg>`;
  };

  // SVG horizontal bar chart
  const svgHBar = (items, { w = 500, rowH = 28, color = "#C2410C" } = {}) => {
    const max = Math.max(...items.map(d => d.v), 1);
    const h = items.length * rowH + 10;
    const labelW = 100, barStart = 110, barMaxW = w - barStart - 70;
    let rows = "";
    items.forEach((d, i) => {
      const y = i * rowH + 14;
      const bw = Math.max((d.v / max) * barMaxW, 2);
      const c = d.color || color;
      rows += `<text x="${labelW}" y="${y + 4}" text-anchor="end" font-size="10" fill="#1f2937" font-weight="600">${d.l}</text>`;
      rows += `<rect x="${barStart}" y="${y - 8}" width="${bw}" height="18" fill="${c}" rx="4" opacity="0.85"/>`;
      rows += `<text x="${barStart + bw + 6}" y="${y + 4}" font-size="10" fill="#1f2937" font-weight="700">${typeof d.v === "number" ? (d.v % 1 === 0 ? d.v.toLocaleString() : d.v.toFixed(1)) : d.v}${d.suffix || ""}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
  };

  // SVG donut
  const svgDonut = (items, { size = 200 } = {}) => {
    const total = items.reduce((s, d) => s + d.v, 0);
    if (!total) return "";
    const r = size/2 - 20, cx = size/2, cy = size/2;
    let cum = 0, paths = "", legend = "";
    const colors = ["#C2410C","#991B1B","#D97706","#7E22CE","#EC4899","#059669"];
    items.forEach((d, i) => {
      const start = cum; cum += d.v / total;
      const sa = start * 2 * Math.PI - Math.PI/2, ea = cum * 2 * Math.PI - Math.PI/2;
      const large = (cum - start) > 0.5 ? 1 : 0;
      const c = colors[i % colors.length];
      paths += `<path d="M${cx},${cy} L${cx+r*Math.cos(sa)},${cy+r*Math.sin(sa)} A${r},${r} 0 ${large} 1 ${cx+r*Math.cos(ea)},${cy+r*Math.sin(ea)} Z" fill="${c}" opacity="0.85" stroke="white" stroke-width="2"/>`;
      legend += `<text x="${size + 12}" y="${28 + i * 20}" font-size="10" fill="#1f2937"><tspan fill="${c}" font-size="12">■</tspan> ${d.l}: ${d.v.toLocaleString()} (${(d.v/total*100).toFixed(0)}%)</text>`;
    });
    const totalW = size + 180;
    const totalH = Math.max(size, items.length * 20 + 20);
    return `<svg viewBox="0 0 ${totalW} ${totalH}" width="100%" xmlns="http://www.w3.org/2000/svg">${paths}<circle cx="${cx}" cy="${cy}" r="${r*0.55}" fill="white"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#1f2937">${(total/1000).toFixed(0)}k</text>${legend}</svg>`;
  };

  // ── Export Summary (existing table-based report) ──
  const exportSummary = () => {
    const districtRows = fdd.map(d => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-weight:600">${d.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right">${d.totalCases.toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right">${d.screeningRate}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right">${d.drugAvailability}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right">${(d.budgetUtilized * 100).toFixed(1)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right">${(d.hrFilled * 100).toFixed(0)}%</td>
    </tr>`).join("");
    const diseaseRows = totDis.map(d => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${d.disease}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${d.cases.toLocaleString()}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${fst.totalCases > 0 ? ((d.cases / fst.totalCases) * 100).toFixed(1) : 0}%</td>
    </tr>`).join("");
    const heatmapRows = fdd.map(d => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:11px">${d.name}</td>
      ${DISEASES.map(dis => { const c = d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0; const bg = c > 500 ? "#fee2e2" : c > 200 ? "#fef3c7" : c > 50 ? "#e0f2fe" : "#f0fdf4"; return `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;background:${bg};font-size:11px;font-weight:600">${c.toLocaleString()}</td>`; }).join("")}
    </tr>`).join("");
    const screeningRows = [...fdd].sort((a, b) => parseFloat(a.screeningRate) - parseFloat(b.screeningRate)).map(d => {
      const r = parseFloat(d.screeningRate); const color = r > 65 ? "#059669" : r > 45 ? "#d97706" : "#dc2626";
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${d.name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;color:${color};font-weight:700">${d.screeningRate}%</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${(d.screeningTarget/1000).toFixed(0)}k</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${(d.screeningAchieved/1000).toFixed(0)}k</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${((d.screeningTarget-d.screeningAchieved)/1000).toFixed(0)}k</td></tr>`;
    }).join("");
    openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>NCD Summary — ${filterLabel}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:40px;font-size:13px;line-height:1.5}h1{font-size:22px;color:#C2410C;margin-bottom:4px}h2{font-size:16px;color:#334155;margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid #C2410C}.meta{font-size:12px;color:#64748b;margin-bottom:24px}.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}.kpi{border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}.kpi-val{font-size:24px;font-weight:800;color:#C2410C}.kpi-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #cbd5e1}.right{text-align:right}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}.page-break{page-break-before:always;break-before:page}@media print{body{padding:20px}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head><body>
    <h1>NCD Surveillance Report</h1><div class="meta">State Health Department — Chhattisgarh<br>Generated: ${nowStr} · Filters: ${filterLabel}${role && !role.allDistricts ? " · Role: " + role.label : ""}</div>
    <h2>Key Performance Indicators</h2><div class="kpi-grid"><div class="kpi"><div class="kpi-val">${fst.totalCases.toLocaleString()}</div><div class="kpi-label">Total Cases</div></div><div class="kpi"><div class="kpi-val">${fst.avgScreening}%</div><div class="kpi-label">Avg Screening</div></div><div class="kpi"><div class="kpi-val">${fst.avgBudgetUtil}%</div><div class="kpi-label">Budget Util.</div></div><div class="kpi"><div class="kpi-val">${fst.avgDrugAvail}%</div><div class="kpi-label">Drug Avail.</div></div><div class="kpi"><div class="kpi-val">${fst.avgHrFill}%</div><div class="kpi-label">HR Filled</div></div></div>
    <h2>District Performance</h2><table><thead><tr><th>District</th><th class="right">Cases</th><th class="right">Screening</th><th class="right">Drugs</th><th class="right">Budget</th><th class="right">HR</th></tr></thead><tbody>${districtRows}</tbody></table>
    <div class="page-break"></div><h2>Disease Distribution</h2><table><thead><tr><th>Disease</th><th class="right">Cases</th><th class="right">Share</th></tr></thead><tbody>${diseaseRows}</tbody></table>
    <div class="page-break"></div><h2>Disease Heatmap</h2><table><thead><tr><th>District</th>${DISEASES.map(d => `<th style="text-align:center;font-size:9px">${d}</th>`).join("")}</tr></thead><tbody>${heatmapRows}</tbody></table>
    <div class="page-break"></div><h2>Screening Coverage</h2><table><thead><tr><th>District</th><th class="right">Coverage</th><th class="right">Target</th><th class="right">Achieved</th><th class="right">Gap</th></tr></thead><tbody>${screeningRows}</tbody></table>
    <div class="footer">NCD Analytics Platform · State Health Department, Chhattisgarh · Confidential<br>Auto-generated report. Verify with source records before policy decisions.</div>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  };

  // ── Export Presentation (slide-style with charts) ──
  const exportPresentation = () => {
    const slide = (title, content) => `<div class="slide"><div class="slide-header"><div class="slide-num">${title}</div></div><div class="slide-body">${content}</div><div class="slide-footer">NCD Analytics · Chhattisgarh · ${nowStr}</div></div>`;

    // Monthly trend data for chart
    const monthlyChart = svgBar(ts.slice(-12).map(t => ({ l: t.label, v: t.cases })), { color: "#C2410C", labelKey: "l", valueKey: "v" });

    // Disease donut
    const diseaseDonut = svgDonut(totDis.map(d => ({ l: d.disease, v: d.cases })));

    // Screening horizontal bars
    const scrBars = svgHBar([...fdd].sort((a, b) => parseFloat(b.screeningRate) - parseFloat(a.screeningRate)).map(d => {
      const r = parseFloat(d.screeningRate);
      return { l: d.name, v: r, suffix: "%", color: r > 65 ? "#059669" : r > 45 ? "#D97706" : "#991B1B" };
    }));

    // Budget horizontal bars
    const budBars = svgHBar(fdd.map(d => ({ l: d.name, v: Math.round(d.budgetUtilized * 100), suffix: "%", color: d.budgetUtilized > 0.75 ? "#059669" : d.budgetUtilized > 0.55 ? "#D97706" : "#991B1B" })));

    // Top 5 critical districts
    const worstScr = [...fdd].sort((a, b) => parseFloat(a.screeningRate) - parseFloat(b.screeningRate)).slice(0, 5);
    const actionItems = worstScr.map(d => `<div class="action-item"><span class="action-district">${d.name}</span><span class="action-detail">Screening: <b style="color:#991B1B">${d.screeningRate}%</b> · Drugs: ${d.drugAvailability}% · Budget: ${(d.budgetUtilized*100).toFixed(0)}%</span></div>`).join("");

    // Disease per district chart (top 3 districts by cases)
    const top3 = [...fdd].sort((a, b) => b.totalCases - a.totalCases).slice(0, 3);
    const distCharts = top3.map(d => {
      const bars = svgHBar(d.diseaseBreakdown.map(db => ({ l: db.disease, v: db.cases, color: DC[db.disease] || "#C2410C" })), { w: 350 });
      return `<div class="dist-card"><div class="dist-name">${d.name} <span style="font-size:12px;color:#64748b">${d.totalCases.toLocaleString()} cases</span></div>${bars}</div>`;
    }).join("");

    // Screening trend chart
    const scrTrendChart = svgBar(ts.slice(-12).map(t => ({ l: t.label, v: Math.round(t.scrPct * 10) / 10 })), { color: "#059669", labelKey: "l", valueKey: "v" });

    openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>NCD Presentation — ${filterLabel}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1f2937}
      .slide{width:100%;max-width:900px;min-height:540px;margin:20px auto;background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:0;overflow:visible;page-break-after:always;position:relative;display:flex;flex-direction:column}
      .slide-header{padding:28px 40px 0;border-bottom:none}
      .slide-num{font-size:24px;font-weight:800;color:#1f2937;line-height:1.2}
      .slide-body{flex:1;padding:20px 40px 16px;overflow:visible}
      .slide-footer{padding:12px 40px;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9}
      .kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:16px 0}
      .kpi-card{background:#f8fafc;border-radius:10px;padding:16px;text-align:center;border:1px solid #e2e8f0}
      .kpi-val{font-size:26px;font-weight:800;color:#C2410C}
      .kpi-label{font-size:10px;color:#64748b;text-transform:uppercase;margin-top:4px;letter-spacing:0.05em}
      .chart-title{font-size:14px;font-weight:700;color:#334155;margin:14px 0 10px}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
      .action-item{padding:10px 16px;border-left:3px solid #991B1B;background:#fef2f2;border-radius:0 8px 8px 0;margin-bottom:8px}
      .action-district{font-weight:700;font-size:14px;display:block}
      .action-detail{font-size:12px;color:#64748b;margin-top:2px;display:block}
      .dist-card{background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:12px;border:1px solid #e2e8f0}
      .dist-name{font-size:15px;font-weight:700;margin-bottom:8px}
      .insight{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:13px;color:#92400e;margin-top:12px}
      @media print{body{background:white;padding:0}.slide{box-shadow:none;margin:0;border-radius:0;page-break-after:always;page-break-inside:avoid;max-width:100%}svg{max-width:100%!important}}
    </style></head><body>

    ${slide("NCD Surveillance Overview", `
      <div style="font-size:14px;color:#64748b;margin-bottom:8px">State Health Department — Chhattisgarh · ${filterLabel}</div>
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-val">${fst.totalCases.toLocaleString()}</div><div class="kpi-label">Total Cases</div></div>
        <div class="kpi-card"><div class="kpi-val">${fst.avgScreening}%</div><div class="kpi-label">Screening Rate</div></div>
        <div class="kpi-card"><div class="kpi-val">${fst.avgBudgetUtil}%</div><div class="kpi-label">Budget Utilization</div></div>
        <div class="kpi-card"><div class="kpi-val">${fst.avgDrugAvail}%</div><div class="kpi-label">Drug Availability</div></div>
        <div class="kpi-card"><div class="kpi-val">${fst.avgHrFill}%</div><div class="kpi-label">HR Fill Rate</div></div>
      </div>
      <div class="chart-title">Monthly Case Registrations</div>
      ${monthlyChart}
    `)}

    ${slide("Disease Distribution", `
      <div class="two-col">
        <div>
          <div class="chart-title">Cases by Disease Type</div>
          ${diseaseDonut}
        </div>
        <div>
          <div class="chart-title">Top Districts by Caseload</div>
          ${distCharts}
        </div>
      </div>
    `)}

    ${slide("Screening Coverage", `
      <div class="two-col">
        <div>
          <div class="chart-title">District-wise Screening Rate</div>
          ${scrBars}
        </div>
        <div>
          <div class="chart-title">Screening Trend (Monthly %)</div>
          ${scrTrendChart}
          <div class="insight">
            <b>Key Insight:</b> ${parseFloat(fst.avgScreening) < 50 ? "State average screening is below 50% — urgent scale-up needed across multiple districts." : parseFloat(fst.avgScreening) < 65 ? "Screening coverage improving but still below the 65% target in several districts." : "Screening coverage is on track. Focus on maintaining momentum in lagging districts."}
          </div>
        </div>
      </div>
    `)}

    ${slide("Budget & Resource Utilization", `
      <div class="two-col">
        <div>
          <div class="chart-title">Budget Utilization by District</div>
          ${budBars}
        </div>
        <div>
          <div class="chart-title">Resource Summary</div>
          <div style="margin-top:8px">
            ${fdd.map(d => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span style="font-weight:600">${d.name}</span><span>HR: <b>${(d.hrFilled*100).toFixed(0)}%</b> · Drugs: <b>${d.drugAvailability}%</b></span></div>`).join("")}
          </div>
        </div>
      </div>
    `)}

    ${slide("Action Items & Recommendations", `
      <div class="chart-title" style="color:#991B1B">Districts Requiring Immediate Attention</div>
      <div style="margin:12px 0">${actionItems}</div>
      <div class="chart-title" style="margin-top:24px">Recommended Interventions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px"><b style="color:#166534">Screening Scale-up</b><div style="font-size:12px;color:#64748b;margin-top:4px">Deploy mobile screening units to districts below 45% coverage. Target: 65% by Q4.</div></div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px"><b style="color:#1e40af">HR Gap Filling</b><div style="font-size:12px;color:#64748b;margin-top:4px">Prioritize CHO and ANM recruitment in ${worstScr[0]?.name || "underperforming"} district.</div></div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px"><b style="color:#92400e">Drug Supply Chain</b><div style="font-size:12px;color:#64748b;margin-top:4px">Review procurement pipeline for districts with <50% drug availability.</div></div>
        <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:14px"><b style="color:#9d174d">Budget Acceleration</b><div style="font-size:12px;color:#64748b;margin-top:4px">Expedite fund release for districts with <40% budget utilization.</div></div>
      </div>
    `)}

    <script>window.onload=function(){window.print()}</script></body></html>`);
  };

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [aiExporting, setAiExporting] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareDistricts, setCompareDistricts] = useState([]);
  const COMPARE_COLORS = ["#C2410C", "#1E40AF", "#7E22CE", "#059669"];
  const addCompareDistrict = (name) => { if (name && !compareDistricts.includes(name) && compareDistricts.length < 4) setCompareDistricts([...compareDistricts, name]); };
  const removeCompareDistrict = (name) => setCompareDistricts(compareDistricts.filter(d => d !== name));
  const compareData = compareDistricts.map(name => fdd.find(d => d.name === name)).filter(Boolean);

  // ── Export AI Insights Presentation ──
  const exportAIInsights = async () => {
    setShowExportMenu(false);
    setAiExporting(true);
    try {
      // Build data context
      const districtCtx = fdd.map(d => `${d.name}: Cases=${d.totalCases}, Screening=${d.screeningRate}%, Drugs=${d.drugAvailability}%, Budget=${(d.budgetUtilized*100).toFixed(0)}%, HR=${(d.hrFilled*100).toFixed(0)}%, Diseases=[${d.diseaseBreakdown.map(x => `${x.disease}:${x.cases}`).join(",")}]`).join("\n");
      const trendCtx = ts.slice(-12).map(t => `${t.label}: Cases=${t.cases}, ScrRate=${t.scrPct.toFixed(1)}%, BudRate=${t.budPct.toFixed(1)}%`).join("\n");
      const diseaseCtx = totDis.map(d => `${d.disease}: ${d.cases} cases (${fst.totalCases > 0 ? ((d.cases/fst.totalCases)*100).toFixed(1) : 0}%)`).join("\n");

      const prompt = `You are generating content for an executive NCD surveillance presentation for Chhattisgarh state health officials. Based on the data below, generate EXACTLY 5 sections in JSON format.

DATA:
State: Pop ${(fst.totalPopulation/1e6).toFixed(1)}M, Cases ${fst.totalCases.toLocaleString()}, Screening ${fst.avgScreening}%, Budget ${fst.avgBudgetUtil}%, Drugs ${fst.avgDrugAvail}%, HR ${fst.avgHrFill}%
Filters: ${filterLabel}

DISTRICTS:
${districtCtx}

MONTHLY TRENDS (last 12):
${trendCtx}

DISEASES:
${diseaseCtx}

Return ONLY a JSON array with exactly 5 objects, each with these fields:
- title: slide title (string)
- insight: 2-3 sentence executive summary of the key finding (string)
- bullets: array of 3-4 action items or key points (array of strings)
- highlight_metric: the single most important number to highlight (string, e.g. "34.2%")
- highlight_label: what that number represents (string, e.g. "Avg Screening Rate")
- severity: "critical" | "warning" | "good" (string)

The 5 slides should cover:
1. Overall State Health Summary & Key Risks
2. District Performance Gaps (name specific worst performers with numbers)
3. Disease Burden Analysis (which diseases are growing fastest, cite specific %)
4. Screening & Early Detection (coverage gaps, specific districts failing)
5. Strategic Recommendations (concrete, actionable, tied to data)

Be specific. Cite actual numbers from the data. No generic statements.
Return ONLY the JSON array, no markdown, no backticks, no preamble.`;

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "You are a health data analyst. Return ONLY valid JSON. No markdown, no backticks, no explanation.", messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const rawText = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      
      // Parse JSON — handle potential markdown wrapping
      let slides;
      try {
        const clean = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        slides = JSON.parse(clean);
      } catch (e) {
        // Try extracting array from response
        const match = rawText.match(/\[[\s\S]*\]/);
        if (match) slides = JSON.parse(match[0]);
        else throw new Error("Could not parse AI response");
      }

      // Build charts for the presentation
      const monthlyChart = svgBar(ts.slice(-12).map(t => ({ l: t.label, v: t.cases })), { color: "#C2410C" });
      const scrChart = svgBar(ts.slice(-12).map(t => ({ l: t.label, v: Math.round(t.scrPct * 10) / 10 })), { color: "#059669" });
      const diseaseDonut = svgDonut(totDis.map(d => ({ l: d.disease, v: d.cases })));
      const distBars = svgHBar([...fdd].sort((a, b) => parseFloat(a.screeningRate) - parseFloat(b.screeningRate)).slice(0, 8).map(d => {
        const r = parseFloat(d.screeningRate);
        return { l: d.name, v: r, suffix: "%", color: r > 65 ? "#059669" : r > 45 ? "#D97706" : "#991B1B" };
      }));

      const sevColors = { critical: "#991B1B", warning: "#D97706", good: "#059669" };
      const sevBg = { critical: "#fef2f2", warning: "#fffbeb", good: "#f0fdf4" };
      const sevBorder = { critical: "#fecaca", warning: "#fde68a", good: "#bbf7d0" };

      const slideCharts = [monthlyChart, distBars, diseaseDonut, scrChart, ""];

      const slideHTML = slides.map((s, i) => {
        const sev = s.severity || "warning";
        const chart = slideCharts[i] || "";
        return `<div class="slide">
          <div class="slide-header">
            <div class="slide-tag" style="background:${sevBg[sev]};color:${sevColors[sev]};border:1px solid ${sevBorder[sev]}">${sev.toUpperCase()}</div>
            <div class="slide-num">${s.title}</div>
          </div>
          <div class="slide-body">
            <div class="two-col">
              <div>
                <div class="insight-box" style="border-left:3px solid ${sevColors[sev]}">${s.insight}</div>
                <div class="metric-highlight">
                  <div class="metric-val" style="color:${sevColors[sev]}">${s.highlight_metric}</div>
                  <div class="metric-label">${s.highlight_label}</div>
                </div>
                <div class="bullet-list">
                  ${s.bullets.map(b => `<div class="bullet-item"><span class="bullet-dot" style="background:${sevColors[sev]}"></span>${b}</div>`).join("")}
                </div>
              </div>
              <div class="chart-area">${chart}</div>
            </div>
          </div>
          <div class="slide-footer">NCD Analytics · AI-Generated Insights · ${nowStr} · Slide ${i+1}/5</div>
        </div>`;
      }).join("\n");

      openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI Insights — ${filterLabel}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1f2937}
        .cover{width:100%;max-width:900px;min-height:540px;margin:20px auto;background:linear-gradient(135deg,#1a1a1a 0%,#C2410C 100%);border-radius:12px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;page-break-after:always;text-align:center;padding:60px}
        .cover h1{font-size:36px;font-weight:800;margin-bottom:12px}
        .cover .sub{font-size:16px;opacity:0.8;margin-bottom:32px}
        .cover .meta{font-size:12px;opacity:0.6}
        .cover .ai-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:6px 16px;font-size:11px;font-weight:700;margin-bottom:24px;display:inline-block}
        .slide{width:100%;max-width:900px;min-height:500px;margin:20px auto;background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:visible;page-break-after:always;display:flex;flex-direction:column}
        .slide-header{padding:28px 40px 0}
        .slide-tag{display:inline-block;padding:3px 12px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:0.05em;margin-bottom:8px}
        .slide-num{font-size:24px;font-weight:800;color:#1f2937;line-height:1.3}
        .slide-body{flex:1;padding:20px 40px 16px}
        .slide-footer{padding:12px 40px;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
        .insight-box{background:#f8fafc;padding:14px 18px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.7;color:#334155;margin-bottom:16px}
        .metric-highlight{text-align:center;padding:16px;background:#f8fafc;border-radius:10px;margin-bottom:16px}
        .metric-val{font-size:36px;font-weight:800}
        .metric-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px}
        .bullet-list{display:flex;flex-direction:column;gap:8px}
        .bullet-item{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.6;color:#475569}
        .bullet-dot{width:6px;height:6px;border-radius:50%;margin-top:6px;flex-shrink:0}
        .chart-area{display:flex;align-items:center;justify-content:center}
        @media print{body{background:white;padding:0}.slide{box-shadow:none;margin:0;border-radius:0}svg{max-width:100%!important}}
      </style></head><body>
      <div class="cover">
        <div class="ai-badge">AI-GENERATED INSIGHTS</div>
        <h1>NCD Surveillance Analysis</h1>
        <div class="sub">State Health Department — Chhattisgarh</div>
        <div class="meta">${filterLabel} · Generated ${nowStr}<br>Powered by AI Analytics Engine</div>
      </div>
      ${slideHTML}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    } catch (e) {
      console.error("AI export error:", e);
      alert("AI Insights generation failed: " + e.message + "\nMake sure your AI chat API is configured.");
    }
    setAiExporting(false);
  };

  return <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    {aiExporting && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: P.surface, borderRadius: 16, padding: "32px 40px", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>{[0,1,2].map(j => <div key={j} style={{ width: 8, height: 8, borderRadius: "50%", background: P.accent, animation: `pulse 1.2s ease ${j*0.2}s infinite` }} />)}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: P.text }}>Generating AI Insights...</div>
        <div style={{ fontSize: 12, color: P.textDim, marginTop: 6 }}>Analyzing data and creating presentation</div>
      </div>
    </div>}
    {/* ── Compare Modal ── */}
    {showCompare && <div className="ncd-cmp-modal" onClick={e => { if (e.target === e.currentTarget) setShowCompare(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflow: "auto" }}>
      <div className="ncd-cmp-box" style={{ background: P.surface, borderRadius: 14, width: "100%", maxWidth: 860, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div className="ncd-cmp-head" style={{ padding: "16px 24px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: P.text }}>Compare districts</div>
          <button onClick={() => setShowCompare(false)} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 6, padding: "5px 14px", color: P.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans'" }}>Close</button>
        </div>
        {/* District picker */}
        <div className="ncd-cmp-picker" style={{ padding: "12px 24px", borderBottom: `1px solid ${P.border}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <select value="" onChange={e => { addCompareDistrict(e.target.value); e.target.value = ""; }} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 8, padding: "6px 12px", color: P.text, fontSize: 12, fontFamily: "'DM Sans'", outline: "none", cursor: "pointer" }}>
            <option value="">Add district...</option>
            {fdd.filter(d => !compareDistricts.includes(d.name)).map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          {compareDistricts.map((name, i) => <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 8px", borderRadius: 16, background: `${COMPARE_COLORS[i]}12`, border: `1px solid ${COMPARE_COLORS[i]}30`, fontSize: 12, fontWeight: 600, color: P.text }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COMPARE_COLORS[i] }} />
            {name}
            <span onClick={() => removeCompareDistrict(name)} style={{ cursor: "pointer", color: P.textDim, fontSize: 11 }}>✕</span>
          </span>)}
          {compareDistricts.length < 2 && <span style={{ fontSize: 11, color: P.textDim }}>Select at least 2 districts</span>}
        </div>
        {/* Content */}
        <div className="ncd-cmp-body" style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {compareData.length >= 2 ? <>
            {/* Side by side cards */}
            <div className="ncd-cmp-cards" style={{ display: "grid", gridTemplateColumns: `repeat(${compareData.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
              {compareData.map((d, i) => {
                const scr = parseFloat(d.screeningRate), drug = parseFloat(d.drugAvailability), bud = d.budgetUtilized * 100, hr = d.hrFilled * 100;
                const scrC = scr > 65 ? P.green : scr > 45 ? P.amber : P.red;
                const drugC = drug > 60 ? P.green : drug > 40 ? P.amber : P.red;
                const budC = bud > 65 ? P.green : bud > 45 ? P.amber : P.red;
                const hrC = hr > 65 ? P.green : hr > 50 ? P.amber : P.red;
                const barRow = (label, val, color) => <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.textDim, marginBottom: 4 }}><span>{label}</span><span style={{ fontWeight: 700, color }}>{val.toFixed(1)}%</span></div>
                  <div style={{ height: 6, background: P.border, borderRadius: 3 }}><div style={{ height: 6, borderRadius: 3, background: color, width: `${Math.min(val, 100)}%` }} /></div>
                </div>;
                return <div key={d.name} style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 10, padding: 16, borderTop: `3px solid ${COMPARE_COLORS[i]}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 4 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: P.textDim, marginBottom: 14 }}>{d.zone} · Pop {(d.population / 1e5).toFixed(1)}L · {d.totalCases.toLocaleString()} cases</div>
                  {barRow("Screening", scr, scrC)}
                  {barRow("Drug availability", drug, drugC)}
                  {barRow("Budget utilization", bud, budC)}
                  {barRow("HR fill rate", hr, hrC)}
                </div>;
              })}
            </div>
            {/* Disease comparison table */}
            <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 10 }}>Disease breakdown</div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 400, borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: P.textDim, borderBottom: `1px solid ${P.border}` }}>Disease</th>
                  {compareData.map((d, i) => <th key={d.name} style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, textTransform: "uppercase", color: COMPARE_COLORS[i], borderBottom: `1px solid ${P.border}`, fontWeight: 700 }}>{d.name}</th>)}
                  {compareData.length === 2 && <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, textTransform: "uppercase", color: P.textDim, borderBottom: `1px solid ${P.border}` }}>Diff</th>}
                </tr></thead>
                <tbody>{DISEASES.map(dis => {
                  const vals = compareData.map(d => d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0);
                  const diff = compareData.length === 2 ? vals[0] - vals[1] : null;
                  const maxVal = Math.max(...vals);
                  return <tr key={dis}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: P.textMuted, borderBottom: `1px solid ${P.border}` }}>{dis}</td>
                    {vals.map((v, i) => <td key={i} style={{ padding: "8px 12px", textAlign: "right", fontWeight: v === maxVal ? 700 : 400, color: v === maxVal ? P.text : P.textMuted, borderBottom: `1px solid ${P.border}` }}>{v.toLocaleString()}</td>)}
                    {diff !== null && <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: diff > 0 ? P.red : diff < 0 ? P.green : P.textDim, borderBottom: `1px solid ${P.border}` }}>{diff > 0 ? "+" : ""}{diff.toLocaleString()}</td>}
                  </tr>;
                })}</tbody>
              </table>
            </div>
            {/* Screening comparison detail */}
            <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginTop: 20, marginBottom: 10 }}>Screening detail</div>
            <div className="ncd-cmp-scr" style={{ display: "grid", gridTemplateColumns: `repeat(${compareData.length}, 1fr)`, gap: 12 }}>
              {compareData.map((d, i) => <div key={d.name} style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COMPARE_COLORS[i], marginBottom: 8 }}>{d.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.textDim, marginBottom: 4 }}><span>Target</span><span style={{ color: P.text, fontWeight: 600 }}>{(d.screeningTarget / 1000).toFixed(0)}k</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.textDim, marginBottom: 4 }}><span>Achieved</span><span style={{ color: P.text, fontWeight: 600 }}>{(d.screeningAchieved / 1000).toFixed(0)}k</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.textDim }}><span>Gap</span><span style={{ color: P.red, fontWeight: 600 }}>{((d.screeningTarget - d.screeningAchieved) / 1000).toFixed(0)}k</span></div>
              </div>)}
            </div>
          </> : <div style={{ textAlign: "center", color: P.textDim, padding: 40 }}>Select at least 2 districts to compare</div>}
        </div>
      </div>
    </div>}
    <div style={{ display: "flex", borderBottom: `1px solid ${P.border}`, background: P.surface, alignItems: "center" }}>
      <div className="ncd-tab-scroll" style={{ display: "flex", gap: 2, padding: "0 0 0 28px", overflowX: "auto", WebkitOverflowScrolling: "touch", flex: 1, minWidth: 0 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className="ncd-tab-btn" style={{ padding: "12px 16px", background: "none", border: "none", color: tab === t.id ? P.accent : P.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${P.accent}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap", fontFamily: "'DM Sans'" }}>{t.l}</button>)}
      </div>
      <div style={{ padding: "0 12px", display: "flex", gap: 6, position: "relative", zIndex: 200, flexShrink: 0 }}>
        <button className="ncd-action-btn" onClick={() => { setShowCompare(true); if (compareDistricts.length === 0 && fdd.length >= 2) setCompareDistricts([fdd[0].name, fdd[1].name]); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 8, color: P.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'", whiteSpace: "nowrap" }}>
          <I.Activity /> <span className="ncd-btn-label">Compare</span>
        </button>
        <button className="ncd-action-btn" onClick={() => setShowExportMenu(!showExportMenu)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 8, color: P.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'", whiteSpace: "nowrap" }}>
          <I.Download /> <span className="ncd-btn-label">Export ▾</span>
        </button>
        {showExportMenu && <div className="ncd-export-menu" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 200, overflow: "hidden" }}>
          <button onClick={() => { exportSummary(); setShowExportMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: P.text, fontFamily: "'DM Sans'", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = P.surfaceAlt} onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <I.Report /> Summary Report
            <span style={{ fontSize: 10, color: P.textDim, marginLeft: "auto" }}>Tables</span>
          </button>
          <div style={{ height: 1, background: P.border }} />
          <button onClick={() => { exportPresentation(); setShowExportMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: P.text, fontFamily: "'DM Sans'", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = P.surfaceAlt} onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <I.Eye /> Charts
            <span style={{ fontSize: 10, color: P.textDim, marginLeft: "auto" }}>Illustrations</span>
          </button>
          <div style={{ height: 1, background: P.border }} />
          <button onClick={exportAIInsights} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: P.text, fontFamily: "'DM Sans'", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = P.surfaceAlt} onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <I.Bot /> AI Insights
            <span style={{ fontSize: 10, color: P.accent, marginLeft: "auto", fontWeight: 700 }}>PPT</span>
          </button>
        </div>}
      </div>
    </div>
    <div className="ncd-reports-pad" style={{ flex: 1, overflow: "auto", padding: 28 }}>

      {/* Dashboard */}
      {tab === "dashboard" && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>State Dashboard</div>
        {fb}
        <div className="ncd-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
          <KPI icon={I.Activity} label="Total Cases" value={fst.totalCases.toLocaleString()} sub={`Pop: ${(fst.totalPopulation / 1e6).toFixed(1)}M`} color={P.accent} />
          <KPI icon={I.Target} label="Screening" value={`${fst.avgScreening}%`} sub={`Target: ${BENCHMARKS.screening.target}% · Nat: ${BENCHMARKS.screening.national_avg}%`} color={parseFloat(fst.avgScreening) >= BENCHMARKS.screening.target ? P.green : parseFloat(fst.avgScreening) >= BENCHMARKS.screening.national_avg ? P.amber : P.red} />
          <KPI icon={I.Wallet} label="Budget Util." value={`${fst.avgBudgetUtil}%`} sub={`Target: ${BENCHMARKS.budget_utilization.target}% · Nat: ${BENCHMARKS.budget_utilization.national_avg}%`} color={parseFloat(fst.avgBudgetUtil) >= BENCHMARKS.budget_utilization.target ? P.green : parseFloat(fst.avgBudgetUtil) >= BENCHMARKS.budget_utilization.national_avg ? P.amber : P.red} />
          <KPI icon={I.Pill} label="Drug Avail." value={`${fst.avgDrugAvail}%`} sub={`Target: ${BENCHMARKS.drug_availability.target}% · Nat: ${BENCHMARKS.drug_availability.national_avg}%`} color={parseFloat(fst.avgDrugAvail) >= BENCHMARKS.drug_availability.target ? P.green : parseFloat(fst.avgDrugAvail) >= BENCHMARKS.drug_availability.national_avg ? P.amber : P.red} />
          <KPI icon={I.Users} label="HR Filled" value={`${fst.avgHrFill}%`} sub={`Target: ${BENCHMARKS.hr_fill.target}% · Nat: ${BENCHMARKS.hr_fill.national_avg}%`} color={parseFloat(fst.avgHrFill) >= BENCHMARKS.hr_fill.target ? P.green : parseFloat(fst.avgHrFill) >= BENCHMARKS.hr_fill.national_avg ? P.amber : P.red} />
        </div>
        <div className="ncd-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}><div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>Disease Distribution</div><Donut data={totDis} /></div>
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22, overflow: "hidden" }}><div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>Monthly Registrations</div><BarChart data={ts.map(t => ({ m: t.label, c: t.cases }))} lk="m" vk="c" h={180} /></div>
        </div>
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>District Performance</div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}><table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["District","Cases","Screening","Drugs","Budget"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: h === "District" ? "left" : "right", color: P.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${P.border}` }}>{h}</th>)}</tr></thead>
            <tbody>{fdd.map(d => <tr key={d.id} onClick={() => setSel(d.id)} style={{ cursor: "pointer", background: sel === d.id ? P.accentGlow : "transparent" }} onMouseEnter={e => { if (sel !== d.id) e.currentTarget.style.background = P.surfaceAlt; }} onMouseLeave={e => { if (sel !== d.id) e.currentTarget.style.background = "transparent"; }}>
              <td style={{ padding: "11px 14px", fontWeight: 600, color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.name}</td>
              <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, color: P.text, borderBottom: `1px solid ${P.border}` }}>{d.totalCases.toLocaleString()}</td>
              <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${P.border}` }}><div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}><Bar value={parseFloat(d.screeningRate)} color={parseFloat(d.screeningRate) > 65 ? P.green : parseFloat(d.screeningRate) > 45 ? P.amber : P.red} /><span style={{ color: P.text, minWidth: 36 }}>{d.screeningRate}%</span></div></td>
              <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${P.border}`, color: parseFloat(d.drugAvailability) > 75 ? P.green : parseFloat(d.drugAvailability) > 55 ? P.amber : P.red, fontWeight: 600 }}>{d.drugAvailability}%</td>
              <td style={{ padding: "11px 14px", textAlign: "right", borderBottom: `1px solid ${P.border}`, color: d.budgetUtilized > 0.75 ? P.green : d.budgetUtilized > 0.55 ? P.amber : P.red, fontWeight: 600 }}>{(d.budgetUtilized * 100).toFixed(1)}%</td>
            </tr>)}</tbody>
          </table></div>
        </div>
        {s && <div style={{ background: P.surface, border: `1px solid ${P.accent}40`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}><div><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>{s.name}</div><div style={{ fontSize: 12, color: P.textDim }}>{s.zone} Zone</div></div><button onClick={() => setSel(null)} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 6, padding: "6px 14px", color: P.textMuted, fontSize: 12, cursor: "pointer" }}>Close</button></div>
          <div className="ncd-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>{s.diseaseBreakdown.map(d => <div key={d.disease} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: DC[d.disease] }} /><span style={{ fontSize: 12, color: P.textMuted, flex: 1 }}>{d.disease}</span><span style={{ fontSize: 12, color: P.text, fontWeight: 600 }}>{d.cases.toLocaleString()}</span></div>)}</div>
            <div style={{ overflowX: "auto" }}> <div style={{ minWidth: 600 }}> <BarChart data={getDiseaseMonthlyData(rawRows, s.name, dateFrom, dateTo)} lk="label" vk="cases"/> </div> </div> {/* Fix here for bar */}
          </div>
        </div>}
      </div>}

      {/* Heatmap */}
      {tab === "heatmap" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fb}
        <div className="ncd-heatmap-scroll"><Heatmap dd={fdd} /></div>
      </div>}

      {/* Benchmarks */}
      {tab === "benchmarks" && (() => {
        const stateScr = parseFloat(fst.avgScreening), stateDrug = parseFloat(fst.avgDrugAvail), stateBud = parseFloat(fst.avgBudgetUtil), stateHr = parseFloat(fst.avgHrFill);
        const stateComps = BENCHMARKS.state_comparisons.map(s => s.state === "Chhattisgarh" ? { ...s, screening: stateScr, drug: stateDrug, budget: stateBud, hr: stateHr } : s);
        const gapColor = (val, target) => val >= target ? P.green : val >= target * 0.7 ? P.amber : P.red;
        const gapLabel = (val, target) => val >= target ? "On track" : val >= target * 0.7 ? "Below target" : "Critical gap";
        const metrics = [
          { key: "screening", label: "Screening Coverage", val: stateScr, bm: BENCHMARKS.screening },
          { key: "drug", label: "Drug Availability", val: stateDrug, bm: BENCHMARKS.drug_availability },
          { key: "budget", label: "Budget Utilization", val: stateBud, bm: BENCHMARKS.budget_utilization },
          { key: "hr", label: "HR Fill Rate", val: stateHr, bm: BENCHMARKS.hr_fill },
        ];
        return <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>NPCDCS Peer Benchmarking</div><div style={{ fontSize: 12, color: P.textDim, marginTop: 4 }}>Chhattisgarh vs national targets, peer states, and NPCDCS/WHO standards</div></div>
          {fb}
          {/* Gap cards */}
          <div className="ncd-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {metrics.map(m => {
              const gap = m.val - m.bm.target;
              const col = gapColor(m.val, m.bm.target);
              return <div key={m.key} className="ncd-bm-card" style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 18, borderLeft: `3px solid ${col}`, borderRadius: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{m.label}</div>
                  <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 12, background: `${col}15`, color: col, fontWeight: 700 }}>{gapLabel(m.val, m.bm.target)}</span>
                </div>
                <div className="ncd-bm-val-row" style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                  <span className="ncd-bm-val" style={{ fontSize: 28, fontWeight: 800, color: col }}>{m.val.toFixed(1)}%</span>
                  <span style={{ fontSize: 12, color: P.textDim }}>vs target <b style={{ color: P.text }}>{m.bm.target}%</b></span>
                  <span style={{ fontSize: 12, color: gap >= 0 ? P.green : P.red, fontWeight: 700 }}>{gap >= 0 ? "+" : ""}{gap.toFixed(1)}pp</span>
                </div>
                <div style={{ height: 8, background: P.border, borderRadius: 4, position: "relative", marginBottom: 8 }}>
                  <div style={{ height: 8, borderRadius: 4, background: col, width: `${Math.min(m.val, 100)}%` }} />
                  <div style={{ position: "absolute", left: `${m.bm.target}%`, top: -3, width: 2, height: 14, background: P.text, borderRadius: 1 }} />
                  <div style={{ position: "absolute", left: `${m.bm.national_avg}%`, top: -2, width: 1, height: 12, background: P.textDim, borderRadius: 1, borderStyle: "dashed" }} />
                </div>
                <div className="ncd-bm-source" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: P.textDim, flexWrap: "wrap", gap: 2 }}>
                  <span>National avg: {m.bm.national_avg}%</span>
                  <span>{m.bm.source}</span>
                </div>
              </div>;
            })}
          </div>
          {/* State comparison table */}
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 4 }}>Peer state comparison</div>
            <div style={{ fontSize: 11, color: P.textDim, marginBottom: 14 }}>Source: NHM State Health Profiles, NRHM HMIS</div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{["State", "Screening %", "Drug Avail %", "Budget Util %", "HR Fill %"].map((h, i) => <th key={h} style={{ padding: "10px 14px", textAlign: i === 0 ? "left" : "right", color: P.textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${P.border}` }}>{h}</th>)}</tr></thead>
                <tbody>{stateComps.map((s, si) => {
                  const isCG = s.state === "Chhattisgarh";
                  const isNat = s.state === "National Avg";
                  const rowBg = isCG ? P.accentGlow : "transparent";
                  const cellStyle = (val, bmKey) => {
                    const target = BENCHMARKS[bmKey]?.target || 65;
                    const color = val >= target ? P.green : val >= target * 0.7 ? P.amber : P.red;
                    return { padding: "10px 14px", textAlign: "right", fontWeight: isCG || isNat ? 700 : 400, color: isCG ? color : isNat ? P.text : P.textMuted, borderBottom: `1px solid ${P.border}` };
                  };
                  return <tr key={s.state} style={{ background: rowBg }}>
                    <td style={{ padding: "10px 14px", fontWeight: isCG || isNat ? 700 : 500, color: isCG ? P.accent : isNat ? P.text : P.text, borderBottom: `1px solid ${P.border}` }}>{s.state}{isCG ? " ★" : ""}</td>
                    <td style={cellStyle(s.screening, "screening")}>{s.screening.toFixed(1)}%</td>
                    <td style={cellStyle(s.drug, "drug_availability")}>{s.drug.toFixed(1)}%</td>
                    <td style={cellStyle(s.budget, "budget_utilization")}>{s.budget.toFixed(1)}%</td>
                    <td style={cellStyle(s.hr, "hr_fill")}>{s.hr.toFixed(1)}%</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
          {/* Disease prevalence vs national */}
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 4 }}>Disease prevalence vs national estimates</div>
            <div style={{ fontSize: 11, color: P.textDim, marginBottom: 14 }}>State prevalence calculated from data; national from ICMR/NFHS/GBD studies</div>
            <div className="ncd-2col ncd-bm-disease" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {DISEASES.map(dis => {
                const stateCases = fdd.reduce((s, d) => s + (d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0), 0);
                const statePrev = fst.totalPopulation > 0 ? (stateCases / fst.totalPopulation * 100000).toFixed(0) : 0;
                const natPrev = BENCHMARKS.prevalence[dis]?.rate_per_lakh || 0;
                const ratio = natPrev > 0 ? (statePrev / natPrev * 100).toFixed(0) : "—";
                const trend = BENCHMARKS.prevalence[dis]?.trend || "stable";
                const trendCol = trend === "rising" ? P.red : P.green;
                return <div key={dis} style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: DC[dis] }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: P.text }}>{dis}</span>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${trendCol}15`, color: trendCol, fontWeight: 600 }}>{trend}</span>
                    </div>
                    <div style={{ fontSize: 11, color: P.textDim }}>{BENCHMARKS.prevalence[dis]?.label}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: P.textDim }}>State: <b style={{ color: P.text }}>{Number(statePrev).toLocaleString()}</b>/L</div>
                    <div style={{ fontSize: 11, color: P.textDim }}>National: <b style={{ color: P.text }}>{natPrev.toLocaleString()}</b>/L</div>
                    <div style={{ fontSize: 10, color: Number(ratio) > 100 ? P.red : P.green, fontWeight: 700 }}>{ratio}% of national</div>
                  </div>
                </div>;
              })}
            </div>
          </div>
        </div>;
      })()}

      {/* Screening */}
      {tab === "screening" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Screening Coverage</div>
        {fb}
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>Screening Rate Trend</div>
          <BarChart data={ts.map(t => ({ m: t.label, c: Math.round(t.scrPct * 10) / 10 }))} lk="m" vk="c" color={P.green} h={180} />
          <div style={{ fontSize: 10, color: P.textDim, marginTop: 8, textAlign: "center" }}>Monthly screening achievement rate (%)</div>
        </div>
        <div className="ncd-screening-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>{[...fdd].sort((a, b) => parseFloat(a.screeningRate) - parseFloat(b.screeningRate)).map(d => { const r = parseFloat(d.screeningRate); const c = r > 65 ? P.green : r > 45 ? P.amber : P.red; return <div key={d.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{d.name}</span><span style={{ fontSize: 22, fontWeight: 800, color: c }}>{d.screeningRate}%</span></div><Bar value={r} color={c} h={8} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: P.textDim }}><span>Target: {(d.screeningTarget / 1000).toFixed(0)}k</span><span>Done: {(d.screeningAchieved / 1000).toFixed(0)}k</span></div></div>; })}</div>
      </div>}

      {/* Disease Trends — with district filter */}
      {tab === "disease" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Disease Trends</div>
        {fb}
        <div className="ncd-disease-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{DISEASES.map(dis => { const disTs = ts.map(t => ({ m: t.label, c: t.diseases[dis] || 0 })); const t = fdd.reduce((sum, d) => sum + (d.diseaseBreakdown.find(x => x.disease === dis)?.cases || 0), 0); return <div key={dis} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 20, overflow: "hidden" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: DC[dis] }} /><span style={{ fontSize: 15, fontWeight: 700, color: P.text }}>{dis}</span></div><span style={{ fontSize: 18, fontWeight: 800, color: P.text }}>{t.toLocaleString()}</span></div><BarChart data={disTs} lk="m" vk="c" color={DC[dis]} h={120} /></div>; })}</div>
      </div>}

      {/* Budget */}
      {tab === "budget" && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: P.text }}>Budget & Resources</div>
        {fb}
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 16 }}>Budget Utilization Trend</div>
          <BarChart data={ts.map(t => ({ m: t.label, c: Math.round(t.budPct * 10) / 10 }))} lk="m" vk="c" color="#3B82F6" h={180} />
          <div style={{ fontSize: 10, color: P.textDim, marginTop: 8, textAlign: "center" }}>Monthly budget utilization rate (%)</div>
        </div>
        <div className="ncd-budget-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{[...fdd].sort((a, b) => a.budgetUtilized - b.budgetUtilized).map(d => <div key={d.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: 18 }}><div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 14 }}>{d.name}</div>{[{ l: "Budget", v: d.budgetUtilized * 100, c: d.budgetUtilized > 0.75 ? P.green : d.budgetUtilized > 0.55 ? P.amber : P.red }, { l: "HR Fill", v: d.hrFilled * 100, c: "#3B82F6" }, { l: "Drugs", v: parseFloat(d.drugAvailability), c: "#F59E0B" }].map(m => <div key={m.l} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.textDim, marginBottom: 5 }}><span>{m.l}</span><span style={{ fontWeight: 700, color: P.text }}>{m.v.toFixed(0)}%</span></div><Bar value={m.v} color={m.c} h={7} /></div>)}</div>)}</div>
      </div>}

      {/* Alerts */}
      {tab === "alerts" && showAlerts && <Alerts dd={fdd} role={role} />}
    </div>
  </div>;
}

// ─── AI Chat ───
function Chat({ dd, st, rawRows }) {
  const WELCOME = "Welcome to the NCD Analytics AI Assistant. I have access to the complete NCD surveillance dataset for your state, including month-by-month breakdowns and year-over-year trends.\n\nHow may I help you today?";
  const [msgs, setMsgs] = useState([{ role: "assistant", content: WELCOME }]);
  const [inp, setInp] = useState(""); const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [tokenLog, setTokenLog] = useState([]);
  const [showTokenLog, setShowTokenLog] = useState(false);
  const endRef = useRef(null); const inpRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/chat/list_threads");
        const json = await res.json();
        if (json.threads) setThreads(json.threads);
      } catch (e) { console.error("Thread list error:", e); }
      setLoadingThreads(false);
    })();
  }, []);

  const refreshThreads = async () => {
    try {
      const res = await fetch("/api/chat/list_threads");
      const json = await res.json();
      if (json.threads) setThreads(json.threads);
    } catch (e) {}
  };

  const newThread = () => {
    setMsgs([{ role: "assistant", content: WELCOME }]);
    setActiveThread(null);
    setShowSidebar(false);
  };

  const loadThread = async (threadId) => {
    try {
      const res = await fetch(`/api/chat/thread?id=${threadId}`);
      const json = await res.json();
      if (json.messages?.length > 0) {
        setMsgs(json.messages.map(m => ({ role: m.role, content: m.content })));
      } else {
        setMsgs([{ role: "assistant", content: WELCOME }]);
      }
      setActiveThread(threadId);
    } catch (e) { console.error("Load thread error:", e); }
    setShowSidebar(false);
  };

  const saveMsg = async (threadId, role, content, title) => {
    try {
      await fetch("/api/chat/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", thread_id: threadId, role, content, title }),
      });
    } catch (e) { console.error("Save msg error:", e); }
  };

  const ensureThread = async (firstMsg) => {
    if (activeThread) return activeThread;
    try {
      const title = firstMsg.length > 50 ? firstMsg.slice(0, 50) + "..." : firstMsg;
      const res = await fetch("/api/chat/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title }),
      });
      const json = await res.json();
      if (json.thread?.id) {
        setActiveThread(json.thread.id);
        await refreshThreads();
        return json.thread.id;
      }
    } catch (e) { console.error("Create thread error:", e); }
    return null;
  };

  const buildContext = () => {
    let ctx = `STATE NCD DATA — Chhattisgarh\nPopulation: ${(st.totalPopulation/1e6).toFixed(1)}M | Total Cases: ${st.totalCases.toLocaleString()} | Avg Screening: ${st.avgScreening}% | Budget Util: ${st.avgBudgetUtil}% | Drug Avail: ${st.avgDrugAvail}% | HR Fill: ${st.avgHrFill}%\n\n`;
    ctx += "DISTRICT SUMMARIES:\n";
    dd.forEach(d => {
      ctx += `${d.name} (${d.zone} Zone, Pop ${(d.population/1e5).toFixed(1)}L): Cases=${d.totalCases.toLocaleString()}, Screening=${d.screeningRate}%, Drug=${d.drugAvailability}%, Budget=${(d.budgetUtilized*100).toFixed(0)}%, HR=${(d.hrFilled*100).toFixed(0)}%, Diseases=[${d.diseaseBreakdown.map(x => `${x.disease}:${x.cases}${x.trend ? '(trend:' + (x.trend>0?'+':'') + x.trend.toFixed(0) + '%)' : ''}`).join(', ')}]\n`;
    });
    const yoy = {};
    rawRows.forEach(r => {
      const yr = Number(r.year) || (r.month_date ? new Date(r.month_date).getFullYear() : null);
      if (!yr) return;
      const key = `${r.district_name}|${r.disease_type}`;
      if (!yoy[key]) yoy[key] = {};
      yoy[key][yr] = (yoy[key][yr] || 0) + (Number(r.cases) || 0);
    });
    ctx += "\nYEAR-OVER-YEAR DISEASE TRENDS:\n";
    Object.entries(yoy).forEach(([key, years]) => {
      const sy = Object.keys(years).sort();
      if (sy.length >= 2) {
        const [dist, dis] = key.split("|");
        const vals = sy.map(y => `${y}:${years[y]}`).join(", ");
        const l = Number(sy[sy.length - 1]), p = Number(sy[sy.length - 2]);
        const pct = years[p] > 0 ? (((years[l] - years[p]) / years[p]) * 100).toFixed(0) : "N/A";
        ctx += `${dist} ${dis}: ${vals} (change: ${pct}%)\n`;
      }
    });
    return ctx;
  };

  const send = useCallback(async () => {
    if (!inp.trim() || loading) return;
    const msg = inp.trim(); setInp("");
    const next = [...msgs, { role: "user", content: msg }]; setMsgs(next); setLoading(true);

    const threadId = await ensureThread(msg);
    if (threadId) {
      const isFirst = msgs.filter(m => m.role === "user").length === 0;
      await saveMsg(threadId, "user", msg, isFirst ? (msg.length > 50 ? msg.slice(0, 50) + "..." : msg) : null);
    }

    try {
      const ctx = buildContext();
      const apiMsgs = next.filter((m, i) => !(i === 0 && m.role === "assistant")).slice(-10);
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are an expert NCD analytics AI assistant for Chhattisgarh state health officials.\n\nDATASET:\n${ctx}\n\nNATIONAL BENCHMARKS (NPCDCS/NHM/WHO):\nScreening target: ${BENCHMARKS.screening.target}% (national avg: ${BENCHMARKS.screening.national_avg}%) — ${BENCHMARKS.screening.source}\nDrug availability target: ${BENCHMARKS.drug_availability.target}% (national avg: ${BENCHMARKS.drug_availability.national_avg}%) — ${BENCHMARKS.drug_availability.source}\nBudget utilization target: ${BENCHMARKS.budget_utilization.target}% (national avg: ${BENCHMARKS.budget_utilization.national_avg}%) — ${BENCHMARKS.budget_utilization.source}\nHR fill target: ${BENCHMARKS.hr_fill.target}% (national avg: ${BENCHMARKS.hr_fill.national_avg}%) — ${BENCHMARKS.hr_fill.source}\n\nPEER STATES: Madhya Pradesh (Scr:48.2%), Rajasthan (58.7%), Odisha (55.1%), Jharkhand (42.5%)\n\nDISEASE NATIONAL PREVALENCE (per lakh): Diabetes:7700, Hypertension:28900, CVD:5400, COPD:5500, Cancer:940, Stroke:1190\n\nAPPROACH:\n1. ALWAYS analyze data above first. Cite specific numbers.\n2. Compare metrics against NPCDCS targets and national averages. Say "X district is at Y% vs national target of Z%".\n3. When comparing, reference peer states: "Chhattisgarh screening at X% is below Rajasthan (58.7%) but above Jharkhand (42.5%)".\n4. For disease analysis, compare state prevalence against national ICMR/NFHS estimates.\n5. For interventions, reference WHO PEN Protocol, NPCDCS guidelines, IHCI for hypertension.\n6. Be concise but thorough. Bullet points for clarity.\n\nAUDIENCE: Senior government officials. Professional, actionable, data-driven. Always cite the benchmark source.`,
          messages: apiMsgs,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).filter(Boolean).join("\n") || "Could not process. Try again.";
      setMsgs(p => [...p, { role: "assistant", content: text }]);
      if (data.usage) {
        setTokenLog(prev => [...prev, {
          time: new Date().toISOString(),
          query: msg.length > 60 ? msg.slice(0, 60) + "..." : msg,
          input: data.usage.prompt_tokens || 0,
          output: data.usage.completion_tokens || 0,
          total: data.usage.total_tokens || 0,
          model: data.usage.model || "llama-3.3-70b",
        }]);
      }
      if (threadId) await saveMsg(threadId, "assistant", text);
    } catch (e) {
      console.error(e);
      const errMsg = "Unable to connect. Please try again.";
      setMsgs(p => [...p, { role: "assistant", content: errMsg }]);
      if (threadId) await saveMsg(threadId, "assistant", errMsg);
    }
    setLoading(false);
    await refreshThreads();
  }, [inp, loading, msgs, dd, st, rawRows, activeThread]);

  const sugg = ["What are the biggest gaps in Raipur?", "Why are diabetes cases increasing in Bastar?", "Compare screening across all zones", "Recommend interventions for low-performing districts"];
  const timeAgo = (d) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : "1d ago"; };

  return <div style={{ display: "flex", height: "100%", overflow: "hidden", width: "100%", position: "relative" }}>
    {showSidebar && <div className="ncd-sidebar-overlay" onClick={() => setShowSidebar(false)} style={{ display: "none", position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400 }} />}
    <div className={`ncd-sidebar${showSidebar ? " ncd-sidebar-open" : ""}`} style={{ width: showSidebar ? 280 : 0, minWidth: showSidebar ? 280 : 0, borderRight: showSidebar ? `1px solid ${P.border}` : "none", background: P.surface, display: "flex", flexDirection: "column", overflow: "hidden", transition: "all 0.2s" }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Chat History</span>
        <button onClick={newThread} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: P.accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'" }}>+ New</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {loadingThreads && <div style={{ padding: 20, textAlign: "center", color: P.textDim, fontSize: 12 }}>Loading...</div>}
        {!loadingThreads && threads.length === 0 && <div style={{ padding: 20, textAlign: "center", color: P.textDim, fontSize: 12 }}>No conversations yet</div>}
        {threads.map(t => (
          <button key={t.id} onClick={() => loadThread(t.id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: activeThread === t.id ? P.accentGlow : "transparent", marginBottom: 2, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: activeThread === t.id ? P.accent : P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{t.title || "Untitled"}</div>
            <div style={{ fontSize: 10, color: P.textDim }}>{timeAgo(t.updated_at)}</div>
          </button>
        ))}
      </div>
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${P.border}`, fontSize: 10, color: P.textDim, textAlign: "center" }}>Threads auto-delete after 24h</div>
    </div>

    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <div className="ncd-chat-top" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, background: P.surface }}>
        <button onClick={() => setShowSidebar(!showSidebar)} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: P.textMuted, display: "flex", alignItems: "center" }}><I.List /></button>
        <span style={{ fontSize: 13, fontWeight: 600, color: P.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeThread ? (threads.find(t => t.id === activeThread)?.title || "Conversation") : "New Conversation"}</span>
        {activeThread && <button onClick={newThread} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${P.border}`, background: "none", color: P.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>+ New Chat</button>}
      </div>
      <div className="ncd-chat-msgs" style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {msgs.map((m, i) => <div key={i} style={{ display: "flex", gap: 12, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
          {m.role === "assistant" && <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Bot /></div>}
          <div className="ncd-chat-bubble" style={{ maxWidth: "75%", padding: "14px 18px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? P.accent : P.surface, border: m.role === "user" ? "none" : `1px solid ${P.border}`, color: m.role === "user" ? "#fff" : P.text, fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{m.content}</div>
        </div>)}
        {loading && <div style={{ display: "flex", gap: 12 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Bot /></div><div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: "16px 16px 16px 4px", padding: "14px 20px", display: "flex", gap: 6 }}>{[0,1,2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: P.accent, animation: `pulse 1.2s ease ${j*0.2}s infinite` }} />)}</div></div>}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && <div className="ncd-chat-sugg" style={{ padding: "0 28px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>{sugg.map((q, i) => <button key={i} onClick={() => { setInp(q); setTimeout(() => inpRef.current?.focus(), 50); }} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 20, padding: "8px 16px", color: P.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans'" }} onMouseEnter={e => { e.target.style.borderColor = P.accent; e.target.style.color = P.accent; }} onMouseLeave={e => { e.target.style.borderColor = P.border; e.target.style.color = P.textMuted; }}>{q}</button>)}</div>}
      <div className="ncd-chat-input" style={{ padding: "16px 28px 24px", borderTop: `1px solid ${P.border}` }}>
        <div style={{ display: "flex", gap: 10, background: P.surface, border: `1px solid ${P.borderLight}`, borderRadius: 14, padding: "6px 8px 6px 18px" }}>
          <input ref={inpRef} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about NCD data, trends, or get recommendations..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: P.text, fontSize: 14, fontFamily: "'DM Sans'" }} />
          <button onClick={send} disabled={!inp.trim() || loading} style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: inp.trim() && !loading ? "pointer" : "default", background: inp.trim() && !loading ? P.accent : P.surfaceAlt, color: inp.trim() && !loading ? "#fff" : P.textDim, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Send /></button>
        </div>
        {tokenLog.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button onClick={() => setShowTokenLog(!showTokenLog)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: P.textDim, fontFamily: "'DM Sans'", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: P.green, display: "inline-block" }} />
            {tokenLog.reduce((s, l) => s + l.total, 0).toLocaleString()} tokens used · {tokenLog.length} request{tokenLog.length !== 1 ? "s" : ""} · <span style={{ textDecoration: "underline" }}>{showTokenLog ? "Hide" : "View"} log</span>
          </button>
        </div>}
      </div>
      {/* Token Usage Log Panel */}
      {showTokenLog && <div style={{ borderTop: `1px solid ${P.border}`, background: P.surface, maxHeight: 240, overflow: "auto" }}>
        <div style={{ padding: "10px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: P.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>LLM Token Usage Log</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: P.textDim }}>Total: <b style={{ color: P.accent }}>{tokenLog.reduce((s, l) => s + l.total, 0).toLocaleString()}</b> tokens</span>
            <button onClick={() => { setTokenLog([]); setShowTokenLog(false); }} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 9, color: P.textDim, cursor: "pointer", fontFamily: "'DM Sans'" }}>Clear</button>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead><tr>
            {["Time", "Query", "Input", "Output", "Total"].map(h => <th key={h} style={{ padding: "4px 12px", textAlign: h === "Query" ? "left" : "right", color: P.textDim, fontWeight: 600, fontSize: 9, textTransform: "uppercase", borderBottom: `1px solid ${P.border}` }}>{h}</th>)}
          </tr></thead>
          <tbody>{[...tokenLog].reverse().map((l, i) => <tr key={i} style={{ borderBottom: `1px solid ${P.border}` }}>
            <td style={{ padding: "6px 12px", color: P.textDim, whiteSpace: "nowrap", textAlign: "right" }}>{new Date(l.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
            <td style={{ padding: "6px 12px", color: P.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.query}</td>
            <td style={{ padding: "6px 12px", textAlign: "right", color: P.textMuted, fontWeight: 600 }}>{l.input.toLocaleString()}</td>
            <td style={{ padding: "6px 12px", textAlign: "right", color: P.textMuted, fontWeight: 600 }}>{l.output.toLocaleString()}</td>
            <td style={{ padding: "6px 12px", textAlign: "right", color: P.accent, fontWeight: 700 }}>{l.total.toLocaleString()}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  </div>;
}

// ─── Data Ingestion ───
function Ingest({ dd, rawRows, onUpdate, history, onHistory, role }) {
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const handle = (file) => { if (!file) return; const r = new FileReader(); r.onload = e => { const res = parseCSV(e.target.result); setResult(res); }; r.readAsText(file); };

const confirm = async () => {
  if (!result?.rows?.length) return;

  setImporting(true);

  try {
    // Send the raw parsed CSV rows directly — no re-expansion
    const payload = result.rows.map(r => ({
      district_name: r.district_name,
      month: r.month,
      year: r.year || YEAR,
      disease_type: r.disease_type,
      cases: r.cases,
      screening_target: r.screening_target,
      screening_achieved: r.screening_achieved,
      budget_allocated_lakhs: r.budget_allocated_lakhs,
      budget_utilized_lakhs: r.budget_utilized_lakhs,
      hr_sanctioned: r.hr_sanctioned,
      hr_in_position: r.hr_in_position,
      drug_availability_pct: r.drug_availability_pct,
    }));
    // RBAC: District Manager can only upload data for their assigned district
    if (role && !role.allDistricts) {
      const allowed = role.district.toLowerCase();
      const bad = payload.filter(r => r.district_name?.toLowerCase() !== allowed);
      if (bad.length > 0) {
        const badNames = [...new Set(bad.map(r => r.district_name))].join(", ");
        alert(`Upload blocked: You can only upload data for ${role.district}. Found: ${badNames}`);
        setImporting(false);
        return;
      }
    }
    const res = await fetch("/api/aggregate/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows: payload }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    onUpdate(result.data);
    onHistory({
      date: new Date().toISOString(),
      rows: payload.length,
      districts: result.districtCount,
      mode: "append",
    });
    alert(`Uploaded ${payload.length} rows`);
  } catch (e) {
    console.error(e);
    alert("Upload failed");
  }
  setImporting(false);
  setResult(null);
};

  const dlTemplate = () => { const b = new Blob([generateSampleCSV()], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "ncd_template.csv"; a.click(); };

  return <div className="ncd-ingest-pad" style={{ height: "100%", overflow: "auto", padding: 28 }}><div className="ncd-ingest-inner" style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
    <div><div style={{ fontSize: 20, fontWeight: 800, color: P.text }}>Data Ingestion Portal</div><div style={{ fontSize: 13, color: P.textDim, marginTop: 4 }}>Upload district-level NCD data via CSV. Data flows into reports and AI chat.</div></div>

    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.textDim, textTransform: "uppercase", marginBottom: 14 }}>Current Dataset</div>
      <div className="ncd-ingest-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.accent }}>{dd.length}</div><div style={{ fontSize: 11, color: P.textDim }}>Districts</div></div>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.text }}>{dd.reduce((s, d) => s + d.totalCases, 0).toLocaleString()}</div><div style={{ fontSize: 11, color: P.textDim }}>Total Cases</div></div>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.text }}>{DISEASES.length}</div><div style={{ fontSize: 11, color: P.textDim }}>Diseases</div></div>
        <div><div style={{ fontSize: 24, fontWeight: 800, color: P.text }}>{rawRows.length.toLocaleString()}</div><div style={{ fontSize: 11, color: P.textDim }}>Records</div></div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={dlTemplate} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, color: P.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}><I.Download /> Download CSV Template</button>
    </div>

    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.textDim, textTransform: "uppercase", marginBottom: 10 }}>CSV Schema (one row = district + month + disease)</div>
      <div className="ncd-ingest-schema" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
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
        <div className="ncd-ingest-parsed" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
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
          <button onClick={confirm} disabled={importing} style={{ padding: "10px 28px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'", background: `linear-gradient(135deg, ${P.accent}, #1a1a1a)`, color: "#fff", opacity: importing ? 0.6 : 1 }}>{importing ? "Importing..." : `Import ${result.rowCount.toLocaleString()} rows`}</button>
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

// ─── Health Worker Mobile Section ───
function HealthWorker() {
  const [view, setView] = useState("home");
  const [patients, setPatients] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [observations, setObservations] = useState([]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  const resetForm = () => setForm({});
  const showError = (msg) => { setError(msg); setTimeout(() => setError(null), 4000); };

  // ── Fetch ──
  const fetchAll = async () => {
    try {
      const [pRes, sRes, oRes] = await Promise.all([
        fetch("/api/patient/list"),
        fetch("/api/screening/list"),
        fetch("/api/observation/list"),
      ]);
      const pJson = await pRes.json();
      const sJson = await sRes.json();
      const oJson = await oRes.json();
      if (pJson.patients) setPatients(pJson.patients);
      if (sJson.screenings) setScreenings(sJson.screenings);
      if (oJson.observations) setObservations(oJson.observations);
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoadingData(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Helpers ──
  const pName = (id) => patients.find(p => p.id === id)?.name || "Unknown";
  const dName = (id) => DISTRICTS_META.find(d => d.id === id)?.name || "—";
  const pAge = (p) => p?.dob ? calculateAge(p.dob) : null;
  const obsFor = (sid) => observations.filter(o => o.screening_id === sid);
  

  // ── API helper — matches your working upload.js pattern ──
  const api = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let json = {};
    try {
      const text = await res.text();
      if (text) json = JSON.parse(text);
    } catch (e) { /* empty or non-JSON response */ }
    if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
    return json;
  };

  // ── Save Patient ──
  const savePatient = async () => {
    if (!form.name || !form.dob) return showError("Name and Date of Birth are required");
    setSaving(true);
    try {
      await api("/api/patient/create", {
        name: form.name,
        dob: form.dob,
        gender: form.gender || null,
        phone: form.phone || null,
        district_id: form.district_id ? parseInt(form.district_id) : null,
      });
    } catch (e) { showError(e.message); }
    await fetchAll();
    resetForm();
    setView("patients");
    setSaving(false);
  };

  // ── Save Screening ──
  const saveScreening = async () => {
    if (!form.patient_id) return showError("Select a patient");
    setSaving(true);
    try {
      const json = await api("/api/screening/create", {
        patient_id: form.patient_id,
        screening_date: form.screening_date || new Date().toISOString().split("T")[0],
      });
      await fetchAll();
      if (json.screening?.id) {
        setForm({ screening_id: json.screening.id });
        setView("addObs");
      } else {
        resetForm();
        setView("screenings");
      }
    } catch (e) {
      showError(e.message);
      await fetchAll();
      resetForm();
      setView("screenings");
    }
    setSaving(false);
  };

  // ── Save Observation ──
  const saveObs = async () => {
    if (!form.screening_id || !form.disease_type) return showError("Screening and Disease Type required");
    setSaving(true);
    const sid = form.screening_id;
    try {
      await api("/api/observation/create", {
        screening_id: sid,
        disease_type: form.disease_type,
        value: form.value || null,
        severity: form.severity || null,
      });
    } catch (e) { showError(e.message); }
    await fetchAll();
    setForm({ screening_id: sid });
    setSaving(false);
  };

  // ── Shared UI ──
  const iStyle = { background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 10, padding: "12px 14px", color: P.text, fontSize: 14, fontFamily: "'DM Sans'", outline: "none", width: "100%" };

  const F = (label, key, type = "text", opts) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>{label}</label>
      {opts
        ? <select value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ ...iStyle, cursor: "pointer" }}>
            <option value="">Select...</option>
            {opts.map(o => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}
          </select>
        : <input type={type} value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })} style={iStyle} />
      }
    </div>
  );

  const Hdr = ({ title }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${P.border}`, background: P.surface }}>
      <button onClick={() => { setView("home"); resetForm(); }} style={{ background: "none", border: "none", color: P.textMuted, cursor: "pointer", padding: 4 }}><I.Back /></button>
      <span style={{ fontSize: 17, fontWeight: 700, color: P.text }}>{title}</span>
    </div>
  );

  const Card = ({ top, mid, bottom, color, onClick }) => (
    <div onClick={onClick} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 16, borderLeft: `3px solid ${color || P.accent}`, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{top}</div>
      {mid && <div style={{ fontSize: 12, color: P.textMuted, marginTop: 4 }}>{mid}</div>}
      {bottom && <div style={{ fontSize: 11, color: P.textDim, marginTop: 6 }}>{bottom}</div>}
    </div>
  );

  const Btn = ({ onClick, label, g }) => (
    <button onClick={onClick} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${g})`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'", marginTop: 8, opacity: saving ? 0.6 : 1 }}>
      {saving ? "Saving..." : label}
    </button>
  );

  const sev = (s) => s === "Severe" ? P.red : s === "Moderate" ? P.amber : P.green;

  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center", background: P.bg }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", borderLeft: `1px solid ${P.border}`, borderRight: `1px solid ${P.border}`, height: "100%" }}>

        {error && <div style={{ margin: "12px 20px 0", padding: "10px 14px", background: "#EF444420", border: "1px solid #EF444440", borderRadius: 8, fontSize: 12, color: P.red, fontWeight: 600 }}>{error}</div>}

        {/* ── Home ── */}
        {view === "home" && <>
          <div style={{ padding: "20px 20px 12px", background: P.surface, borderBottom: `1px solid ${P.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${P.green}, ${P.accent})`, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Heart /></div>
              <div><div style={{ fontSize: 16, fontWeight: 800, color: P.text }}>Health Worker</div><div style={{ fontSize: 10, color: P.textDim, textTransform: "uppercase" }}>NCD Field App</div></div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {loadingData ? <div style={{ textAlign: "center", padding: 40, color: P.textDim }}>Loading...</div> : <>
              <div style={{ fontSize: 13, fontWeight: 600, color: P.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Actions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                {[
                  { l: "Add Patient", icon: I.Plus, color: P.accent, v: "addPatient" },
                  { l: "New Screening", icon: I.Target, color: P.green, v: "addScreening" },
                  { l: "My Patients", icon: I.Users, color: P.blue, v: "patients", count: patients.length },
                  { l: "Screenings", icon: I.List, color: P.amber, v: "screenings", count: screenings.length },
                ].map(a => (
                  <button key={a.v} onClick={() => { resetForm(); setView(a.v); }} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", position: "relative" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color }}><a.icon /></div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: P.text }}>{a.l}</span>
                    {a.count !== undefined && <span style={{ position: "absolute", top: 10, right: 12, background: a.color, color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10 }}>{a.count}</span>}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: P.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Records</div>
              <button onClick={() => setView("observations")} style={{ width: "100%", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><I.Eye /><span style={{ fontSize: 13, fontWeight: 600, color: P.text }}>All Observations</span></div>
                <span style={{ fontSize: 12, color: P.purple, fontWeight: 700 }}>{observations.length}</span>
              </button>
            </>}
          </div>
        </>}

        {/* ── Add Patient ── */}
        {view === "addPatient" && <>
          <Hdr title="Register Patient" />
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {F("Full Name *", "name")}
            {F("Date of Birth *", "dob", "date")}
            {form.dob && <div style={{ fontSize: 13, color: P.accent, fontWeight: 600, marginTop: -10, marginBottom: 16 }}>Age: {calculateAge(form.dob)} years</div>}
            {F("Gender", "gender", "text", GENDERS)}
            {F("District", "district_id", "text", DISTRICTS_META.map(d => ({ v: String(d.id), l: d.name })))}
            {F("Phone", "phone", "tel")}
            <Btn onClick={savePatient} label="Register Patient" g={`${P.accent}, #1a1a1a`} />
          </div>
        </>}

        {/* ── Add Screening ── */}
        {view === "addScreening" && <>
          <Hdr title="New Screening Visit" />
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            <div style={{ background: P.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: P.textMuted, lineHeight: 1.6 }}>
              Select a patient and date. After creating, you can add observations.
            </div>
            {F("Patient *", "patient_id", "text", patients.map(p => {
              const age = pAge(p);
              const abha = p["ABHA ID"];
              return { v: p.id, l: `${p.name}${age ? " · " + age + "y" : ""}${abha ? " · ABHA: " + abha : ""}` };
            }))}
            {F("Date", "screening_date", "date")}
            <Btn onClick={saveScreening} label="Create Screening" g={`${P.green}, ${P.accent}`} />
          </div>
        </>}

        {/* ── Add Observation ── */}
        {view === "addObs" && <>
          <Hdr title="Add Observation" />
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {form.screening_id && (() => {
              const scr = screenings.find(s => s.id === form.screening_id);
              const name = scr ? pName(scr.patient_id) : "—";
              const existing = obsFor(form.screening_id);
              return (
                <div style={{ background: P.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>Screening: {name}</div>
                  <div style={{ fontSize: 11, color: P.textDim, marginTop: 4 }}>Date: {scr?.screening_date || "—"} · {existing.length} observation{existing.length !== 1 ? "s" : ""}</div>
                  {existing.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {existing.map(o => <span key={o.id} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${DC[o.disease_type] || P.accent}25`, color: DC[o.disease_type] || P.accent, fontWeight: 600 }}>{o.disease_type}{o.severity ? " · " + o.severity : ""}</span>)}
                    </div>
                  )}
                </div>
              );
            })()}
            {!form.screening_id && F("Screening *", "screening_id", "text", screenings.map(s => {
              const date = s.screening_date || s.created_at?.split("T")[0] || "—";
              return { v: s.id, l: `${pName(s.patient_id)} — ${date}` };
            }))}
            {F("Disease Type *", "disease_type", "text", DISEASES)}
            {F("Value / Reading", "value")}
            {F("Severity", "severity", "text", SEVERITY)}
            <Btn onClick={saveObs} label="Save Observation" g={`${P.purple}, ${P.accent}`} />
            <button onClick={() => { resetForm(); setView("screenings"); }} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${P.border}`, background: "none", color: P.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'", marginTop: 10 }}>Done — Back to Screenings</button>
          </div>
        </>}

        {/* ── Patient List ── */}
        {view === "patients" && <>
          <Hdr title={`Patients (${patients.length})`} />
          <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {patients.map(p => {
              const age = pAge(p);
              const abha = p["ABHA ID"];
              return (
                <Card key={p.id}
                  top={`${p.name || "—"}${age ? " · " + age + "y" : ""}${p.gender ? " · " + p.gender.charAt(0) : ""}`}
                  mid={<span>
                    {dName(p.district_id)}
                    {p.phone ? " · " + p.phone : ""}
                    {abha ? <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: P.accentGlow, color: P.accent, fontSize: 10, fontWeight: 600 }}>ABHA: {abha}</span> : ""}
                  </span>}
                  bottom={`DOB: ${p.dob || "—"} · Registered: ${p.created_at?.split("T")[0] || "—"}`}
                  color={P.accent}
                  onClick={() => { setForm({ patient_id: p.id }); setView("addScreening"); }}
                />
              );
            })}
            {!patients.length && <div style={{ textAlign: "center", color: P.textDim, padding: 40 }}>No patients registered yet.</div>}
          </div>
        </>}

        {/* ── Screening List ── */}
        {view === "screenings" && <>
          <Hdr title={`Screenings (${screenings.length})`} />
          <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {screenings.map(s => {
              const date = s.screening_date || s.created_at?.split("T")[0] || "—";
              const obs = obsFor(s.id);
              return (
                <Card key={s.id}
                  top={pName(s.patient_id)}
                  mid={<div>
                    <div>Date: {date} · {obs.length} observation{obs.length !== 1 ? "s" : ""}</div>
                    {obs.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {obs.map(o => <span key={o.id} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: `${sev(o.severity)}20`, color: sev(o.severity), fontWeight: 600 }}>{o.disease_type}{o.value ? ": " + o.value : ""}{o.severity ? " · " + o.severity : ""}</span>)}
                      </div>
                    )}
                  </div>}
                  bottom={`ID: ${s.id.slice(0, 8)}...`}
                  color={obs.length > 0 ? P.green : P.amber}
                  onClick={() => { setForm({ screening_id: s.id }); setView("addObs"); }}
                />
              );
            })}
            {!screenings.length && <div style={{ textAlign: "center", color: P.textDim, padding: 40 }}>No screenings yet.</div>}
          </div>
        </>}

        {/* ── Observations List ── */}
        {view === "observations" && <>
          <Hdr title={`Observations (${observations.length})`} />
          <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {observations.map(o => {
              const scr = screenings.find(s => s.id === o.screening_id);
              const name = scr ? pName(scr.patient_id) : "—";
              return (
                <Card key={o.id}
                  top={`${name} — ${o.disease_type || "—"}`}
                  mid={<span>{o.value ? <><b style={{ color: P.text }}>{o.value}</b> · </> : ""}{o.severity && <span style={{ color: sev(o.severity), fontWeight: 700 }}>{o.severity}</span>}</span>}
                  bottom={`${o.created_at?.split("T")[0] || "—"} · Screening: ${o.screening_id?.slice(0, 8) || "—"}...`}
                  color={sev(o.severity)}
                />
              );
            })}
            {!observations.length && <div style={{ textAlign: "center", color: P.textDim, padding: 40 }}>No observations yet.</div>}
          </div>
        </>}

      </div>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [roleKey, setRoleKey] = useState("admin");
  const role = ROLES[roleKey];
  const [section, setSection] = useState(role.sections[0]);
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState([]);

  // When role changes, reset to first allowed section
  useEffect(() => {
    if (!ROLES[roleKey].sections.includes(section)) {
      setSection(ROLES[roleKey].sections[0]);
    }
  }, [roleKey]);

  // Fetch raw rows from API on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/aggregate/list");
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setRawRows(json.data);
        }
      } catch (e) {
        console.error("API fetch failed:", e);
      }
      try { const r = await window.storage.get("ncd-history"); if (r?.value) setHist(JSON.parse(r.value)); } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const refreshData = async () => {
    try {
      const res = await fetch("/api/aggregate/list");
      const json = await res.json();
      if (json.data) setRawRows(json.data);
    } catch (e) { console.error(e); }
  };

  // For district manager, filter raw rows to their district
  const visibleRows = role.allDistricts ? rawRows : rawRows.filter(r => r.district_name === role.district);
  const dd = aggregateRows(visibleRows, {}, visibleRows);
  const st = computeTotals(dd);
  const addHist = async (entry) => { const nh = [entry, ...hist].slice(0, 20); setHist(nh); try { await window.storage.set("ncd-history", JSON.stringify(nh)); } catch (e) {} };
  const time = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const allNav = [
    { id: "reports", icon: I.Report, l: "Reports" },
    { id: "chat", icon: I.Chat, l: "AI Assistant", badge: "AI" },
    { id: "ingest", icon: I.Upload, l: "Upload" },
    { id: "fieldwork", icon: I.Heart, l: "Field App" },
  ];
  const visibleNav = allNav.filter(n => role.sections.includes(n.id));
  const roleColors = { admin: P.accent, district_manager: P.purple, field_worker: P.green, analyst: P.blue };

  return <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: P.bg, color: P.text, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0}html,body{max-width:100vw;overflow-x:hidden}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${P.borderLight};border-radius:3px}@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}textarea{font-family:'DM Sans',sans-serif}select{font-family:'DM Sans',sans-serif}
@media(max-width:768px){
  .ncd-header-title{display:none!important}
  .ncd-header-date{display:none!important}
  .ncd-role-bar{padding:4px 12px!important;font-size:10px!important}
  .ncd-nav-label{display:none!important}
  .ncd-nav-btn{padding:12px 8px!important;gap:4px!important}
  .ncd-reports-pad{padding:14px!important}
  .ncd-kpi-grid{grid-template-columns:repeat(2,1fr)!important}
  .ncd-2col{grid-template-columns:1fr!important}
  .ncd-disease-grid{grid-template-columns:1fr!important}
  .ncd-budget-grid{grid-template-columns:1fr!important}
  .ncd-screening-grid{grid-template-columns:1fr!important}
  .ncd-tab-scroll{padding:0 4px 0 8px!important}
  .ncd-tab-btn{padding:10px 8px!important;font-size:10px!important}
  .ncd-action-btn{padding:6px 8px!important;font-size:10px!important}
  .ncd-action-btn span.ncd-btn-label{display:none!important}
  .ncd-export-menu{position:fixed!important;right:8px!important;top:auto!important}
  .ncd-bm-val-row{flex-wrap:wrap!important;gap:4px!important}
  .ncd-bm-val{font-size:22px!important}
  .ncd-bm-card{padding:14px!important}
  .ncd-bm-disease{grid-template-columns:1fr!important}
  .ncd-filter-bar{flex-direction:column!important;align-items:stretch!important;gap:8px!important}
  .ncd-filter-pills{flex-wrap:wrap!important}
  .ncd-filter-pill{padding:4px 8px!important;font-size:10px!important}
  .ncd-chat-msgs{padding:14px!important}
  .ncd-chat-input{padding:10px 14px 16px!important}
  .ncd-chat-sugg{padding:0 14px 10px!important}
  .ncd-chat-bubble{max-width:90%!important}
  .ncd-ingest-pad{padding:14px!important}
  .ncd-ingest-inner{gap:16px!important}
  .ncd-ingest-stats{grid-template-columns:repeat(2,1fr)!important}
  .ncd-ingest-schema{grid-template-columns:1fr!important}
  .ncd-ingest-parsed{grid-template-columns:1fr!important}
  .ncd-heatmap-scroll{overflow-x:auto!important}
  .ncd-sidebar{transition:transform 0.2s ease!important;position:absolute!important;left:0;top:0;bottom:0;z-index:500;box-shadow:4px 0 24px rgba(0,0,0,0.15);width:260px!important;min-width:260px!important;transform:translateX(-100%)}
  .ncd-sidebar-open{transform:translateX(0)!important}
  .ncd-sidebar-overlay{display:block!important}
  .ncd-main-content{overflow:auto!important}
  .ncd-table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
  .ncd-chat-top{padding:8px 12px!important}
  .ncd-chat-top span{font-size:11px!important}
  .ncd-cmp-modal{padding:20px 10px!important}
  .ncd-cmp-box{max-height:90vh!important}
  .ncd-cmp-head{padding:12px 16px!important}
  .ncd-cmp-picker{padding:10px 16px!important}
  .ncd-cmp-body{padding:16px!important}
  .ncd-cmp-cards{grid-template-columns:1fr!important}
  .ncd-cmp-scr{grid-template-columns:1fr!important}
  .ncd-header{padding:10px 12px!important}
  .ncd-header-logo{gap:8px!important}
  .ncd-role-select{font-size:11px!important;padding:4px 8px!important}
}`}</style>

    <header className="ncd-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: `1px solid ${P.border}`, background: P.surface }}>
      <div className="ncd-header-logo" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${P.accent}, #1a1a1a)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#fff", flexShrink: 0 }}>N</div>
        <div className="ncd-header-title"><div style={{ fontSize: 16, fontWeight: 800 }}>NCD Analytics</div><div style={{ fontSize: 10, color: P.textDim, textTransform: "uppercase", letterSpacing: "0.04em" }}>State Health Dept — AI Surveillance</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="ncd-header-date" style={{ fontSize: 11, color: P.textDim }}>{time}</span>
        <select value={roleKey} onChange={e => setRoleKey(e.target.value)} className="ncd-role-select" style={{ background: P.surfaceAlt, border: `1px solid ${roleColors[roleKey]}50`, borderRadius: 8, padding: "6px 12px", color: roleColors[roleKey], fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans'", outline: "none", cursor: "pointer" }}>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
    </header>

    <div style={{ display: "flex", borderBottom: `1px solid ${P.border}`, overflowX: "auto" }}>
      {visibleNav.map(s => <button key={s.id} onClick={() => setSection(s.id)} className="ncd-nav-btn" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 20px", background: section === s.id ? P.surface : "transparent", border: "none", borderBottom: section === s.id ? `2px solid ${P.accent}` : "2px solid transparent", color: section === s.id ? P.accent : P.textDim, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'", whiteSpace: "nowrap" }}><s.icon /> <span className="ncd-nav-label">{s.l}</span>{s.badge && <span style={{ fontSize: 9, background: P.accentGlow, color: P.accent, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{s.badge}</span>}</button>)}
    </div>

    <div className="ncd-role-bar" style={{ padding: "6px 24px", background: `${roleColors[roleKey]}10`, borderBottom: `1px solid ${roleColors[roleKey]}20`, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: roleColors[roleKey] }} />
      <span style={{ fontSize: 11, color: roleColors[roleKey], fontWeight: 600 }}>{role.label}</span>
      {!role.allDistricts && role.district && <span style={{ fontSize: 11, color: P.textDim }}>· Data restricted to {role.district}</span>}
    </div>

    <div className="ncd-main-content" style={{ flex: 1, overflow: "hidden" }}>
      {loading && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: P.textDim, fontSize: 14 }}>Loading data from server...</div>}
      {!loading && section === "reports" && <Reports rawRows={visibleRows} role={role} />}
      {!loading && section === "chat" && <Chat dd={dd} st={st} rawRows={visibleRows} />}
      {!loading && section === "ingest" && <Ingest dd={dd} rawRows={visibleRows} onUpdate={() => refreshData()} history={hist} onHistory={addHist} role={role} />}
      {!loading && section === "fieldwork" && <HealthWorker />}
    </div>
  </div>;
}
