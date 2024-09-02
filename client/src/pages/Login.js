import React, { useState } from 'react';
import Axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // Hook para la redirección

  const handleLogin = async (event) => {
    event.preventDefault();
    
    try {
      const response = await Axios.post('http://localhost:3001/login', {
        email,
        contraseña
      });
      
      if (response.data.success) {
        setMessage('Login exitoso');
        navigate('/'); // Redirige a la página de inicio
        
      } else {
        setMessage(response.data.message);
      }
    } catch (error) {
      console.error('Error al intentar iniciar sesión:', error);
      setMessage('Hubo un error al intentar iniciar sesión. Por favor, inténtelo de nuevo.');
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-75 mt-5 mb-5">
      <div className="card text-center card-custom"> {/* Usa la clase CSS personalizada */}
        <div className="card-header">
          Iniciar Sesión
        </div>
        <div className="card-body">
          <form onSubmit={handleLogin}>
            <div className="input-group mb-3">
              <span className="input-group-text" id="basic-addon1">Email:</span>
              <input
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                className="form-control"
                placeholder="Ingrese su dirección de email"
                aria-label="Email"
                aria-describedby="basic-addon1"
                required
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
                required
              />
            </div>
            <button type="submit" className="btn btn-success mt-3">Iniciar Sesión</button>
          </form>
          {message && <div className="mt-3">{message}</div>}
        </div>
      </div>
    </div>
  );
};

export default Login;
