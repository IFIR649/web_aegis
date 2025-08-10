window.addEventListener('DOMContentLoaded', function() {
  // Datos ficticios (puedes agregar más)
  const usuariosData = [
    { nombre: 'Jose Suarez', correo: 'jose@example.com', rol: 'Administrador', estado: 'Activo' },
    { nombre: 'Ana Martínez', correo: 'ana@example.com', rol: 'Usuario', estado: 'Suspendido' },
    { nombre: 'Luis Pérez', correo: 'luis@example.com', rol: 'Usuario', estado: 'Activo' },
    { nombre: 'María Gómez', correo: 'maria@example.com', rol: 'Usuario', estado: 'Activo' },
    { nombre: 'Carlos Rivera', correo: 'carlos@example.com', rol: 'Usuario', estado: 'Suspendido' },
    { nombre: 'Laura Méndez', correo: 'laura@example.com', rol: 'Usuario', estado: 'Activo' },
    { nombre: 'Pedro Torres', correo: 'pedro@example.com', rol: 'Usuario', estado: 'Activo' },
    { nombre: 'Sofía Morales', correo: 'sofia@example.com', rol: 'Usuario', estado: 'Activo' },
    { nombre: 'Raúl Hernández', correo: 'raul@example.com', rol: 'Usuario', estado: 'Suspendido' },
    { nombre: 'Gabriela Cruz', correo: 'gabriela@example.com', rol: 'Usuario', estado: 'Activo' },
  ];

  const USUARIOS_PER_PAGE = 5;
  const tableBody = document.querySelector('#usuarios-table tbody');
  const input = document.getElementById('usuarios-search');
  const pagination = document.getElementById('usuarios-pagination');
  const activosCount = document.getElementById('activos-count');
  const suspendidosCount = document.getElementById('suspendidos-count');

  let filter = '';
  let currentPage = 1;
  let filteredRows = [];

  // Calcula avatar inicial (letra) o imagen real (puedes mejorar esto si gustas)
  function getAvatar(nombre) {
    return `<div class="user-avatar-table">${nombre[0]}</div>`;
  }

  function getRolChip(rol) {
    if (rol.toLowerCase().includes('admin')) {
      return `<span class="rol-chip admin">${rol}</span>`;
    } else {
      return `<span class="rol-chip">${rol}</span>`;
    }
  }

  function fillTable(data) {
    tableBody.innerHTML = '';
    data.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${getAvatar(row.nombre)}</td>
        <td>${row.nombre}</td>
        <td>${row.correo}</td>
        <td>${getRolChip(row.rol)}</td>
        <td><span class="status ${row.estado === 'Activo' ? 'ok' : 'alert'}" title="${row.estado}">${row.estado}</span></td>
        <td class="actions-cell">
          <button title="Editar"><span>✏️</span></button>
          <button title="Eliminar"><span>🗑️</span></button>
          <button title="Reset password"><span>🔑</span></button>
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
      row.correo.toLowerCase().includes(filtro) ||
      row.rol.toLowerCase().includes(filtro) ||
      row.estado.toLowerCase().includes(filtro)
    );
  }

  function showPageRows(rows, page) {
    const inicio = (page - 1) * USUARIOS_PER_PAGE;
    const fin = inicio + USUARIOS_PER_PAGE;
    fillTable(rows.slice(inicio, fin));
  }

  function renderPagination(totalRows, page, onPageChange) {
    const totalPages = Math.ceil(totalRows / USUARIOS_PER_PAGE) || 1;
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
    activosCount.textContent = usuariosData.filter(u => u.estado === 'Activo').length;
    suspendidosCount.textContent = usuariosData.filter(u => u.estado !== 'Activo').length;
  }

  function updateTable() {
    filteredRows = filterRows(usuariosData, filter);
    const totalPages = Math.ceil(filteredRows.length / USUARIOS_PER_PAGE) || 1;
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

  // Acciones de los botones (solo simulados por ahora)
  tableBody.addEventListener('click', function(e) {
    if (e.target.closest('button')) {
      const btn = e.target.closest('button');
      if (btn.title === 'Editar') alert('Función editar (demo)');
      if (btn.title === 'Eliminar') alert('Función eliminar (demo)');
      if (btn.title === 'Reset password') alert('Función reset password (demo)');
    }
  });

  // Botón agregar usuario (solo demo)
  document.getElementById('btn-agregar-usuario').addEventListener('click', function() {
    alert('Función para agregar usuario (demo)');
  });
});
