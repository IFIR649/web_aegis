window.addEventListener('DOMContentLoaded', function() {
  const historicoData = [
    { fecha: '2025-07-09', dispositivo: 'Enchufe Sala', usuario: 'Jose Suarez', consumo: 4.2, costo: 12.50, estado: 'Activo' },
    { fecha: '2025-07-09', dispositivo: 'Enchufe Cocina', usuario: 'Ana Martínez', consumo: 3.1, costo: 8.30, estado: 'Desactivado' },
    { fecha: '2025-07-08', dispositivo: 'Enchufe Recámara', usuario: 'Jose Suarez', consumo: 2.7, costo: 6.50, estado: 'Activo' },
    { fecha: '2025-07-08', dispositivo: 'Enchufe Baño', usuario: 'Luis Pérez', consumo: 1.8, costo: 4.80, estado: 'Activo' },
    { fecha: '2025-07-07', dispositivo: 'Enchufe Terraza', usuario: 'María Gómez', consumo: 3.8, costo: 11.10, estado: 'Activo' },
    { fecha: '2025-07-06', dispositivo: 'Enchufe Sala', usuario: 'Jose Suarez', consumo: 4.5, costo: 13.00, estado: 'Desactivado' },
    { fecha: '2025-07-05', dispositivo: 'Enchufe Cocina', usuario: 'Ana Martínez', consumo: 2.2, costo: 5.90, estado: 'Activo' },
    { fecha: '2025-07-05', dispositivo: 'Enchufe Recámara', usuario: 'Jose Suarez', consumo: 2.5, costo: 7.10, estado: 'Activo' },
    { fecha: '2025-07-04', dispositivo: 'Enchufe Baño', usuario: 'Luis Pérez', consumo: 1.6, costo: 4.20, estado: 'Desactivado' },
    { fecha: '2025-07-03', dispositivo: 'Enchufe Terraza', usuario: 'María Gómez', consumo: 3.2, costo: 9.60, estado: 'Activo' },
    // ...puedes agregar más filas para ver la paginación en acción
  ];

  const HISTORICO_PER_PAGE = 7;
  const tableBody = document.querySelector('#historico-table tbody');
  const input = document.getElementById('historico-search');
  const pagination = document.getElementById('historico-pagination');

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
    const inicio = (page - 1) * HISTORICO_PER_PAGE;
    const fin = inicio + HISTORICO_PER_PAGE;
    fillTable(rows.slice(inicio, fin));
  }

  function renderPagination(totalRows, page, onPageChange) {
    const totalPages = Math.ceil(totalRows / HISTORICO_PER_PAGE) || 1;
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
    filteredRows = filterRows(historicoData, filter);
    const totalPages = Math.ceil(filteredRows.length / HISTORICO_PER_PAGE) || 1;
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

  // Simulación de exportar CSV
  document.getElementById('btn-exportar-historico').addEventListener('click', function() {
    alert('Simulación de exportar CSV del histórico.');
  });

  updateTable();
});
