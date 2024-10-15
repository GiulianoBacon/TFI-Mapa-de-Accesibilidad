const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require("mysql2");
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "mapa"
});

app.use(session({  
    secret: 'mapa-accesibilidad-vial',
    resave: false,
    saveUninitialized: true
}));

// Manejar el evento de error de conexión
db.connect((err) => {
    if (err) {
        console.error("No se pudo conectar a la base de datos. Revisa que el servicio MySQL esté iniciado.");
        process.exit(1);
    } else {
        console.log("Conexión a la base de datos establecida.");
        
        // Iniciar el servidor solo si la conexión a la base de datos es exitosa
        app.listen(PORT, () => {
            console.log(`Servidor escuchando en http://localhost:${PORT}`);
        });
    }
});

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.post("/createOpinion_establecimiento", (req, res) => {
    const { latitud, longitud, Usuario_idUsuario, espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios } = req.body;
    console.log("guardando opinion");
    db.query(
        'INSERT INTO ubicación(latitud, longitud, direccion) VALUES (?, ?, ?);', 
                                            [latitud, longitud, "placeholder"], 
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: "Error al guardar la ubicacion de la opinión" }); // Enviar error al cliente
            }
            const Ubicación_idUbicación = result.insertId;
            db.query(
                'INSERT INTO opinion_establecimiento(Ubicación_idUbicación, Usuario_idUsuario, espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, curdate())', 
                                                    [Ubicación_idUbicación, Usuario_idUsuario, espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios], 
                (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).json({ error: "Error al guardar la opinión" }); // Enviar error al cliente
                    }
                    res.json({ message: "Opinión de establecimiento registrada con éxito" }); // Responder con un mensaje JSON
                }
            );
        }
    );
    
});

app.post("/create", (req, res) => {
    const { Email, Contraseña, Usuario } = req.body;

    bcrypt.hash(Contraseña, 10, (err, hash) => {  // El número 10 es el "salt rounds", ajustable para seguridad/performance
        if (err) {
            console.log(err);
            return res.status(500).json({ error: "Error al generar el hash de la contraseña" });
        }

        // Almacenar el hash en lugar de la contraseña original
        db.query('INSERT INTO usuario(email, contraseña, usuario) VALUES (?, ?, ?)', 
        [Email, hash, Usuario],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: "Error al registrar el usuario" });
            } else {
                res.send("Usuario registrado con éxito");
            }
        });
    });
});

app.get("/usuarios", (req, res) => {
    db.query('SELECT * FROM usuario', (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send(result);
        }
    });
});

// Ruta de login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { email, contraseña } = req.body;
  
    db.query('SELECT * FROM usuario WHERE email = ?', [email], async (error, results) => {
        if (error) return res.status(500).json({ success: false, message: 'Error en el servidor' });

        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(contraseña, user.contraseña);

            if (match) {
                req.session.authenticated = true;
                req.session.idUsuario = user.idUsuario;
                res.json({ success: true, message: 'Login exitoso' });
            } else {
                res.json({ success: false, message: 'Contraseña incorrecta' });
            }
        } else {
            res.json({ success: false, message: 'Usuario no encontrado' });
        }
    });
});

// Ruta para obtener todas las opiniones
app.get("/getOpinions", (req, res) => {
    const query = `
        SELECT 
            opinion_establecimiento.*,
            ubicación.latitud,
            ubicación.longitud,
            usuario.usuario AS nombreUsuario
        FROM 
            opinion_establecimiento
        INNER JOIN 
            ubicación ON opinion_establecimiento.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN 
            usuario ON opinion_establecimiento.Usuario_idUsuario = usuario.idUsuario
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).json({ error: "Error al obtener las opiniones" });
        } else {
            console.log(result);
            res.json(result);
        }
    });
});
