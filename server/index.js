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
