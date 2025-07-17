window.addEventListener('DOMContentLoaded', function() {
  const dispositivosData = [
    { nombre: 'Enchufe Sala', tipo: 'Empotrado', usuario: 'Jose Suarez', consumo: 120, estado: 'Activo' },
    { nombre: 'Enchufe Cocina', tipo: 'Sobrepuesto', usuario: 'Ana Martínez', consumo: 95, estado: 'Activo' },
    { nombre: 'Enchufe Recámara', tipo: 'Empotrado', usuario: 'Luis Pérez', consumo: 60, estado: 'Inactivo' },
    { nombre: 'Enchufe Baño', tipo: 'Sobrepuesto', usuario: 'María Gómez', consumo: 80, estado: 'Activo' },
    { nombre: 'Enchufe Terraza', tipo: 'Empotrado', usuario: 'Pedro Torres', consumo: 70, estado: 'Inactivo' },
    { nombre: 'Enchufe Garage', tipo: 'Sobrepuesto', usuario: 'Laura Méndez', consumo: 110, estado: 'Activo' },
    { nombre: 'Enchufe Estudio', tipo: 'Empotrado', usuario: 'Carlos Rivera', consumo: 65, estado: 'Activo' },
    { nombre: 'Enchufe Patio', tipo: 'Sobrepuesto', usuario: 'Gabriela Cruz', consumo: 58, estado: 'Activo' }
  ];

  const DISP_PER_PAGE = 5;
  const tableBody = document.querySelector('#dispositivos-table tbody');
  const input = document.getElementById('dispositivos-search');
  const pagination = document.getElementById('dispositivos-pagination');
  const activosCount = document.getElementById('disp-activos-count');
  const inactivosCount = document.getElementById('disp-inactivos-count');

  let filter = '';
  let currentPage = 1;
  let filteredRows = [];

  function fillTable(data) {
    tableBody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.nombre}</td>
        <td>${row.tipo}</td>
        <td>${row.usuario}</td>
        <td>${row.consumo} W</td>
        <td><span class="status ${row.estado === 'Activo' ? 'ok' : 'alert'}">${row.estado}</span></td>
        <td class="actions-cell">
          <button title="Encender/Apagar"><span>🔌</span></button>
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
      row.nombre.toLowerCase().includes(filtro) ||
      row.tipo.toLowerCase().includes(filtro) ||
      row.usuario.toLowerCase().includes(filtro) ||
      row.estado.toLowerCase().includes(filtro)
    );
  }

  function showPageRows(rows, page) {
    const inicio = (page - 1) * DISP_PER_PAGE;
    const fin = inicio + DISP_PER_PAGE;
    fillTable(rows.slice(inicio, fin));
  }

  function renderPagination(totalRows, page, onPageChange) {
    const totalPages = Math.ceil(totalRows / DISP_PER_PAGE) || 1;
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

  function updateStats() {
    activosCount.textContent = dispositivosData.filter(d => d.estado === 'Activo').length;
    inactivosCount.textContent = dispositivosData.filter(d => d.estado !== 'Activo').length;
  }

  function updateTable() {
    filteredRows = filterRows(dispositivosData, filter);
    const totalPages = Math.ceil(filteredRows.length / DISP_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    showPageRows(filteredRows, currentPage);
    renderPagination(filteredRows.length, currentPage, (newPage) => {
      currentPage = newPage;
      showPageRows(filteredRows, currentPage);
      renderPagination(filteredRows.length, currentPage, arguments.callee);
    });
    updateStats();
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
      if (btn.title === 'Encender/Apagar') alert('Función encender/apagar (demo)');
      if (btn.title === 'Ver detalles') alert('Función ver detalles (demo)');
    }
  });

  document.getElementById('btn-agregar-dispositivo').addEventListener('click', function() {
    alert('Función para agregar dispositivo (demo)');
  });
});
