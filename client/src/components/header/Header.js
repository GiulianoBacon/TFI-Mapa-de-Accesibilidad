import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <div>
      <header className="header">
      <div className="container">
      <div className="header-logo">
          <img src={'https://upload.wikimedia.org/wikipedia/commons/f/f8/Universidad_Nacional_de_Lan%C3%BAs_logo.png'}className="logo-image" />
          <span className="logo-text">Mapa de Accesibilidad Colaborativo</span>
        </div>
        <nav className="nav">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/signup">Sign Up</Link></li>
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