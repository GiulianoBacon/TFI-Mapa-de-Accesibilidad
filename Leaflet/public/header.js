function loadHeader() {
  return fetch('header.html')
      .then(response => response.text())
      .then(data => {
          document.getElementById('header-placeholder').innerHTML = data;
          if (localStorage.getItem('loggedIn') === 'true') {
              document.getElementById('signup-link').style.display = 'none';
              document.getElementById('login-link').style.display = 'none';
              document.getElementById('logout-container').style.display = 'inline';
          }

          const barsIcon = document.querySelector('.navbar .fa-bars');
          const menu = document.querySelector('.navbar .menu');

          if (barsIcon && menu) {
              barsIcon.addEventListener('click', function () {
                  menu.classList.toggle('menu-open');
                  barsIcon.classList.toggle('fa-bars');
                  barsIcon.classList.toggle('fa-xmark');
              });

              menu.querySelectorAll('a').forEach(function (link) {
                  link.addEventListener('click', function () {
                      menu.classList.remove('menu-open');
                      barsIcon.classList.add('fa-bars');
                      barsIcon.classList.remove('fa-xmark');
                  });
              });

              document.addEventListener('click', function (e) {
                  if (!barsIcon.contains(e.target) && !menu.contains(e.target)) {
                      menu.classList.remove('menu-open');
                      barsIcon.classList.add('fa-bars');
                      barsIcon.classList.remove('fa-xmark');
                  }
              });
          }
      })
      .catch(error => console.error('Error al cargar el header:', error));
}

function logout() {
  localStorage.removeItem('loggedIn');
  window.location.href = '/';
}