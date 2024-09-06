import React from 'react';
import '../App.css'; // Importa el archivo CSS para estilos personalizados

const Home = () => {
  return (
    <div className="home-container">
      <div className="overlay">
        <div className="content text-center">
          <h1 className="title">Bienvenido a Mapa de Accesibilidad Colaborativo</h1>
          <p className="description">
            Mapa de Accesibilidad Colaborativo es una plataforma colaborativa diseñada para personas con movilidad reducida. 
            Aquí podrás explorar un mapa interactivo donde otros usuarios han compartido reseñas 
            sobre la accesibilidad de diversos establecimientos y de veredas públicas. ¡Ayuda a otros compartiendo tu experiencia!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
