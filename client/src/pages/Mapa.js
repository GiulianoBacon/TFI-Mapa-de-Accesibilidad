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
import { defaults as defaultControls } from 'ol/control.js';
import 'ol/ol.css';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { Icon, Style } from 'ol/style.js';

const Mapa = () => {
  const mapElement = useRef(null); // Referencia al div del mapa
  const mousePositionElement = useRef(null); // Referencia al div de la posición del mouse
  const searchInputRef = useRef(null); // Referencia al campo de búsqueda
  const mapRef = useRef(null); // Referencia a la instancia del mapa

  const [projection, setProjection] = useState('EPSG:4326');
  const [precision, setPrecision] = useState(4);
  const mousePositionControl = useRef(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]); // Estado para las sugerencias

  // Capa de vectores para los marcadores
  const markerLayer = useRef(new VectorLayer({
    source: new VectorSource(),
  }));

  useEffect(() => {
    if (!mapElement.current) return;
    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        markerLayer.current // Añadir la capa de marcadores al mapa
      ],
      view: new View({
        center: fromLonLat([-58.3920, -34.7334]), // Coordenadas iniciales
        zoom: 16, // Nivel de zoom inicial
      }),
    });

    mapRef.current = map; // Guardar la instancia del mapa en el ref

    mousePositionControl.current = new MousePosition({
      coordinateFormat: createStringXY(precision),
      projection: projection,
      target: mousePositionElement.current,
      undefinedHTML: '&nbsp;',
    });

    map.addControl(mousePositionControl.current);

    const handleMapDblClick = (event) => {
      setIsPopupOpen(true);
    };

    // Verifica la existencia de mapElement.current antes de agregar el eventListener
    mapElement.current.addEventListener('dblclick', handleMapDblClick);

    return () => {
      if (mapElement.current) {
        mapElement.current.removeEventListener('dblclick', handleMapDblClick);
      }
      // Limpiar el mapa al desmontar el componente
      map.setTarget(null);
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

  const handleSearch = async () => {
    const query = searchInputRef.current.value;
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (data.length > 0) {
      const [lon, lat] = [data[0].lon, data[0].lat];
      const coordinates = fromLonLat([parseFloat(lon), parseFloat(lat)]);
      if (mapRef.current) {
        mapRef.current.getView().setCenter(coordinates);
        mapRef.current.getView().setZoom(16); // Puedes ajustar el nivel de zoom

        // Añadir el marcador en la ubicación
        addMarker(coordinates);
      }
    } else {
      alert('No se encontraron resultados.');
    }
  };

  const addMarker = (coordinates) => {
    const marker = new Feature({
      geometry: new Point(coordinates),
    });

    marker.setStyle(new Style({
      image: new Icon({
        anchor: [0.5, 1],
        src: 'https://cdn-icons-png.flaticon.com/512/684/684850.png', // Cambia esto por la URL de tu icono
        scale: 0.07
      }),
    }));

    // Limpiar marcadores anteriores y añadir el nuevo
    markerLayer.current.getSource().clear();
    markerLayer.current.getSource().addFeature(marker);
  };

  const handleInputChange = async () => {
    const query = searchInputRef.current.value;
    if (query.length > 5) { // Solo buscar si el texto tiene más de 2 caracteres
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);  
          
    }
      const data = await response.json();
      setSuggestions(data); // Actualiza las sugerencias
    } 
    else {
      setSuggestions([]); // Limpiar las sugerencias si el texto es muy corto
    }
  };

  const handleSuggestionClick = (suggestion) => {
    searchInputRef.current.value = suggestion.display_name;
    handleSearch();
    setSuggestions([]); // Limpiar las sugerencias al seleccionar una
  };

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
      <div>
        <input
          type="text"
          placeholder="Buscar ubicación..."
          ref={searchInputRef}
          onChange={handleInputChange} // Actualiza sugerencias al escribir
          className="form-control"
        />
        <div className="button-container">
        <button onClick={handleSearch} className="btn btn-primary custom-button">
          Buscar
        </button>
      </div>
        {suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map((suggestion, index) => (
              <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                {suggestion.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>
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
                <label>¿Baños Apto?</label>
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
