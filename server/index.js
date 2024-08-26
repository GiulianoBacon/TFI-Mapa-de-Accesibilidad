const express = require ("express");
const app = express();
const mysql = require ("mysql2");
const cors = require ("cors");

app.use(cors());
app.use(express.json());
const db = mysql.createConnection({
    host:"localhost",
    user: "root",
    password: "root",
    database: "mapa"

});


app.post("/createOpinion_establecimiento",(req, res)=>{
    const Ubicación_idUbicación = req.body.Ubicación_idUbicación;
    const Usuario_idUsuario = req.body.Usuario_idUsuario;
    const espacios_aptos = req.body.espacios_aptos;
    const ascensor_apto = req.body.ascensor_apto;
    const baños_aptos = req.body.baños_aptos;
    const puerta_apta = req.body.puerta_apta;
    const rampa_interna_apta = req.body.rampa_interna_apta;
    const rampa_externa_apta = req.body.rampa_externa_apta;
    const descripcion_rampa_interna = req.body.descripcion_rampa_interna;
    const descripcion_ascensor = req.body.descripcion_ascensor;
    const descripcion_rampa_externa = req.body.descripcion_rampa_externa;
    const descripcion_espacios = req.body.descripcion_espacios;
    
    db.query('INSERT INTO opinion_establecimiento(Ubicación_idUbicación,Usuario_idUsuario,espacios_aptos,ascensor_apto,baños_aptos,puerta_apta,rampa_interna_apta,rampa_externa_apta,descripcion_rampa_interna,descripcion_ascensor,descripcion_rampa_externa,descripcion_espacios,fecha) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,curdate())',[Ubicación_idUbicación,Usuario_idUsuario,espacios_aptos,ascensor_apto,baños_aptos,puerta_apta,rampa_interna_apta,rampa_externa_apta,descripcion_rampa_interna,descripcion_ascensor,descripcion_rampa_externa,descripcion_espacios],(err, result)=>{
        if(err){
            console.log(err);
        } else {
            res.send("Opinion de establecimiento registrada con éxito");
        }
    })
});

app.post("/create",(req, res)=>{
    const Email = req.body.Email;
    const Contraseña = req.body.Contraseña;
    const Usuario = req.body.Usuario;

    db.query('INSERT INTO usuario(email,contraseña,usuario) VALUES (?,?,?)',[Email,Contraseña,Usuario],(err, result)=>{
        if(err){
            console.log(err);
        } else {
            res.send("Usuario registrado con éxito");
        }
    })
});

app.get("/usuarios",(req, res)=>{
    
    db.query('SELECT * FROM usuario',(err, result)=>{
        if(err){
            console.log(err);
        } else {
            res.send(result);
        }
    })
});

app.listen(3001,()=>{
    console.log("Corriendo en el puerto 3001")
})
