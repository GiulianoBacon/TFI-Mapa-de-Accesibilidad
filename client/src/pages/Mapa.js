import '../App.css'
import { useState } from "react";
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import Map from 'ol/Map.js';
import MousePosition from 'ol/control/MousePosition.js';
import OSM from 'ol/source/OSM.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import {createStringXY} from 'ol/coordinate.js';
import {defaults as defaultControls} from 'ol/control.js';
import {useEffect, useRef } from 'react';
import 'ol/ol.css';
import { fromLonLat } from 'ol/proj';




const Mapa = () => {

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




  return (
    
     <div>
      <div ref={mapElement} className="map"></div>
      <div ref={mousePositionElement} id="mouse-position"></div>
    </div>

  );
};

export default Mapa;