// js/pages/History.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

/* ==============================
   Configuración
============================== */
const firebaseConfig = { databaseURL: "https://movil-40fec-default-rtdb.firebaseio.com/" };
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// Cuántos registros traemos del RTDB para el histórico (cliente)
const FB_LIMIT = 5000;           // ajusta según lo necesites
const HISTORICO_PER_PAGE = 7;    // igual que tu versión mock
const TARIFA_MXN_POR_KWH = 3.2;  // costo estimado: kWh * tarifa

/* ==============================
   Helpers
============================== */
const $ = (s) => document.querySelector(s);

function isEpochSeconds(ts) {
  const n = Number(ts);
  return Number.isFinite(n) && String(n).length <= 10;
}
function toDate(m) {
  // Prioriza timestamp; si viene en segundos lo multiplicamos
  if (m?.timestamp != null) {
    const n = Number(m.timestamp);
    return new Date(isEpochSeconds(n) ? n * 1000 : n);
  }
  if (m?.datetime) return new Date(m.datetime);
  return null;
}
function ymd(date) {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ==============================
   Estado de UI
============================== */
const tableBody  = $("#historico-table tbody");
const input      = $("#historico-search");
const pagination = $("#historico-pagination");

let allRows = [];    // lo que viene de Firebase (mapeado)
let filtered = [];   // resultado del filtro
let filterTxt = "";
let currentPage = 1;

/* ==============================
   Mapeo de la medición a filas UI
============================== */
function mapMedicionToRow(m) {
  const d = toDate(m);
  const fecha = ymd(d);

  // Proxy simple: convertir active_power (W) a kWh aprox por evento
  // (si prefieres otro cálculo, dime y lo cambiamos)
  const consumo_kwh = Math.abs(Number(m.active_power ?? 0)) / 1000;
  const costo = consumo_kwh * TARIFA_MXN_POR_KWH;

  // "Estado" simple (puedes cambiar a Activo/Inactivo por timestamp)
  const estado = Number(m.current ?? 0) < 0 ? "Inverso ⚠️" : "Normal ✅";

  return {
    fecha,
    dispositivo: m.device_id || "—",
    usuario: "—",                      // si luego guardas usuario en RTDB, lo tomamos de ahí
    consumo: Number(consumo_kwh.toFixed(3)),
    costo: Number(costo.toFixed(2)),
    estado,
    _ts: d ? d.getTime() : 0           // para ordenar por fecha
  };
}

/* ==============================
   Render
============================== */
function fillTable(rows) {
  tableBody.innerHTML = "";
  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.fecha}</td>
      <td>${row.dispositivo}</td>
      <td>${row.usuario}</td>
      <td>${row.consumo}</td>
      <td>$${row.costo.toFixed(2)}</td>
      <td><span class="status ${row.estado.includes("Normal") ? "ok" : "alert"}">${row.estado}</span></td>
    `;
    tableBody.appendChild(tr);
  });
}

function filterRows(rows, filtro) {
  if (!filtro) return rows;
  const f = filtro.toLowerCase();
  return rows.filter(r =>
    r.fecha.toLowerCase().includes(f) ||
    r.dispositivo.toLowerCase().includes(f) ||
    r.usuario.toLowerCase().includes(f) ||
    r.estado.toLowerCase().includes(f)
  );
}

function showPageRows(rows, page) {
  const start = (page - 1) * HISTORICO_PER_PAGE;
  const end   = start + HISTORICO_PER_PAGE;
  fillTable(rows.slice(start, end));
}

function renderPagination(totalRows, page, onPageChange) {
  const totalPages = Math.ceil(totalRows / HISTORICO_PER_PAGE) || 1;
  pagination.innerHTML = "";

  const prev = document.createElement("button");
  prev.textContent = "«";
  prev.disabled = (page === 1);
  prev.onclick = () => onPageChange(page - 1);
  pagination.appendChild(prev);

  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    b.className = (i === page) ? "active-page-btn" : "";
    b.onclick = () => onPageChange(i);
    pagination.appendChild(b);
  }

  const next = document.createElement("button");
  next.textContent = "»";
  next.disabled = (page === totalPages);
  next.onclick = () => onPageChange(page + 1);
  pagination.appendChild(next);
}

function updateTable() {
  filtered = filterRows(allRows, filterTxt);
  const totalPages = Math.ceil(filtered.length / HISTORICO_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  showPageRows(filtered, currentPage);
  renderPagination(filtered.length, currentPage, newPage => {
    currentPage = newPage;
    showPageRows(filtered, currentPage);
    renderPagination(filtered.length, currentPage, arguments.callee);
  });
}

/* ==============================
   CSV Export
============================== */
function exportCSV() {
  const rows = filtered.length ? filtered : allRows;
  const header = ["fecha","dispositivo","usuario","consumo_kwh","costo_mxn","estado"];
  const lines = [
    header.join(","),
    ...rows.map(r => [
      csvEscape(r.fecha),
      csvEscape(r.dispositivo),
      csvEscape(r.usuario),
      csvEscape(r.consumo),
      csvEscape(r.costo.toFixed(2)),
      csvEscape(r.estado),
    ].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `historico_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==============================
   Suscripción Firebase
============================== */
function subscribeHistorico() {
  const q = query(ref(db, "mediciones"), limitToLast(FB_LIMIT));
  onValue(q, snap => {
    const val = snap.val() || {};
    // -> array de mediciones
    const raw = Object.values(val);

    // Orden descendente por timestamp
    allRows = raw
      .map(mapMedicionToRow)
      .sort((a,b) => b._ts - a._ts);

    currentPage = 1;
    updateTable();
  });
}

/* ==============================
   Init
============================== */
window.addEventListener("DOMContentLoaded", () => {
  input?.addEventListener("keyup", () => {
    filterTxt = input.value || "";
    currentPage = 1;
    updateTable();
  });

  const btn = document.getElementById("btn-exportar-historico");
  btn?.addEventListener("click", exportCSV);

  subscribeHistorico();
});
