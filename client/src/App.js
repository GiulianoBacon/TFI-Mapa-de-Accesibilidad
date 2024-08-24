import './App.css'
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

import Layout from './layout/Layout';


function App() {

    return (

    <>

    <Layout />
     
  </>
  );
}

export default App;
