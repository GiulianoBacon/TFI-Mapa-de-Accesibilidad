const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require("mysql2");
const bcrypt = require('bcrypt');
const https = require('https');

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

db.connect((err) => {
    if (err) {
        console.error("No se pudo conectar a la base de datos. Revisa que el servicio MySQL esté iniciado.");
        process.exit(1);
    } else {
        console.log("Conexión a la base de datos establecida.");
        app.listen(PORT, () => {
            console.log(`Servidor escuchando en http://localhost:${PORT}`);
        });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// PROXY PARA OVERPASS (evita CORS en el browser)
// Cache en memoria: wayId -> { wayId, name, coords }
// ─────────────────────────────────────────────
const overpassCache = {};

app.get('/getWayForPoint', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'lat y lng son requeridos' });
    }

    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (overpassCache[cacheKey]) {
        return res.json(overpassCache[cacheKey]);
    }

    const radio = 30;
    const query = `[out:json][timeout:10];way(around:${radio},${lat},${lng})["highway"];out geom;`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;

    https.get(url, { headers: { 'User-Agent': 'MapaAccesibilidad/1.0' } }, (overpassRes) => {
        let rawData = '';
        overpassRes.on('data', chunk => rawData += chunk);
        overpassRes.on('end', () => {
            try {
                const data = JSON.parse(rawData);

                if (!data.elements || data.elements.length === 0) {
                    overpassCache[cacheKey] = null;
                    return res.json(null);
                }

                // Elegir el way más cercano al punto
                let bestWay = null;
                let bestDist = Infinity;
                data.elements.forEach(way => {
                    if (!way.geometry || way.geometry.length === 0) return;
                    // Distancia mínima de cualquier nodo del way al punto
                    way.geometry.forEach(node => {
                        const d = Math.hypot(node.lat - lat, node.lon - lng);
                        if (d < bestDist) {
                            bestDist = d;
                            bestWay = way;
                        }
                    });
                });

                if (!bestWay) {
                    overpassCache[cacheKey] = null;
                    return res.json(null);
                }

                const result = {
                    wayId: bestWay.id,
                    name: (bestWay.tags && bestWay.tags.name) ? bestWay.tags.name : 'Calle sin nombre',
                    coords: bestWay.geometry.map(n => [n.lat, n.lon])
                };

                overpassCache[cacheKey] = result;
                res.json(result);

            } catch (e) {
                console.error('Error parseando respuesta de Overpass:', e.message);
                res.status(500).json({ error: 'Error procesando respuesta de Overpass' });
            }
        });
    }).on('error', (e) => {
        console.error('Error llamando a Overpass:', e.message);
        res.status(500).json({ error: 'Error contactando Overpass' });
    });
});

// ─────────────────────────────────────────────
// RUTAS EXISTENTES
// ─────────────────────────────────────────────

app.post("/createOpinion_establecimiento", (req, res) => {
    const {
        latitud, longitud, Usuario_idUsuario, nombre_establecimiento,
        espacios_aptos, ascensor_apto, baños_aptos, puerta_apta,
        rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna,
        descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, puntaje
    } = req.body;

    const radio = 0.0002;

    const buscarUbicacion = `
        SELECT ubicación.idUbicación
        FROM ubicación
        INNER JOIN opinion_establecimiento ON ubicación.idUbicación = opinion_establecimiento.Ubicación_idUbicación
        WHERE LOWER(opinion_establecimiento.nombre_establecimiento) = LOWER(?)
        AND ABS(ubicación.latitud - ?) < ?
        AND ABS(ubicación.longitud - ?) < ?
        LIMIT 1
    `;

    db.query(buscarUbicacion, [nombre_establecimiento, latitud, radio, longitud, radio], (err, existentes) => {
        if (err) { console.log(err); return res.status(500).json(err); }

        const guardarOpinion = (idUbicacion) => {
            db.query(`
                INSERT INTO opinion_establecimiento(
                    Ubicación_idUbicación, Usuario_idUsuario, nombre_establecimiento,
                    espacios_aptos, ascensor_apto, baños_aptos, puerta_apta,
                    rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna,
                    descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, fecha
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURDATE())
            `,
            [idUbicacion, Usuario_idUsuario, nombre_establecimiento, espacios_aptos,
             ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta,
             descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa,
             descripcion_espacios],
            (err, result) => {
                if (err) { console.log(err); return res.status(500).json(err); }

                const idOpinion = result.insertId;
                db.query(
                    `INSERT INTO puntaje_establecimiento(Usuario_idUsuario, Opinion_establecimiento_idOpinion, puntaje) VALUES(?,?,?)`,
                    [Usuario_idUsuario, idOpinion, puntaje],
                    (err) => {
                        if (err) { console.log(err); return res.status(500).json(err); }
                        res.json({ message: "Opinión registrada" });
                    }
                );
            });
        };

        if (existentes.length > 0) {
            guardarOpinion(existentes[0].idUbicación);
        } else {
            db.query(
                `INSERT INTO ubicación(latitud, longitud, direccion) VALUES(?,?,'placeholder')`,
                [latitud, longitud],
                (err, result) => {
                    if (err) { console.log(err); return res.status(500).json(err); }
                    guardarOpinion(result.insertId);
                }
            );
        }
    });
});

