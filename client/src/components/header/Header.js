import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <div>
      <header className="header">
      <div className="container">
      <div className="header-logo">
          <img src={'https://www.unla.edu.ar/images/logo_web.jpg'}className="logo-image" />
          <span className="logo-text">Mapa de Accesibilidad Colaborativo</span>
        </div>
        <nav className="nav">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/signup">Signup</Link></li>
            <li><Link to="/mapa">Mapa</Link></li>
            <li><Link to="/contact">Contacto</Link></li>
          </ul>
        </nav>
      </div>
    </header>
    </div>
  );
};

export default Header;