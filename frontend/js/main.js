const usuarios = [
  { usuario: 'admin', password: 'admin123' },
  { usuario: 'test',  password: '1234' }
];

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();
  const encontrado = usuarios.find(u => u.usuario === user && u.password === pass);
  if (encontrado) {
    window.location.href = "views/dashboard.html";
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
});
