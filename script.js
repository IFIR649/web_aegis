// ==============================
// Navegación entre vistas/secciones
// ==============================
document.querySelectorAll('.sidebar ul li').forEach(item => {
  item.addEventListener('click', function() {
    const sectionId = this.getAttribute('data-section');
    // Mostrar solo la sección seleccionada
    document.querySelectorAll('.vista-section').forEach(sec => {
      sec.style.display = (sec.id === sectionId) ? 'block' : 'none';
    });
    // Resaltar el ítem activo en el sidebar
    document.querySelectorAll('.sidebar ul li').forEach(li => li.classList.remove('active'));
    this.classList.add('active');
    // Inicializar gráficas y tablas al cambiar de sección
    handleSectionChange();
    handleTableSection();
    handleUsuariosSection();
  });
});

// ==============================
// Gráficas Chart.js para el Dashboard
// ==============================
function initCharts() {
  // Verifica si existen los canvas (puede que cambies de vista antes)
  const ctxBar = document.getElementById('barChart');
  const ctxLine = document.getElementById('lineChart');
  if (!ctxBar || !ctxLine) return;

  // Si ya existen, destruye las instancias previas para evitar bugs
  if (window.barChartInstance) window.barChartInstance.destroy();
  if (window.lineChartInstance) window.lineChartInstance.destroy();

  // Gráfica de barras
  window.barChartInstance = new Chart(ctxBar.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Enero', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      datasets: [{
        label: 'Consumo kWh',
        data: [320, 240, 260, 320, 350, 300],
        backgroundColor: 'rgba(37,99,235,0.7)', // color primario
        borderRadius: 8,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'var(--color-contrast)' } },
        y: { ticks: { color: 'var(--color-contrast)' } }
      }
    }
  });

  // Gráfica de líneas
  window.lineChartInstance = new Chart(ctxLine.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [{
        label: 'Consumo diario',
        data: [41, 56, 33, 45, 40, 60, 55],
        fill: false,
        borderColor: 'rgba(20,184,166,1)', // color-accent
        backgroundColor: 'rgba(20,184,166,0.2)',
        tension: 0.4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'var(--color-contrast)' } },
        y: { ticks: { color: 'var(--color-contrast)' } }
      }
    }
  });
}

// Inicializa las gráficas solo cuando se muestra el dashboard
function handleSectionChange() {
  const dashboard = document.getElementById('dashboard');
  if (dashboard && dashboard.style.display !== 'none') {
    setTimeout(initCharts, 0);
  }
}

// =======================
// Tabla de Histórico (Dashboard) con búsqueda y paginación
// =======================
const ROWS_PER_PAGE = 5;

function getAllTableRows() {
  const table = document.getElementById('main-table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tbody tr'));
}

function filterRows(rows, filter) {
  if (!filter) return rows;
  return rows.filter(row => row.innerText.toLowerCase().includes(filter));
}

function showRowsForPage(rows, page, rowsPerPage) {
  rows.forEach((row, idx) => {
    row.style.display = (idx >= (page-1)*rowsPerPage && idx < page*rowsPerPage) ? '' : 'none';
  });
}

function renderPaginationControls(totalRows, page, rowsPerPage, onPageChange) {
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const container = document.getElementById('table-pagination');
  if (!container) return;
  container.innerHTML = '';

  // Prev button
  const prev = document.createElement('button');
  prev.textContent = '«';
  prev.disabled = (page === 1);
  prev.onclick = () => onPageChange(page - 1);
  container.appendChild(prev);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.className = (i === page) ? 'active-page-btn' : '';
    b.onclick = () => onPageChange(i);
    container.appendChild(b);
  }

  // Next button
  const next = document.createElement('button');
  next.textContent = '»';
  next.disabled = (page === totalPages);
  next.onclick = () => onPageChange(page + 1);
  container.appendChild(next);
}

