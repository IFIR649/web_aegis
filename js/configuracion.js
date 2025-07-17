window.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('config-form');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Cambios guardados (demo, sin backend).');
  });

  // Demo: Cambio de tema solo front
  document.getElementById('config-theme').addEventListener('change', function() {
    if (this.value === 'light') {
      document.body.classList.remove('dark-dashboard-bg');
      document.body.style.background = '#f3f6fc';
      document.body.style.color = '#181b25';
    } else {
      document.body.classList.add('dark-dashboard-bg');
      document.body.style.background = '';
      document.body.style.color = '';
    }
  });
});
