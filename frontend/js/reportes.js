// /js/reportes.js — lee/escribe en 'reportes/'
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = { databaseURL: "https://movil-40fec-default-rtdb.firebaseio.com/" };
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const REPORTES_PER_PAGE = 5;
const tableBody = document.querySelector('#reportes-table tbody');
const input = document.getElementById('reportes-search');
const pagination = document.getElementById('reportes-pagination');
const reportesCount = document.getElementById('reportes-count');
const btnGenerar = document.getElementById('btn-generar-reporte');

let filter = '';
let currentPage = 1;
let allRows = [];
let filteredRows = [];

const $ = s => document.querySelector(s);
const pad2 = n => String(n).padStart(2,'0');
function fmtDate(ts){
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function fillTable(rows){
  tableBody.innerHTML = rows.map(r => {
    const ok = r.estado?.toLowerCase() === 'listo';
    return `
      <tr>
        <td>${r.fecha}</td>
        <td>${r.tipo}</td>
        <td>${r.usuario}</td>
        <td>${r.formato}</td>
        <td><span class="status ${ok?'ok':'alert'}">${r.estado}</span></td>
        <td class="actions-cell">
          <button title="Descargar">⬇️</button>
          <button title="Ver detalles">🔎</button>
        </td>
      </tr>`;
  }).join('');
}

function filterRows(rows, filtro){
  if (!filtro) return rows;
  const f = filtro.toLowerCase();
  return rows.filter(r =>
    r.fecha.toLowerCase().includes(f) ||
    (r.tipo||'').toLowerCase().includes(f) ||
    (r.usuario||'').toLowerCase().includes(f) ||
    (r.formato||'').toLowerCase().includes(f) ||
    (r.estado||'').toLowerCase().includes(f)
  );
}

function showPageRows(rows, page){
  const ini = (page-1)*REPORTES_PER_PAGE;
  const fin = ini + REPORTES_PER_PAGE;
  fillTable(rows.slice(ini, fin));
}

function renderPagination(total, page, onPageChange){
  pagination.innerHTML = '';
  const totalPages = Math.ceil(total / REPORTES_PER_PAGE) || 1;

  const prev = document.createElement('button');
  prev.textContent = '«';
  prev.disabled = page===1;
  prev.onclick = () => onPageChange(page-1);
  pagination.appendChild(prev);

  for (let i=1;i<=totalPages;i++){
    const b = document.createElement('button');
    b.textContent = i;
    b.className = i===page ? 'active-page-btn' : '';
    b.onclick = () => onPageChange(i);
    pagination.appendChild(b);
  }

  const next = document.createElement('button');
  next.textContent = '»';
  next.disabled = page===totalPages;
  next.onclick = () => onPageChange(page+1);
  pagination.appendChild(next);
}

function refresh(){
  filteredRows = filterRows(allRows, filter);
  const totalPages = Math.ceil(filteredRows.length / REPORTES_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  showPageRows(filteredRows, currentPage);
  renderPagination(filteredRows.length, currentPage, (newPage)=>{
    currentPage = newPage;
    showPageRows(filteredRows, currentPage);
    renderPagination(filteredRows.length, currentPage, arguments.callee);
  });
  reportesCount.textContent = allRows.length;
}

if (input){
  input.addEventListener('keyup', ()=>{
    filter = input.value;
    currentPage = 1;
    refresh();
  });
}

if (btnGenerar){
  btnGenerar.addEventListener('click', async ()=>{
    try{
      await push(ref(db, 'reportes'), {
        fecha_ts: serverTimestamp(),
        tipo: 'Consumo mensual',
        usuario: 'Sistema',
        formato: 'PDF',
        estado: 'Pendiente'
      });
      alert('Reporte generado (registro creado).');
    }catch(e){
      console.error('Error creando reporte:', e);
      alert('No se pudo crear el reporte. Revisa reglas de RTDB.');
    }
  });
}

function load(){
  onValue(ref(db, 'reportes'), (snap)=>{
    const val = snap.val();
    if (!val){ allRows = []; refresh(); return; }
    const arr = Object.entries(val).map(([id, r])=>{
      const ts = r.fecha_ts ? (typeof r.fecha_ts === 'number' ? r.fecha_ts : Date.now()) : Date.now();
      return {
        id,
        fecha: fmtDate(ts),
        tipo: r.tipo || '—',
        usuario: r.usuario || '—',
        formato: r.formato || '—',
        estado: r.estado || 'Pendiente'
      };
    }).sort((a,b)=> (a.fecha < b.fecha ? 1 : -1));
    allRows = arr;
    refresh();
  }, (err)=>{
    console.error('[reportes] Firebase error:', err);
    allRows = []; refresh();
  });
}

window.addEventListener('DOMContentLoaded', load);
