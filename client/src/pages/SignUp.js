import React from 'react';
import '../App.css';
import { useState } from "react";
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'ol/ol.css';

const SignUp = () => {
  const [Email, setEmail] = useState("");
  const [Contraseña, setContraseña] = useState("");
  const [ConfirmarContraseña, setConfirmarContraseña] = useState("");
  const [Usuario, setUsuario] = useState("");
  const [usuariosLista, setUsuarios] = useState([]);

  const validateEmail = (email) => {
    // Expresión regular para validar correos electrónicos básicos
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  
  }

  const add = () => {

    if (!validateEmail(Email)) {
      alert("Por favor ingrese una dirección de correo electrónico válida.");
      return;
    }

    if (Contraseña !== ConfirmarContraseña) {
      alert("Las contraseñas no coinciden. Por favor, inténtelo de nuevo.");
      return;
    }

    Axios.post("http://localhost:3001/create", {
      Email: Email,
      Contraseña: Contraseña, // Solo se envía la contraseña original
      Usuario: Usuario
    }).then(() => {
      alert("Usuario registrado");
      getUsuarios();
    });
  };

  const getUsuarios = () => {
    Axios.get("http://localhost:3001/usuarios").then((response) => {
      setUsuarios(response.data);
    });
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-75 mt-5 mb-5">
  <div className="card text-center card-custom"> {/* Usa la clase CSS personalizada */}
    <div className="card-header">
      Gestión de Usuarios
    </div>
    <div className="card-body">
      <div className="input-group mb-3">
        <span className="input-group-text" id="basic-addon1">Email:</span>
        <input
          type="email"
          onChange={(event) => setEmail(event.target.value)}
          className="form-control"
          placeholder="Ingrese su dirección de email"
          aria-label="Email"
          aria-describedby="basic-addon1"
        />
      </div>
      <div className="input-group mb-3">
        <span className="input-group-text" id="basic-addon1">Contraseña:</span>
        <input
          type="password"
          onChange={(event) => setContraseña(event.target.value)}
          className="form-control"
          placeholder="Ingrese su contraseña"
          aria-label="Contraseña"
          aria-describedby="basic-addon1"
        />
      </div>
      <div className="input-group mb-3">
        <span className="input-group-text" id="basic-addon1">Confirmar Contraseña:</span>
        <input
          type="password"
          onChange={(event) => setConfirmarContraseña(event.target.value)}
          className="form-control"
          placeholder="Confirme su contraseña"
          aria-label="ConfirmarContraseña"
          aria-describedby="basic-addon1"
        />
      </div>
      <div className="input-group mb-3">
        <span className="input-group-text" id="basic-addon1">Usuario:</span>
        <input
          type="text"
          onChange={(event) => setUsuario(event.target.value)}
          className="form-control"
          placeholder="Ingrese su usuario"
          aria-label="Usuario"
          aria-describedby="basic-addon1"
        />
      </div>
      <button className="btn btn-success mt-3" onClick={add}>Registrar</button>
    </div>
  </div>
</div>
  );
};

export default SignUp;