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
    const { latitud, longitud, Usuario_idUsuario, nombre_establecimiento, espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, puntaje } = req.body;
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
                'INSERT INTO opinion_establecimiento(Ubicación_idUbicación, Usuario_idUsuario, nombre_establecimiento, espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, curdate())', 
                                                    [Ubicación_idUbicación, Usuario_idUsuario,  nombre_establecimiento, espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios], 
            
                (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).json({ error: "Error al guardar la opinión" }); // Enviar error al cliente
                    }

                    db.query(
                        'INSERT INTO puntaje_establecimiento (Usuario_idUsuario, Opinion_establecimiento_idOpinion, puntaje) VALUES (?, ?, ?);',
                        [Usuario_idUsuario, result.insertId, puntaje],
                        (err2, result2) => {
                            if (err2) {
                                console.log(err2);
                                // No detenemos la respuesta principal, solo logueamos el error
                            } else {
                                console.log("Puntaje registrado correctamente.");
                            }
                        }
                    );
                    res.json({ message: "Opinión de establecimiento registrada con éxito" }); // Responder con un mensaje JSON
                }
            );

            
        }
    );
    
});

// Ruta para crear una opinión sobre vereda pública
app.post("/createOpinion_vereda", (req, res) => {
    const { latitud, longitud, Usuario_idUsuario, vereda_apta, descripcion_vereda } = req.body;
    console.log("Guardando opinión de vereda pública");

    // Guardamos la ubicación en la tabla 'ubicación'
    db.query(
        'INSERT INTO ubicación(latitud, longitud, direccion) VALUES (?, ?, ?);', 
        [latitud, longitud, "placeholder"], 
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: "Error al guardar la ubicación de la opinión de vereda" });
            }
            
            // Obtenemos el id de la ubicación que se acaba de insertar
            const Ubicación_idUbicación = result.insertId;

            // Insertamos la opinión de la vereda pública en la tabla 'Opinion_vereda'
            db.query(
                'INSERT INTO Opinion_vereda(Ubicación_idUbicación, Usuario_idUsuario, vereda_apta, descripcion_vereda, fecha) VALUES (?, ?, ?, ?, curdate())',
                [Ubicación_idUbicación, Usuario_idUsuario, vereda_apta, descripcion_vereda],
                (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).json({ error: "Error al guardar la opinión de vereda pública" });
                    }
                    res.json({ message: "Opinión de vereda pública registrada con éxito" });
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
    ubicación.latitud,
    ubicación.longitud,
    opinion_establecimiento.nombre_establecimiento
FROM 
    ubicación
INNER JOIN 
    opinion_establecimiento 
ON 
    ubicación.idUbicación = opinion_establecimiento.Ubicación_idUbicación;
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


// Ruta para obtener todas las opiniones de un lugar
app.get('/getOpinion', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    const query = `
    SELECT 
        nombre_establecimiento,
        opinion_establecimiento.*,
        ubicación.latitud,
        ubicación.longitud,
        usuario.usuario AS nombreUsuario,
        puntaje_establecimiento.puntaje   -- <-- NUEVO: agregar puntaje
    FROM 
        opinion_establecimiento
    INNER JOIN 
        ubicación ON opinion_establecimiento.Ubicación_idUbicación = ubicación.idUbicación
    INNER JOIN 
        usuario ON opinion_establecimiento.Usuario_idUsuario = usuario.idUsuario
    LEFT JOIN
        puntaje_establecimiento ON puntaje_establecimiento.Opinion_establecimiento_idOpinion = opinion_establecimiento.idOpinion
        AND puntaje_establecimiento.Usuario_idUsuario = opinion_establecimiento.Usuario_idUsuario
    WHERE 
        ubicación.latitud = ` + lat + ` AND ubicación.longitud = ` + lng

    ;

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

app.get("/getOpinionsVereda", (req, res) => {
    const query = `
        SELECT 
            ubicación.latitud,
            ubicación.longitud,
            opinion_vereda.vereda_apta,
            opinion_vereda.descripcion_vereda,
            opinion_vereda.fecha,
            usuario.usuario AS nombreUsuario
        FROM 
            ubicación
        INNER JOIN 
            opinion_vereda ON ubicación.idUbicación = opinion_vereda.Ubicación_idUbicación
        INNER JOIN 
            usuario ON opinion_vereda.Usuario_idUsuario = usuario.idUsuario;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: "Error al obtener opiniones de vereda" });
        }
        res.json(result);
    });
});

app.get("/getOpinionVereda", (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    const query = `
        SELECT 
            opinion_vereda.*,
            ubicación.latitud,
            ubicación.longitud,
            usuario.usuario AS nombreUsuario
        FROM 
            opinion_vereda
        INNER JOIN 
            ubicación ON opinion_vereda.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN 
            usuario ON opinion_vereda.Usuario_idUsuario = usuario.idUsuario
        WHERE 
            ubicación.latitud = ? AND ubicación.longitud = ?;
    `;

    db.query(query, [lat, lng], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: "Error al obtener opiniones de vereda" });
        }
        res.json(result);
    });
});