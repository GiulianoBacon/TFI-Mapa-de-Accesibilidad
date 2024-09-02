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

// Ruta de login
app.post('/login', (req, res) => {
    const { email, contraseña } = req.body;
  
    if (!email || !contraseña) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
    }
  
    // Consulta a la base de datos para encontrar el usuario
    db.query('SELECT * FROM usuario WHERE email = ?', [email], (err, results) => {
      if (err) {
        console.error('Error en la consulta:', err);
        return res.status(500).json({ success: false, message: 'Error al intentar iniciar sesión' });
      }
  
      if (results.length > 0) {
        // Usuario encontrado, ahora verificar la contraseña
        const user = results[0];
        // En un entorno real, deberías usar bcrypt para comparar contraseñas hasheadas
        if (contraseña === user.contraseña) {
          res.json({ success: true, message: 'Login exitoso' });
        } else {
          res.json({ success: false, message: 'Email o contraseña incorrectos' });
        }
      } else {
        res.json({ success: false, message: 'Email o contraseña incorrectos' });
      }
    });
  });

app.listen(3001,()=>{
    console.log("Corriendo en el puerto 3001")
})