function setupTableSearchAndPagination() {
  const input = document.getElementById('table-search');
  const table = document.getElementById('main-table');
  const pagination = document.getElementById('table-pagination');
  if (!input || !table || !pagination) return;

  let filter = '';
  let currentPage = 1;
  let filteredRows = [];

  function updateTable() {
    const allRows = getAllTableRows();
    filteredRows = filterRows(allRows, filter);
    const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;
    // Corregir la página si la búsqueda reduce el número de páginas
    if (currentPage > totalPages) currentPage = totalPages;
    showRowsForPage(filteredRows, currentPage, ROWS_PER_PAGE);
    renderPaginationControls(filteredRows.length, currentPage, ROWS_PER_PAGE, (newPage) => {
      currentPage = newPage;
      showRowsForPage(filteredRows, currentPage, ROWS_PER_PAGE);
      renderPaginationControls(filteredRows.length, currentPage, ROWS_PER_PAGE, arguments.callee);
    });
  }

  input.addEventListener('keyup', function () {
    filter = input.value.toLowerCase();
    currentPage = 1; // reset page on new search
    updateTable();
  });

  // Inicializar la tabla/paginación al cargar
  updateTable();
}

// Inicializa búsqueda y paginación solo cuando el dashboard esté visible
function handleTableSection() {
  const dashboardSection = document.getElementById('dashboard');
  if (dashboardSection && dashboardSection.style.display !== 'none') {
    setupTableSearchAndPagination();
  }
}

// =======================
// Tabla de Usuarios con búsqueda y paginación
// =======================
const USUARIOS_PER_PAGE = 5;

function getAllUsuarioRows() {
  const table = document.getElementById('usuarios-table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tbody tr'));
}

function filterUsuarioRows(rows, filter) {
  if (!filter) return rows;
  return rows.filter(row => row.innerText.toLowerCase().includes(filter));
}

function showUsuariosForPage(rows, page, rowsPerPage) {
  rows.forEach((row, idx) => {
    row.style.display = (idx >= (page-1)*rowsPerPage && idx < page*rowsPerPage) ? '' : 'none';
  });
}

function renderUsuariosPagination(totalRows, page, rowsPerPage, onPageChange) {
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const container = document.getElementById('usuarios-pagination');
  if (!container) return;
  container.innerHTML = '';

  // Prev button
  const prev = document.createElement('button');
  prev.textContent = '«';
  prev.disabled = (page === 1);
  prev.onclick = () => onPageChange(page - 1);
  container.appendChild(prev);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.className = (i === page) ? 'active-page-btn' : '';
    b.onclick = () => onPageChange(i);
    container.appendChild(b);
  }

  // Next button
  const next = document.createElement('button');
  next.textContent = '»';
  next.disabled = (page === totalPages);
  next.onclick = () => onPageChange(page + 1);
  container.appendChild(next);
}

function setupUsuariosSearchAndPagination() {
  const input = document.getElementById('usuarios-search');
  const table = document.getElementById('usuarios-table');
  const pagination = document.getElementById('usuarios-pagination');
  if (!input || !table || !pagination) return;

  let filter = '';
  let currentPage = 1;
  let filteredRows = [];

  function updateUsuariosTable() {
    const allRows = getAllUsuarioRows();
    filteredRows = filterUsuarioRows(allRows, filter);
    const totalPages = Math.ceil(filteredRows.length / USUARIOS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    showUsuariosForPage(filteredRows, currentPage, USUARIOS_PER_PAGE);
    renderUsuariosPagination(filteredRows.length, currentPage, USUARIOS_PER_PAGE, (newPage) => {
      currentPage = newPage;
      showUsuariosForPage(filteredRows, currentPage, USUARIOS_PER_PAGE);
      renderUsuariosPagination(filteredRows.length, currentPage, USUARIOS_PER_PAGE, arguments.callee);
    });
  }

  input.addEventListener('keyup', function () {
    filter = input.value.toLowerCase();
    currentPage = 1; // reset page on new search
    updateUsuariosTable();
  });

  // Inicializar tabla/paginación al cargar
  updateUsuariosTable();
}

// Solo inicializar búsqueda/paginación si la sección de usuarios está visible
function handleUsuariosSection() {
  const usuariosSection = document.getElementById('usuarios');
  if (usuariosSection && usuariosSection.style.display !== 'none') {
    setupUsuariosSearchAndPagination();
  }
}

// Al cargar la página, inicializar gráficas y tablas
window.addEventListener('DOMContentLoaded', () => {
  handleSectionChange();
  handleTableSection();
  handleUsuariosSection();
});
