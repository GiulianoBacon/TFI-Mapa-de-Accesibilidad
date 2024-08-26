import '../App.css';
import { useState, useEffect, useRef } from 'react';
import Axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import Map from 'ol/Map.js';
import MousePosition from 'ol/control/MousePosition.js';
import OSM from 'ol/source/OSM.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import { createStringXY } from 'ol/coordinate.js';
import {defaults as defaultControls} from 'ol/control.js';
import 'ol/ol.css';
import { fromLonLat } from 'ol/proj';




const Mapa = () => {

  const mapElement = useRef(null); // Referencia al div del mapa
  const mousePositionElement = useRef(null); // Referencia al div de la posición del mouse

  const [projection, setProjection] = useState('EPSG:4326');
  const [precision, setPrecision] = useState(4);
  const mousePositionControl = useRef(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

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

    const handleMapDblClick = () => {
      setIsPopupOpen(true);
    };
    mapElement.current.addEventListener('dblclick', handleMapDblClick);

    return () => {
      map.setTarget(null); // Limpiar el mapa al desmontar el componente
      mapElement.current.removeEventListener('dblclick', handleMapDblClick);
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



  const closePopup = () => setIsPopupOpen(false);

  const [Ubicación_idUbicación, setUbicación_idUbicación] = useState(1);
  const [Usuario_idUsuario, setUsuario_idUsuario] = useState(1);
  const [espacios_aptos, setEspacios_aptos] = useState(false);
  const [ascensor_apto, setAscensor_apto] = useState(false);
  const [baños_aptos, setBaños_aptos] = useState(false);
  const [puerta_apta, setPuerta_apta] = useState(false);
  const [rampa_interna_apta, setRampa_interna_apta] = useState(false);
  const [rampa_externa_apta, setRampa_externa_apta] = useState(false);
  const [descripcion_rampa_interna, setDescripcion_rampa_interna] = useState("");
  const [descripcion_ascensor, setDescripcion_ascensor] = useState("");
  const [descripcion_rampa_externa, setDescripcion_rampa_externa] = useState("");
  const [descripcion_espacios, setDescripcion_espacios] = useState("");

  const addOpinion_establecimiento = (event) => {
    event.preventDefault();
    Axios.post("http://localhost:3001/createOpinion_establecimiento", {
      Ubicación_idUbicación,
      Usuario_idUsuario,
      espacios_aptos,
      ascensor_apto,
      baños_aptos,
      puerta_apta,
      rampa_interna_apta,
      rampa_externa_apta,
      descripcion_rampa_interna,
      descripcion_ascensor,
      descripcion_rampa_externa,
      descripcion_espacios
    }).then(() => {
      alert("Opinión registrada");
      closePopup(); // Cerrar popup después de enviar
    });
  };

  return (
    <div>
      <div ref={mapElement} className="map"></div>
      <div ref={mousePositionElement} id="mouse-position"></div>

      {isPopupOpen && (
        <div className="popup-overlay">
          <div className="popup-form">
            <form onSubmit={addOpinion_establecimiento}>
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  name="espacios_aptos"
                  checked={espacios_aptos}
                  onChange={(event) => setEspacios_aptos(event.target.checked)}
                />
                <label>¿Espacios aptos?</label>
              </div>
              <label>Descripción espacios:</label>
              <input
                type="text"
                name="descripcion_espacios"
                value={descripcion_espacios}
                onChange={(event) => setDescripcion_espacios(event.target.value)}
                className="form-control"
              />
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  name="ascensor_apto"
                  checked={ascensor_apto}
                  onChange={(event) => setAscensor_apto(event.target.checked)}
                />
                <label>¿Ascensor Apto?</label>
              </div>
              <label>Descripción ascensor:</label>
              <input
                type="text"
                name="descripcion_ascensor"
                value={descripcion_ascensor}
                onChange={(event) => setDescripcion_ascensor(event.target.value)}
                className="form-control"
              />
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  name="baños_aptos"
                  checked={baños_aptos}
                  onChange={(event) => setBaños_aptos(event.target.checked)}
                />
                <label>¿Baño Apto?</label>
              </div>
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  name="puerta_apta"
                  checked={puerta_apta}
                  onChange={(event) => setPuerta_apta(event.target.checked)}
                />
                <label>¿Puerta Apta?</label>
              </div>
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  name="rampa_interna_apta"
                  checked={rampa_interna_apta}
                  onChange={(event) => setRampa_interna_apta(event.target.checked)}
                />
                <label>¿Rampa Interna Apta?</label>
              </div>
              <label>Descripción rampa interna:</label>
              <input
                type="text"
                name="descripcion_rampa_interna"
                value={descripcion_rampa_interna}
                onChange={(event) => setDescripcion_rampa_interna(event.target.value)}
                className="form-control"
              />
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  name="rampa_externa_apta"
                  checked={rampa_externa_apta}
                  onChange={(event) => setRampa_externa_apta(event.target.checked)}
                />
                <label>¿Rampa Externa Apta?</label>
              </div>
              <label>Descripción rampa externa:</label>
              <input
                type="text"
                name="descripcion_rampa_externa"
                value={descripcion_rampa_externa}
                onChange={(event) => setDescripcion_rampa_externa(event.target.value)}
                className="form-control"
              />
              <button type="submit" className="btn btn-success">
                Enviar
              </button>
              <button type="button" onClick={closePopup} className="btn btn-secondary">
                Cerrar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mapa;