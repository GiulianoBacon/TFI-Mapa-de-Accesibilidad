function loadHeader() {
  fetch('header.html')
      .then(response => response.text())
      .then(data => {
          document.getElementById('header-placeholder').innerHTML = data;

          // Verificar el estado de sesión
          if (localStorage.getItem('loggedIn') === 'true') {
              // Ocultar los enlaces de "Registrarse" y "Iniciar sesión"
              document.getElementById('signup-link').style.display = 'none';
              document.getElementById('login-link').style.display = 'none';

              // Mostrar el botón de Cerrar Sesión
              document.getElementById('logout-container').style.display = 'inline';
          }
      })
      .catch(error => console.error('Error al cargar el header:', error));
}

function logout() {
  // Eliminar el estado de sesión
  localStorage.removeItem('loggedIn');
  // Redirigir al usuario a la página de inicio o login
  window.location.href = '/';
}