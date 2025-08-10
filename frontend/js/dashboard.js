// js/dashboard.js — Dashboard 100% desde Firebase (KPIs + gráficas + tabla)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

/* ==============================
   CONFIG
================================= */
const firebaseConfig = { databaseURL: "https://movil-40fec-default-rtdb.firebaseio.com/" };
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// Límite de lecturas para no reventar el DOM / memoria
const N_ULTIMOS       = 2000;         // últimos N registros del nodo "mediciones"
const ROWS_PER_PAGE   = 5;            // paginación tabla
const MAX_TABLE_ROWS  = 30;           // filas visibles en tabla
const ALERTA_Z        = 3;            // z-score para detectar outliers
const ACTIVO_VENTANA  = 10 * 60e3;    // ms: un dispositivo es "activo" si reportó en esta ventana
const TARIFA_MXN_KWH  = 0.0015;       // proxy tarifa; ajusta si tienes tarifa real

/* ==============================
   DOM
================================= */
const $ = (s) => document.querySelector(s);

const elConsumo  = $("#card-consumo");
const elAlertas  = $("#card-alertas");
const elActivos  = $("#card-activos");

const tableBody  = document.querySelector('#main-table tbody');
const input      = document.getElementById('table-search');
const pagination = document.getElementById('table-pagination');

const barCtx   = $("#barChart")?.getContext("2d");
const lineCtx  = $("#lineChart")?.getContext("2d");

let barChartInst  = null;
let lineChartInst = null;

console.log("[Dashboard] Firebase-only JS cargado");

/* ==============================
   Helpers
================================= */
function fmtYYYYMM(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function mean(a){ return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0; }
function std(a){ if(a.length<2) return 0; const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)*(x-m)))); }

// Intenta parsear datetime/timestamp en varios formatos
function toDateFlexible(m){
  // Prioridad 1: número epoch (s o ms)
  if (m.timestamp !== undefined && m.timestamp !== null){
    const n = Number(m.timestamp);
    if (Number.isFinite(n)){
      // Si parece en segundos, súbelo a ms
      const ms = n < 2e12 ? n * 1000 : n;
      const d = new Date(ms);
      if (!isNaN(d)) return d;
    }
  }
  // Prioridad 2: ISO u otros (datetime, fecha+hora)
  if (m.datetime){
    const d1 = new Date(m.datetime);
    if (!isNaN(d1)) return d1;
    // fallback: "YYYY-MM-DD HH:mm:ss"
    const d2 = new Date(String(m.datetime).replace(" ", "T")+"Z");
    if (!isNaN(d2)) return d2;
  }
  if (m.fecha && m.hora){
    const d3 = new Date(`${m.fecha}T${String(m.hora).slice(0,5)}:00Z`);
    if (!isNaN(d3)) return d3;
  }
  return null;
}

function safeNum(n, def=0){
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}

function mapMedicion(raw){
  const dt = toDateFlexible(raw);
  const ts = dt ? dt.getTime() : 0;

  // Consumo: si existe consumo_kwh, úsalo; si no, proxy con active_power (en abs)
  let consumo = safeNum(raw.consumo_kwh);
  if (!Number.isFinite(consumo) || consumo === 0){
    consumo = Math.abs(safeNum(raw.active_power ?? raw.consumo, 0));
  }

  const device = raw.device_id || raw.dispositivo || "Smart Plug";
  const costo  = consumo * TARIFA_MXN_KWH;

  // Estado base: si current < 0, lo marcamos como "inverso", si no, "activo" (ajústalo a tu lógica)
  const estado = safeNum(raw.current, 0) < 0 ? "inverso" : (raw.estado || "activo");

  return {
    ts,
    dt,
    fecha: dt ? dt.toISOString().slice(0,10) : "—",
    yyyymm: dt ? fmtYYYYMM(dt) : "—",
    device_id: device,
    consumo: safeNum(consumo, 0),
    costo: safeNum(costo, 0),
    estado: String(estado).toLowerCase()
  };
}

/* ==============================
   Tabla: búsqueda + paginación
================================= */
let filter = '';
let currentPage = 1;
let tableRows = [];     // generado desde Firebase (ya mapeado)
let filteredRows = [];