app.post("/createOpinion_vereda", (req, res) => {
    const { latitud, longitud, Usuario_idUsuario, vereda_apta, descripcion_vereda, direccion } = req.body;

    db.query(
        'INSERT INTO ubicación(latitud, longitud, direccion) VALUES (?, ?, ?);',
        [latitud, longitud, direccion],
        (err, result) => {
            if (err) { console.log(err); return res.status(500).json({ error: "Error al guardar la ubicación" }); }

            const Ubicación_idUbicación = result.insertId;
            db.query(
                'INSERT INTO Opinion_vereda(Ubicación_idUbicación, Usuario_idUsuario, vereda_apta, descripcion_vereda, fecha) VALUES (?, ?, ?, ?, curdate())',
                [Ubicación_idUbicación, Usuario_idUsuario, vereda_apta, descripcion_vereda],
                (err) => {
                    if (err) { console.log(err); return res.status(500).json({ error: "Error al guardar la opinión" }); }
                    res.json({ message: "Opinión de vereda registrada con éxito" });
                }
            );
        }
    );
});

app.post("/create", (req, res) => {
    const { Email, Contraseña, Usuario } = req.body;
    bcrypt.hash(Contraseña, 10, (err, hash) => {
        if (err) return res.status(500).json({ success: false, error: "Error al generar hash" });
        db.query('INSERT INTO usuario(email, contraseña, usuario) VALUES (?, ?, ?)', [Email, hash, Usuario], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: "Error al registrar usuario" });
            req.session.authenticated = true;
            req.session.idUsuario = result.insertId;
            res.json({ success: true, message: "Usuario registrado y logueado con éxito" });
        });
    });
});

app.get("/usuarios", (req, res) => {
    db.query('SELECT * FROM usuario', (err, result) => {
        if (err) { console.log(err); } else { res.send(result); }
    });
});

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

app.get("/getOpinions", (req, res) => {
    const query = `
        SELECT ubicación.latitud, ubicación.longitud, opinion_establecimiento.nombre_establecimiento
        FROM ubicación
        INNER JOIN opinion_establecimiento ON ubicación.idUbicación = opinion_establecimiento.Ubicación_idUbicación
    `;
    db.query(query, (err, result) => {
        if (err) { res.status(500).json({ error: "Error al obtener las opiniones" }); }
        else { res.json(result); }
    });
});

app.get('/getOpinion', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const query = `
        SELECT nombre_establecimiento, opinion_establecimiento.*, ubicación.latitud, ubicación.longitud,
               usuario.usuario AS nombreUsuario, puntaje_establecimiento.puntaje
        FROM opinion_establecimiento
        INNER JOIN ubicación ON opinion_establecimiento.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN usuario ON opinion_establecimiento.Usuario_idUsuario = usuario.idUsuario
        LEFT JOIN puntaje_establecimiento
            ON puntaje_establecimiento.Opinion_establecimiento_idOpinion = opinion_establecimiento.idOpinion
            AND puntaje_establecimiento.Usuario_idUsuario = opinion_establecimiento.Usuario_idUsuario
        WHERE ubicación.latitud = ? AND ubicación.longitud = ?
    `;
    db.query(query, [lat, lng], (err, result) => {
        if (err) { res.status(500).json({ error: "Error al obtener las opiniones" }); }
        else { res.json(result); }
    });
});

app.get("/getOpinionsVereda", (req, res) => {
    const query = `
        SELECT ubicación.latitud, ubicación.longitud, ubicación.direccion,
               opinion_vereda.vereda_apta, opinion_vereda.descripcion_vereda,
               opinion_vereda.fecha, usuario.usuario AS nombreUsuario
        FROM ubicación
        INNER JOIN opinion_vereda ON ubicación.idUbicación = opinion_vereda.Ubicación_idUbicación
        INNER JOIN usuario ON opinion_vereda.Usuario_idUsuario = usuario.idUsuario
    `;
    db.query(query, (err, result) => {
        if (err) { res.status(500).json({ error: "Error al obtener opiniones de vereda" }); }
        else { res.json(result); }
    });
});

app.get("/getOpinionVereda", (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const query = `
        SELECT opinion_vereda.*, ubicación.latitud, ubicación.longitud, usuario.usuario AS nombreUsuario
        FROM opinion_vereda
        INNER JOIN ubicación ON opinion_vereda.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN usuario ON opinion_vereda.Usuario_idUsuario = usuario.idUsuario
        WHERE ubicación.latitud = ? AND ubicación.longitud = ?
    `;
    db.query(query, [lat, lng], (err, result) => {
        if (err) { res.status(500).json({ error: "Error al obtener opiniones de vereda" }); }
        else { res.json(result); }
    });
});