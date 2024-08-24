import React from 'react';
import '../App.css';
import { useState } from "react";
import Axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'ol/ol.css';

const SignUp = () => {

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
    <div>
      <div className="container">
    
    <div className="card text-center">
<div className="card-header">
 Gestión de Usuarios
</div>
<div className="card-body">
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
    </div>
  );
};

export default SignUp;