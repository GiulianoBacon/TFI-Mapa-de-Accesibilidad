import React from 'react';
import Login from '../pages/Login'
import Home from '../pages/Home'
import SignUp from '../pages/SignUp'
import Mapa from '../pages/Mapa'
import Contact from '../pages/Contact'
import Error from '../pages/Error'
import {Routes, Route,Router} from 'react-router-dom'
import Header from '../components/header/Header';


const Routers = () => {
  return  <>
  <Routes>
      
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/*" element={<Error />} />

  </Routes>
  </>
};

export default Routers;