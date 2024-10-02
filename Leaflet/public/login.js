document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const messageDiv = document.getElementById('message');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const contraseña = document.getElementById('contraseña').value;

        try {
            const response = await fetch('http://localhost:3001/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, contraseña })
            });

            const data = await response.json();

            if (data.success) {
                messageDiv.textContent = 'Login exitoso';
                // Redirigir a la página de inicio
                window.location.href = '/';
            } else {
                messageDiv.textContent = data.message;
            }
        } catch (error) {
            console.error('Error al intentar iniciar sesión:', error);
            messageDiv.textContent = 'Hubo un error al intentar iniciar sesión. Por favor, inténtelo de nuevo.';
        }
    });
});
