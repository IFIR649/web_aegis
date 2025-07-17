window.addEventListener('DOMContentLoaded', function() {

  const dashboardData = {
    cards: {
      consumo: 178.4, // kWh mensual
      alertas: 2,
      activos: 6
    },
    mensual: {
      labels: ['Enero', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
      data: [120, 134, 128, 140, 152, 160, 178.4]
    },
    semanal: {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      data: [6.2, 7.5, 7.1, 8.0, 8.3, 6.9, 7.8]
    },
    historico: [
      { fecha: '2025-07-09', dispositivo: 'Enchufe Sala', usuario: 'Jose', consumo: 4.2, costo: 12.50, estado: 'Activo' },
      { fecha: '2025-07-09', dispositivo: 'Enchufe Cocina', usuario: 'Ana', consumo: 3.1, costo: 8.30, estado: 'Desactivado' },
      { fecha: '2025-07-08', dispositivo: 'Enchufe Recámara', usuario: 'Jose', consumo: 2.7, costo: 6.50, estado: 'Activo' },
      { fecha: '2025-07-08', dispositivo: 'Enchufe Baño', usuario: 'Luis', consumo: 1.8, costo: 4.80, estado: 'Activo' },
      { fecha: '2025-07-07', dispositivo: 'Enchufe Terraza', usuario: 'María', consumo: 3.8, costo: 11.10, estado: 'Activo' },
      { fecha: '2025-07-06', dispositivo: 'Enchufe Sala', usuario: 'Jose', consumo: 4.5, costo: 13.00, estado: 'Desactivado' },
      { fecha: '2025-07-05', dispositivo: 'Enchufe Cocina', usuario: 'Ana', consumo: 2.2, costo: 5.90, estado: 'Activo' },
      { fecha: '2025-07-05', dispositivo: 'Enchufe Recámara', usuario: 'Jose', consumo: 2.5, costo: 7.10, estado: 'Activo' },
      { fecha: '2025-07-04', dispositivo: 'Enchufe Baño', usuario: 'Luis', consumo: 1.6, costo: 4.20, estado: 'Desactivado' },
      { fecha: '2025-07-03', dispositivo: 'Enchufe Terraza', usuario: 'María', consumo: 3.2, costo: 9.60, estado: 'Activo' },
      { fecha: '2025-07-03', dispositivo: 'Enchufe Sala', usuario: 'Jose', consumo: 4.1, costo: 12.20, estado: 'Activo' },
      { fecha: '2025-07-02', dispositivo: 'Enchufe Cocina', usuario: 'Ana', consumo: 3.3, costo: 8.80, estado: 'Activo' },
      { fecha: '2025-07-02', dispositivo: 'Enchufe Recámara', usuario: 'Jose', consumo: 2.9, costo: 7.50, estado: 'Activo' },
      { fecha: '2025-07-01', dispositivo: 'Enchufe Baño', usuario: 'Luis', consumo: 1.7, costo: 4.50, estado: 'Desactivado' },
      { fecha: '2025-07-01', dispositivo: 'Enchufe Terraza', usuario: 'María', consumo: 3.4, costo: 10.20, estado: 'Activo' },
      { fecha: '2025-06-30', dispositivo: 'Enchufe Sala', usuario: 'Jose', consumo: 4.3, costo: 12.70, estado: 'Activo' },
      { fecha: '2025-06-29', dispositivo: 'Enchufe Cocina', usuario: 'Ana', consumo: 3.0, costo: 8.10, estado: 'Activo' },
      { fecha: '2025-06-29', dispositivo: 'Enchufe Baño', usuario: 'Luis', consumo: 1.5, costo: 4.00, estado: 'Activo' }
      // Puedes seguir agregando más...
    ]
  };

  // =============== Cards =========================
  document.getElementById('card-consumo').textContent = `${dashboardData.cards.consumo} kWh`;
  document.getElementById('card-alertas').textContent = dashboardData.cards.alertas;
  document.getElementById('card-activos').textContent = dashboardData.cards.activos;

  // =============== Chart.js Gráficas =============
  // Mensual (Barras)
  const ctxBar = document.getElementById('barChart');
  if (ctxBar) {
    new Chart(ctxBar.getContext('2d'), {
      type: 'bar',
      data: {
        labels: dashboardData.mensual.labels,
        datasets: [{
          label: 'Consumo kWh',
          data: dashboardData.mensual.data,
          backgroundColor: 'rgba(37,99,235,0.77)',
          borderRadius: 8,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#ccd6f6' } },
          y: { ticks: { color: '#ccd6f6' } }
        }
      }
    });
  }
  // Semanal (Líneas)
  const ctxLine = document.getElementById('lineChart');
  if (ctxLine) {
    new Chart(ctxLine.getContext('2d'), {
      type: 'line',
      data: {
        labels: dashboardData.semanal.labels,
        datasets: [{
          label: 'Consumo diario',
          data: dashboardData.semanal.data,
          fill: false,
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,0.20)',
          tension: 0.4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#ccd6f6' } },
          y: { ticks: { color: '#ccd6f6' } }
        }
      }
    });
  }

  // ========== Tabla histórico: búsqueda + paginación ==========
  const ROWS_PER_PAGE = 5;
  const tableBody = document.querySelector('#main-table tbody');
  const input = document.getElementById('table-search');
  const pagination = document.getElementById('table-pagination');

  let filter = '';
  let currentPage = 1;
  let filteredRows = [];

  function fillTable(data) {
    tableBody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.fecha}</td>
        <td>${row.dispositivo}</td>
        <td>${row.usuario}</td>
        <td>${row.consumo}</td>
        <td>$${row.costo.toFixed(2)}</td>
        <td><span class="status ${row.estado === 'Activo' ? 'ok' : 'alert'}">${row.estado}</span></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function filterRows(rows, filtro) {
    if (!filtro) return rows;
    filtro = filtro.toLowerCase();
    return rows.filter(row =>
      row.fecha.toLowerCase().includes(filtro) ||
      row.dispositivo.toLowerCase().includes(filtro) ||
      row.usuario.toLowerCase().includes(filtro) ||
      row.estado.toLowerCase().includes(filtro)
    );
  }

  function showPageRows(rows, page) {
    const inicio = (page - 1) * ROWS_PER_PAGE;
    const fin = inicio + ROWS_PER_PAGE;
    fillTable(rows.slice(inicio, fin));
  }

  function renderPagination(totalRows, page, onPageChange) {
    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;
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
    filteredRows = filterRows(dashboardData.historico, filter);
    const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    showPageRows(filteredRows, currentPage);
    renderPagination(filteredRows.length, currentPage, (newPage) => {
      currentPage = newPage;
      showPageRows(filteredRows, currentPage);
      renderPagination(filteredRows.length, currentPage, arguments.callee);
    });
  }

  input.addEventListener('keyup', function () {
    filter = input.value;
    currentPage = 1;
    updateTable();
  });

  updateTable();
});
