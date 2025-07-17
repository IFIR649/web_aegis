window.addEventListener('DOMContentLoaded', function() {
  const reportesData = [
    { fecha: '2025-07-09', tipo: 'Consumo mensual', usuario: 'Jose Suarez', formato: 'PDF', estado: 'Listo' },
    { fecha: '2025-07-09', tipo: 'Alertas', usuario: 'Ana Martínez', formato: 'CSV', estado: 'Pendiente' },
    { fecha: '2025-07-08', tipo: 'Consumo diario', usuario: 'Luis Pérez', formato: 'PDF', estado: 'Listo' },
    { fecha: '2025-07-07', tipo: 'Resumen general', usuario: 'María Gómez', formato: 'CSV', estado: 'Listo' },
    { fecha: '2025-07-07', tipo: 'Consumo mensual', usuario: 'Pedro Torres', formato: 'PDF', estado: 'Listo' },
    { fecha: '2025-07-06', tipo: 'Alertas', usuario: 'Gabriela Cruz', formato: 'CSV', estado: 'Pendiente' },
    { fecha: '2025-07-05', tipo: 'Histórico', usuario: 'Carlos Rivera', formato: 'PDF', estado: 'Listo' }
    // Puedes agregar más registros
  ];

  const REPORTES_PER_PAGE = 5;
  const tableBody = document.querySelector('#reportes-table tbody');
  const input = document.getElementById('reportes-search');
  const pagination = document.getElementById('reportes-pagination');
  const reportesCount = document.getElementById('reportes-count');

  let filter = '';
  let currentPage = 1;
  let filteredRows = [];

  function fillTable(data) {
    tableBody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.fecha}</td>
        <td>${row.tipo}</td>
        <td>${row.usuario}</td>
        <td>${row.formato}</td>
        <td>
          <span class="status ${row.estado === 'Listo' ? 'ok' : 'alert'}" title="${row.estado}">
            ${row.estado}
          </span>
        </td>
        <td class="actions-cell">
          <button title="Descargar"><span>⬇️</span></button>
          <button title="Ver detalles"><span>🔎</span></button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function filterRows(rows, filtro) {
    if (!filtro) return rows;
    filtro = filtro.toLowerCase();
    return rows.filter(row =>
      row.fecha.toLowerCase().includes(filtro) ||
      row.tipo.toLowerCase().includes(filtro) ||
      row.usuario.toLowerCase().includes(filtro) ||
      row.formato.toLowerCase().includes(filtro) ||
      row.estado.toLowerCase().includes(filtro)
    );
  }

  function showPageRows(rows, page) {
    const inicio = (page - 1) * REPORTES_PER_PAGE;
    const fin = inicio + REPORTES_PER_PAGE;
    fillTable(rows.slice(inicio, fin));
  }

  function renderPagination(totalRows, page, onPageChange) {
    const totalPages = Math.ceil(totalRows / REPORTES_PER_PAGE) || 1;
    pagination.innerHTML = '';
    const prev = document.createElement('button');
    prev.textContent = '«';
    prev.disabled = (page === 1);
    prev.onclick = () => onPageChange(page - 1);
    pagination.appendChild(prev);
    for (let i = 1; i <= totalPages; i++) {
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

  function updateTable() {
    filteredRows = filterRows(reportesData, filter);
    const totalPages = Math.ceil(filteredRows.length / REPORTES_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    showPageRows(filteredRows, currentPage);
    renderPagination(filteredRows.length, currentPage, (newPage) => {
      currentPage = newPage;
      showPageRows(filteredRows, currentPage);
      renderPagination(filteredRows.length, currentPage, arguments.callee);
    });
    reportesCount.textContent = reportesData.length;
  }

  input.addEventListener('keyup', function () {
    filter = input.value;
    currentPage = 1;
    updateTable();
  });

  updateTable();

  // Acciones de los botones (solo demo)
  tableBody.addEventListener('click', function(e) {
    if (e.target.closest('button')) {
      const btn = e.target.closest('button');
      if (btn.title === 'Descargar') alert('Simulación de descarga de reporte.');
      if (btn.title === 'Ver detalles') alert('Simulación de ver detalles.');
    }
  });

  document.getElementById('btn-generar-reporte').addEventListener('click', function() {
    alert('Función para generar nuevo reporte (demo)');
  });
});
