import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
          <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <h2>Mapa de Accesibilidad Colaborativo</h2>
          </div>
          
          <div className="footer-info">
            <p>&copy; {new Date().getFullYear()} Mapa de Accesibilidad Colaborativo. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
    
  );
};

export default Footer;