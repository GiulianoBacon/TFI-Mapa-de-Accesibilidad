import './App.css';
import { useState } from "react";
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';

import Map from 'ol/Map.js';
import MousePosition from 'ol/control/MousePosition.js';
import OSM from 'ol/source/OSM.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import {createStringXY} from 'ol/coordinate.js';
import {defaults as defaultControls} from 'ol/control.js';

import React, {useEffect, useRef } from 'react';
import 'ol/ol.css';
import { fromLonLat } from 'ol/proj';



function App() {

  const mapElement = useRef(null); // Referencia al div del mapa
  const mousePositionElement = useRef(null); // Referencia al div de la posición del mouse

  const [projection, setProjection] = useState('EPSG:4326');
  const [precision, setPrecision] = useState(4);
  const mousePositionControl = useRef(null);

  useEffect(() => {
    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    mousePositionControl.current = new MousePosition({
      coordinateFormat: createStringXY(precision),
      projection: projection,
      target: mousePositionElement.current,
      undefinedHTML: '&nbsp;',
    });

    map.addControl(mousePositionControl.current);

    return () => {
      map.setTarget(null); // Limpiar el mapa al desmontar el componente
    };
  }, []);

  useEffect(() => {
    if (mousePositionControl.current) {
      mousePositionControl.current.setProjection(projection);
    }
  }, [projection]);

  useEffect(() => {
    if (mousePositionControl.current) {
      const format = createStringXY(precision);
      mousePositionControl.current.setCoordinateFormat(format);
    }
  }, [precision]);




  const [Email,setEmail] = useState("");
  const [Contraseña,setContraseña] = useState("");
  const [Usuario,setUsuario] = useState("");

  const [usuariosLista,setUsuarios] = useState([]);
  
  const add = ()=>{
    Axios.post("http://localhost:3001/create",{
    Email:Email,
    Contraseña:Contraseña,
    Usuario:Usuario
  }).then(()=>{
        alert("Usuario registrado")
        getUsuarios();
  })
  }
  const getUsuarios = ()=>{
    Axios.get("http://localhost:3001/usuarios",{
  }).then((response)=>{
    setUsuarios(response.data);
  })
  }
  return (
    <div className="container">
    
         <div className="card text-center">
    <div className="card-header">
      Gestión de Usuarios
    </div>
    <div className="card-body">
    <div>
      <div ref={mapElement} className="map"></div>
      <div ref={mousePositionElement} id="mouse-position"></div>
      <form>
        <label htmlFor="projection">Projection </label>
        <select
          id="projection"
          value={projection}
          onChange={(e) => setProjection(e.target.value)}
        >
          <option value="EPSG:4326">EPSG:4326</option>
          <option value="EPSG:3857">EPSG:3857</option>
        </select>
        <label htmlFor="precision">Precision</label>
        <input
          id="precision"
          type="number"
          min="0"
          max="12"
          value={precision}
          onChange={(e) => setPrecision(Number(e.target.value))}
        />
      </form>
    </div>
        <div className="input-group mb-3">
      <span className="input-group-text" id="basic-addon1">Email:</span>
      <input type="text" 
      onChange={(event)=> {
            setEmail(event.target.value);
          }}
      className="form-control" placeholder="Ingrese su dirección de email" aria-label="Email" aria-describedby="basic-addon1"/>
    </div>
    <div className="input-group mb-3">
      <span className="input-group-text" id="basic-addon1">Contraseña:</span>
        <input type="text" 
        onChange={(event)=> {
              setContraseña(event.target.value);
            }}
            className="form-control" placeholder="Ingrese su contraseña" aria-label="Contraseña" aria-describedby="basic-addon1"/>
    </div>
    <div className="input-group mb-3"></div>
      <span className="input-group-text" id="basic-addon1">Usuario:</span>
            <input type="text"
            onChange={(event)=> {
                  setUsuario(event.target.value);
                }}
            className="form-control" placeholder="Ingrese su usuario" aria-label="Usuario" aria-describedby="basic-addon1"/>
    </div>
    </div>
    <div className="card-footer text-body-secondary">
    <button className="btn btn-success" onClick={add}>Registrar</button>
    </div>
    <table className="table table-striped-columns">
    <thead>
    <tr>
      <th scope="col">#</th>
      <th scope="col">Email</th>
      <th scope="col">Contraseña</th>
      <th scope="col">Usuario</th>
    </tr>
  </thead>
  <tbody>
      {
          usuariosLista.map((val,key)=>{
            return <tr key={val.idUsuario}>
                      <th scope="row">{val.idUsuario}</th>
                      <td>{val.email}</td>
                      <td>{val.contraseña}</td>
                      <td>{val.usuario}</td>
                    </tr>
            
          })

        }
    
    
  </tbody>

    </table>
  </div>
    
  );
}

export default App;
