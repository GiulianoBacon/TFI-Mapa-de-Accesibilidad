// header.js - versión segura sin localStorage
function loadHeader() {
    return fetch('header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
            return updateAuthState();
        })
        .catch(error => console.error('Error al cargar el header:', error));
}

function updateAuthState() {
    const signupLink = document.getElementById('signup-link');
    const loginLink = document.getElementById('login-link');
    const logoutContainer = document.getElementById('logout-container');
    const profileContainer = document.getElementById('profile-container');

    if (!signupLink || !loginLink || !logoutContainer || !profileContainer) {
        console.warn('Elementos del header no encontrados');
        return;
    }

    fetch('/api/me', { credentials: 'include' })
        .then(response => {
        if (response.ok) {
            signupLink.style.display = 'none';
            loginLink.style.display = 'none';
            logoutContainer.style.display = 'inline';
            profileContainer.style.display = 'inline';
        } else {
            signupLink.style.display = 'inline';
            loginLink.style.display = 'inline';
            logoutContainer.style.display = 'none';
            profileContainer.style.display = 'none';
        }
        })
        .catch(error => {
        console.error('Error verificando sesión:', error);
        signupLink.style.display = 'inline';
        loginLink.style.display = 'inline';
        logoutContainer.style.display = 'none';
        profileContainer.style.display = 'none';
        });
}

function logout() {
    fetch('/logout', { method: 'POST', credentials: 'include' })
        .then(() => window.location.href = '/')
        .catch(error => {
            console.error('Error al cerrar sesión:', error);
            window.location.href = '/';
        });
}

function refreshAuthState() {
    return updateAuthState();
}