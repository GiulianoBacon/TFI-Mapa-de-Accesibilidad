const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

async function handleRegistrar() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const username = document.getElementById('username').value;

  if (!validateEmail(email)) {
    alert("Por favor ingrese una dirección de correo electrónico válida.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Las contraseñas no coinciden. Por favor, inténtelo de nuevo.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3001/create", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Email: email,
        Contraseña: password,
        Usuario: username
      })
    });

    if (response.ok) {
      alert("Usuario registrado");
      getUsuarios();
    } else {
      alert("Error al registrar el usuario.");
    }
  } catch (error) {
    alert("Ocurrió un error: " + error.message);
  }
};

async function getUsuarios() {
  try {
    const response = await fetch("http://localhost:3001/usuarios");
    const data = await response.json();
    console.log(data);
  } catch (error) {
    alert("Error al obtener los usuarios: " + error.message);
  }
};