function capitalize(s){
  if(!s) return '';
  const t = String(s);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fillTable(data){
  if (!tableBody) return;
  tableBody.innerHTML = data.map(row=>{
    const isOk = (row.estado === 'activo' || row.estado === 'normal' || row.estado === 'ok');
    return `
      <tr>
        <td>${row.fecha}</td>
        <td>${row.device_id}</td>
        <td>—</td>
        <td>${row.consumo.toFixed(2)}</td>
        <td>$${row.costo.toFixed(2)}</td>
        <td><span class="status ${isOk ? 'ok' : 'alert'}">${capitalize(row.estado) || '—'}</span></td>
      </tr>`;
  }).join("");
}

function filterRows(rows, filtro){
  if (!filtro) return rows;
  const f = filtro.toLowerCase();
  return rows.filter(row =>
    row.fecha.toLowerCase().includes(f) ||
    row.device_id.toLowerCase().includes(f) ||
    row.estado.toLowerCase().includes(f)
  );
}

function showPageRows(rows, page){
  const inicio = (page - 1) * ROWS_PER_PAGE;
  const fin    = inicio + ROWS_PER_PAGE;
  fillTable(rows.slice(inicio, fin));
}

function renderPagination(totalRows, page, onPageChange){
  if (!pagination) return;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;
  pagination.innerHTML = '';

  const prev = document.createElement('button');
  prev.textContent = '«';
  prev.disabled = (page === 1);
  prev.onclick = () => onPageChange(page - 1);
  pagination.appendChild(prev);

  for (let i = 1; i <= totalPages; i++){
    const b = document.createElement('button');
    b.textContent = i;
    b.className = (i === page) ? 'active-page-btn' : '';
    b.onclick = () => onPageChange(i);
    pagination.appendChild(b);
  }

  const next = document.createElement('button');
  next.textContent = '»';
  next.disabled = (page === totalPages);
  next.onclick = () => onPageChange(page + 1);
  pagination.appendChild(next);
}

function updateTable(){
  filteredRows = filterRows(tableRows || [], filter);
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  showPageRows(filteredRows, currentPage);
  renderPagination(filteredRows.length, currentPage, (newPage) => {
    currentPage = newPage;
    showPageRows(filteredRows, currentPage);
    renderPagination(filteredRows.length, currentPage, arguments.callee);
  });
}

if (input){
  input.addEventListener('keyup', () => {
    filter = input.value;
    currentPage = 1;
    updateTable();
  });
}

/* ==============================
   KPIs + Gráficas
================================= */
function renderKPIs(rows){
  // Consumo del mes actual (solo con lo que HAY en Firebase)
  const now = new Date();
  const mesActual = fmtYYYYMM(now);
  const consumoMes = rows
    .filter(r => r.yyyymm === mesActual)
    .reduce((acc, r)=> acc + r.consumo, 0);

  // Dispositivos activos: último evento dentro de la ventana ACTIVO_VENTANA
  const ahora = now.getTime();
  const lastSeen = new Map(); // device_id -> ts más reciente
  for (const r of rows){
    lastSeen.set(r.device_id, Math.max(lastSeen.get(r.device_id) || 0, r.ts));
  }
  let activos = 0;
  lastSeen.forEach(ts => { if (ahora - ts <= ACTIVO_VENTANA) activos++; });

  // Alertas por z-score en consumo (últimos 500 puntos)
  const pool = rows.slice(0, Math.min(500, rows.length)).map(r => r.consumo);
  const m = mean(pool), s = std(pool) || 1e-9;
  const nAlertas = pool.filter(x => Math.abs((x - m)/s) >= ALERTA_Z).length;

  if (elConsumo) elConsumo.textContent = `${consumoMes.toFixed(2)} kWh`;
  if (elActivos) elActivos.textContent = String(activos);
  if (elAlertas) elAlertas.textContent = String(nAlertas);
}

function renderCharts(rows){
  // Mensual (últimos 6 meses presentes)
  const byMonth = new Map();
  for (const r of rows){
    byMonth.set(r.yyyymm, (byMonth.get(r.yyyymm) || 0) + r.consumo);
  }
  const months = Array.from(byMonth.keys()).sort();
  const last6  = months.slice(-6);
  const dataM  = last6.map(m => Number((byMonth.get(m) || 0).toFixed(2)));

  if (barCtx && window.Chart){
    if (barChartInst) barChartInst.destroy();
    barChartInst = new Chart(barCtx, {
      type: "bar",
      data: { labels: last6, datasets: [{ label: "Consumo mensual (kWh)", data: dataM, borderRadius: 8 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}} }
      }
    });
  }

  // Diario (últimos 7 días presentes)
  const byDate = new Map();
  for (const r of rows){
    byDate.set(r.fecha, (byDate.get(r.fecha) || 0) + r.consumo);
  }
  const dates = Array.from(byDate.keys()).sort();
  const last7 = dates.slice(-7);
  const dataD = last7.map(d => Number((byDate.get(d) || 0).toFixed(2)));

  if (lineCtx && window.Chart){
    if (lineChartInst) lineChartInst.destroy();
    lineChartInst = new Chart(lineCtx, {
      type: "line",
      data: { labels: last7, datasets: [{ label: "Consumo diario (kWh)", data: dataD, tension: 0.35, fill: false }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x:{ticks:{color:"#ccd6f6"}}, y:{ticks:{color:"#ccd6f6"}} }
      }
    });
  }
}

function renderTableFromRows(rows){
  tableRows = rows.slice(0, MAX_TABLE_ROWS);
  updateTable();
}

/* ==============================
   Carga RTDB y render
================================= */
function loadDashboard(){
  const q = query(ref(db, "mediciones"), limitToLast(N_ULTIMOS));
  onValue(q, (snap) => {
    const val = snap.val();
    const count = val ? Object.keys(val).length : 0;
    console.log("[Dashboard] Registros Firebase:", count);

    if (!val){
      renderKPIs([]); renderCharts([]); renderTableFromRows([]);
      return;
    }

    // a) Convertimos a array de objetos
    // b) Mapeamos a estructura uniforme
    // c) Filtramos sin timestamp válido
    // d) Ordenamos por tiempo (desc)
    const rows = Object.values(val)
      .map(mapMedicion)
      .filter(r => r.ts > 0)
      .sort((a,b)=> b.ts - a.ts);

    renderKPIs(rows);
    renderCharts(rows);
    renderTableFromRows(rows);
  }, (err) => {
    console.error("[Dashboard] Firebase error:", err);
    renderKPIs([]); renderCharts([]); renderTableFromRows([]);
  });
}

window.addEventListener("DOMContentLoaded", loadDashboard);
