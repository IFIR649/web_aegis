// js/pages/IAMineria.js  (upgrade: +histograma y acumulado hora)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const API_BASE = "/api";

const firebaseConfig = { databaseURL: "https://movil-40fec-default-rtdb.firebaseio.com/" };
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const medicionesRef = ref(db, "mediciones");

const $ = (sel) => document.querySelector(sel);
const log = (...a) => console.log("[IAMINERIA]", ...a);

function fmtNum(n) {
  try { return Number(n ?? 0).toLocaleString("es-MX"); } catch { return String(n ?? 0); }
}
function showCanvas(canvasId, loaderId) {
  const c = document.getElementById(canvasId);
  const l = document.getElementById(loaderId);
  if (l) l.style.display = "none";
  if (c) c.style.display = "block";
}
function makeOrUpdateChart(holder, ctx, type, data, options) {
  if (holder.current) holder.current.destroy();
  holder.current = new Chart(ctx, { type, data, options });
  return holder.current;
}

// Holders de charts
let chHora = { current: null };
let chHoraAcum = { current: null };
let chDia = { current: null };
let chTop = { current: null };
let chScatter = { current: null };
let chHist = { current: null };
let chAnom = { current: null };

// ----------- CARGA MINERÍA DEL BACKEND -------------
async function loadMineria() {
  try {
    log("fetch /mineria_cache …");
    const res = await fetch(`${API_BASE}/mineria_cache`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /mineria_cache -> ${res.status}`);
    const data = await res.json();
    log("minería cache OK", data?.resumen);

    // KPIs
    $("#kpi-registros").textContent    = fmtNum(data?.resumen?.n_registros ?? 0);
    $("#kpi-dispositivos").textContent = fmtNum(data?.resumen?.n_municipios ?? 0);
    $("#kpi-anomalias").textContent    = fmtNum(data?.resumen?.n_anomalias ?? 0);

    // ───────────────────────────────
    // 1) Consumo por HORA (barras)
    // ───────────────────────────────
    const ctxHora = $("#chartHora")?.getContext("2d");
    if (ctxHora && data?.consumo_hora) {
      const labels = Array.isArray(data.consumo_hora.labels) ? data.consumo_hora.labels : [];
      const vals   = Array.isArray(data.consumo_hora.data) ? data.consumo_hora.data.map(v => Number(v || 0)) : [];
      makeOrUpdateChart(
        chHora,
        ctxHora,
        "bar",
        {
          labels,
          datasets: [{
            label: "Consumo por hora",
            data: vals,
            backgroundColor: "rgba(37,99,235,0.77)",
            borderRadius: 8
          }]
        },
        { plugins:{legend:{display:false}}, scales:{x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}}} }
      );
      showCanvas("chartHora", "loaderHora");
    }

    // ────────────────────────────────────────────
    // 2) Consumo por HORA ACUMULADO (%) (línea)
    // ────────────────────────────────────────────
    const ctxHoraAcum = $("#chartHoraAcum")?.getContext("2d");
    if (ctxHoraAcum && data?.consumo_hora) {
      const labels = Array.isArray(data.consumo_hora.labels) ? data.consumo_hora.labels : [];
      const vals = (Array.isArray(data.consumo_hora.data) ? data.consumo_hora.data : []).map(v => Number(v || 0));
      const total = vals.reduce((a,b)=>a+b,0);
      const denom = total > 0 ? total : 1e-9;
      const acum = vals.reduce((acc, v, i) => {
        const prev = acc[i-1] ?? 0;
        acc.push(((v + prev) / denom) * 100);
        return acc;
      }, []);
      makeOrUpdateChart(
        chHoraAcum,
        ctxHoraAcum,
        "line",
        { labels,
          datasets: [{ label:"Acumulado %", data: acum, tension: .35, fill: false, borderWidth: 2 }] },
        { plugins:{legend:{display:false}},
          scales:{ x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}, title:{display:true, text:"%"}} } }
      );
      showCanvas("chartHoraAcum", "loaderHoraAcum");
    }

    // ───────────────────────────────
    // 3) Consumo por DÍA (barras)
    // ───────────────────────────────
    const ctxDia = $("#chartDia")?.getContext("2d");
    if (ctxDia && data?.consumo_dia) {
      const labels = Array.isArray(data.consumo_dia.labels) ? data.consumo_dia.labels : [];
      const vals   = Array.isArray(data.consumo_dia.data) ? data.consumo_dia.data.map(v => Number(v || 0)) : [];
      makeOrUpdateChart(
        chDia,
        ctxDia,
        "bar",
        {
          labels,
          datasets: [{
            label: "Consumo por día",
            data: vals,
            backgroundColor: "rgba(34,211,238,0.77)",
            borderRadius: 8
          }]
        },
        { plugins:{legend:{display:false}}, scales:{x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}}} }
      );
      showCanvas("chartDia", "loaderDia");
    }

    // ─────────────────────────────────────
    // 4) Top municipios (barras horizontales)
    // ─────────────────────────────────────
    const ctxTop = $("#chartTopDispositivos")?.getContext("2d");
    if (ctxTop && Array.isArray(data?.top_dispositivos)) {
      const labels = data.top_dispositivos.map(d => d.municipio);
      const vals   = data.top_dispositivos.map(d => Number(d.total || 0));
      makeOrUpdateChart(
        chTop,
        ctxTop,
        "bar",
        {
          labels,
          datasets: [{
            label: "Consumo por municipio",
            data: vals,
            backgroundColor: "rgba(99,102,241,0.85)",
            borderRadius: 8
          }]
        },
        { indexAxis: "x", plugins:{legend:{display:false}},
          scales:{ x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}} } }
      );
      showCanvas("chartTopDispositivos", "loaderTop");
    }

    // ───────────────────────────────
    // 5) Dispersión Consumo vs Costo
    // ───────────────────────────────
    const ctxSc = $("#chartConsumoCosto")?.getContext("2d");
    if (ctxSc && Array.isArray(data?.consumo_vs_costo)) {
      const points = data.consumo_vs_costo.map(p => ({ x: Number(p.x || 0), y: Number(p.y || 0) }));
      makeOrUpdateChart(
        chScatter,
        ctxSc,
        "scatter",
        { datasets: [{ label:"Consumo vs Costo", data: points }] },
        { plugins:{legend:{display:false}},
          scales:{
            x:{ title:{display:true,text:"Consumo (kWh)"}, ticks:{color:"#ccd6f6"} },
            y:{ title:{display:true,text:"Costo (MXN)"},   ticks:{color:"#ccd6f6"} }
          } }
      );
      showCanvas("chartConsumoCosto", "loaderScatter");
    }

    // ───────────────────────────────
    // 6) Histograma de consumo (muestra)
    // ───────────────────────────────
    const ctxHist = $("#chartHistConsumo")?.getContext("2d");
    if (ctxHist && Array.isArray(data?.consumo_vs_costo) && data.consumo_vs_costo.length) {
      const xs = data.consumo_vs_costo.map(p => Number(p.x || 0)).filter(Number.isFinite);
      xs.sort((a,b)=>a-b);
      const n = xs.length;
      const bins = Math.max(8, Math.min(40, Math.floor(Math.sqrt(n || 1))));
      const min = xs[0] ?? 0, max = xs[n-1] ?? 1;
      const span = Math.max(max - min, 1e-9);
      const step = span / bins;

      const edges = Array.from({length: bins}, (_,i)=> min + i*step);
      const counts = new Array(bins).fill(0);
      xs.forEach(v => {
        let k = Math.floor((v - min) / step);
        if (k >= bins) k = bins - 1;
        if (k < 0) k = 0;
        counts[k]++;
      });
      const labels = edges.map((e,i)=> `${(e).toFixed(1)} – ${(e+step).toFixed(1)}`);

      makeOrUpdateChart(
        chHist,
        ctxHist,
        "bar",
        { labels, datasets:[{ label: "Frecuencia", data: counts, backgroundColor:"rgba(56,189,248,0.8)", borderRadius:6 }] },
        { plugins:{legend:{display:false}}, scales:{x:{ticks:{color:"#ccd6f6", maxRotation:0, minRotation:0}}, y:{ticks:{color:"#ccd6f6"}}} }
      );
      showCanvas("chartHistConsumo", "loaderHist");
    }

    // ───────────────────────────────
    // 7) Anomalías (z-score en consumo)
    // ───────────────────────────────
    const zthr = Number(data?.resumen?.z_threshold ?? 3);
    const pts = (data?.consumo_vs_costo ?? []).slice(0, 800);
    const ys  = pts.map(p => Number(p.x || 0)).filter(Number.isFinite);
    const m = ys.length ? ys.reduce((a,b)=>a+b,0) / ys.length : 0;
    const s = ys.length > 1 ? Math.sqrt(ys.reduce((a,b)=>a + (b-m)*(b-m), 0) / ys.length) : 0;
    const denom = s || 1e-9;

    const normales = [], anom = [];
    ys.forEach((y, i) => {
      const z = Math.abs((y - m) / denom);
      (z >= zthr ? anom : normales).push({ x: i, y });
    });

    const ctxAn = $("#chartAnomalias")?.getContext("2d");
    if (ctxAn) {
      makeOrUpdateChart(
        chAnom,
        ctxAn,
        "scatter",
        {
          datasets: [
            { label: "Normal",  data: normales, pointRadius: 3 },
            { label: "Anómalo", data: anom,     pointRadius: 4, borderColor:"#ef4444", backgroundColor:"#ef4444" }
          ]
        },
        { plugins:{legend:{labels:{color:"#ccd6f6"}}},
          scales:{ x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}} } }
      );
      showCanvas("chartAnomalias", "loaderAnom");
    }

  } catch (err) {
    console.error("[IAMINERIA] error cargando minería:", err);
  }
}

// (opcional) escuchamos Firebase en paralelo, por ahora sin uso directo aquí
onValue(medicionesRef, (snapshot) => {
  // Aquí podríamos combinar últimos N en vivo con la muestra de minería si lo necesitas.
});

window.addEventListener("DOMContentLoaded", () => {
  log("init");
  loadMineria();
});
