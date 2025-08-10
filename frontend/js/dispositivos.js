// /js/dispositivos.js — derivar lista desde 'mediciones'
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = { databaseURL: "https://movil-40fec-default-rtdb.firebaseio.com/" };
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// === UI refs ===
const $ = s => document.querySelector(s);
const tableBody = $('#dispositivos-table tbody');
const input = $('#dispositivos-search');
const pagination = $('#dispositivos-pagination');
const activosCount = $('#disp-activos-count');
const inactivosCount = $('#disp-inactivos-count');

const DISP_PER_PAGE = 5;
const N_ULTIMOS = 3000;           // lee los últimos N eventos
const ACTIVO_VENTANA = 10 * 60e3; // 10 min
let filter = '';
let currentPage = 1;
let allRows = [];
let filteredRows = [];

function toDateFlexible(m){
  if (m.timestamp != null) {
    const n = Number(m.timestamp);
    if (Number.isFinite(n)) {
      const ms = n < 2e12 ? n*1000 : n;
      const d = new Date(ms);
      if (!isNaN(d)) return d;
    }
  }
  if (m.datetime){
    const d = new Date(m.datetime);
    if (!isNaN(d)) return d;
    const d2 = new Date(String(m.datetime).replace(" ","T")+"Z");
    if (!isNaN(d2)) return d2;
  }
  if (m.fecha && m.hora){
    const d3 = new Date(`${m.fecha}T${String(m.hora).slice(0,5)}:00Z`);
    if (!isNaN(d3)) return d3;
  }
  return null;
}

function mapMedicion(m){
  const dt = toDateFlexible(m);
  const ts = dt ? dt.getTime() : 0;
  const dev = m.device_id || m.dispositivo || "Smart Plug";
  // “Consumo actual”: si tienes active_power en W, úsalo; si es kWh, ajusta a tu preferencia
  const consumoW = Number(m.active_power ?? 0);
  const estado = (m.estado ?? "").toString().toLowerCase() || (Number(m.current ?? 0) < 0 ? "inactivo" : "activo");
  return { ts, dt, device_id: dev, usuario: m.usuario ?? "—", tipo: m.tipo ?? "—", consumoW: Number.isFinite(consumoW)?consumoW:0, estado };
}

function buildFromMediciones(val){
  const arr = Object.values(val).map(mapMedicion).filter(r=>r.ts>0).sort((a,b)=>b.ts-a.ts);
  // conservar el más reciente por device_id
  const seen = new Set();
  const latest = [];
  for (const r of arr){
    if (seen.has(r.device_id)) continue;
    seen.add(r.device_id);
    latest.push(r);
  }
  return latest;
}

function fillTable(rows){
  tableBody.innerHTML = rows.map(r => {
    const ok = r.estado === 'activo' || r.estado === 'normal' || r.estado === 'ok';
    return `
      <tr>
        <td>${r.device_id}</td>
        <td>${r.tipo}</td>
        <td>${r.usuario}</td>
        <td>${r.consumoW.toFixed(0)} W</td>
        <td><span class="status ${ok?'ok':'alert'}">${ok?'Activo':'Inactivo'}</span></td>
        <td class="actions-cell">
          <button title="Encender/Apagar"><span>🔌</span></button>
          <button title="Ver detalles"><span>🔎</span></button>
        </td>
      </tr>`;
  }).join("");
}

function filterRows(rows, filtro){
  if (!filtro) return rows;
  const f = filtro.toLowerCase();
  return rows.filter(r =>
    r.device_id.toLowerCase().includes(f) ||
    (r.usuario||'').toLowerCase().includes(f) ||
    (r.tipo||'').toLowerCase().includes(f) ||
    (r.estado||'').toLowerCase().includes(f)
  );
}

function showPageRows(rows, page){
  const ini = (page-1)*DISP_PER_PAGE;
  const fin = ini + DISP_PER_PAGE;
  fillTable(rows.slice(ini, fin));
}

function renderPagination(total, page, onPageChange){
  pagination.innerHTML = '';
  const totalPages = Math.ceil(total / DISP_PER_PAGE) || 1;

  const prev = document.createElement('button');
  prev.textContent = '«';
  prev.disabled = page===1;
  prev.onclick = () => onPageChange(page-1);
  pagination.appendChild(prev);

  for (let i=1; i<=totalPages; i++){
    const b = document.createElement('button');
    b.textContent = i;
    b.className = i===page ? 'active-page-btn':'';
    b.onclick = () => onPageChange(i);
    pagination.appendChild(b);
  }

  const next = document.createElement('button');
  next.textContent = '»';
  next.disabled = page===totalPages;
  next.onclick = () => onPageChange(page+1);
  pagination.appendChild(next);
}

function updateStats(rows){
  const now = Date.now();
  let activos = 0, inactivos = 0;
  rows.forEach(r => {
    const enVentana = (now - r.ts) <= ACTIVO_VENTANA;
    const ok = (r.estado === 'activo' || r.estado === 'normal' || r.estado === 'ok') && enVentana;
    if (ok) activos++; else inactivos++;
  });
  if (activosCount) activosCount.textContent = activos;
  if (inactivosCount) inactivosCount.textContent = inactivos;
}

function refreshTable(){
  filteredRows = filterRows(allRows, filter);
  const totalPages = Math.ceil(filteredRows.length / DISP_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  showPageRows(filteredRows, currentPage);
  renderPagination(filteredRows.length, currentPage, (newPage)=>{
    currentPage = newPage;
    showPageRows(filteredRows, currentPage);
    renderPagination(filteredRows.length, currentPage, arguments.callee);
  });
  updateStats(filteredRows);
}

if (input){
  input.addEventListener('keyup', () => {
    filter = input.value;
    currentPage = 1;
    refreshTable();
  });
}

// Carga desde RTDB
function load(){
  const q = query(ref(db, 'mediciones'), limitToLast(N_ULTIMOS));
  onValue(q, (snap) => {
    const val = snap.val();
    if (!val) {
      allRows = [];
      refreshTable();
      return;
    }
    allRows = buildFromMediciones(val);
    refreshTable();
  }, (err) => {
    console.error('[dispositivos] Firebase error:', err);
    allRows = [];
    refreshTable();
  });
}

window.addEventListener('DOMContentLoaded', load);
