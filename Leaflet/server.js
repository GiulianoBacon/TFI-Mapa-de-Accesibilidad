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
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
}));

db.connect((err) => {
    if (err) {
        console.error("No se pudo conectar a la base de datos.");
        process.exit(1);
    } else {
        console.log("Conexión a la base de datos establecida.");
        app.listen(PORT, () => {
            console.log(`Servidor escuchando en http://localhost:${PORT}`);
        });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
    if (req.session.authenticated && req.session.idUsuario) {
        next();
    } else {
        res.status(401).json({ error: 'No autenticado' });
    }
}

// ─────────────────────────────────────────────
// OVERPASS: una sola query con todos los puntos
// ─────────────────────────────────────────────

function queryOverpass(overpassQuery) {
    return new Promise((resolve, reject) => {
        const postBody = 'data=' + encodeURIComponent(overpassQuery);
        const options = {
            hostname: 'overpass-api.de',
            path: '/api/interpreter',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postBody),
                'User-Agent': 'MapaAccesibilidad/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (e) {
                    console.error('Overpass no-JSON:', rawData.substring(0, 150));
                    reject(new Error('Respuesta de Overpass no es JSON'));
                }
            });
        });

        req.on('error', reject);
        req.write(postBody);
        req.end();
    });
}

// Distancia euclidiana simple entre dos nodos
function dist(a, b) {
    return Math.hypot(a.lat - b.lat, a.lon - b.lon);
}

// Dado un way con geometría (array de nodos {lat,lon})
// y un punto {lat,lon}, devuelve solo los nodos entre
// las dos intersecciones más cercanas al punto.
// Esto recorta el way a la "cuadra" donde está el punto.
function recortarACuadra(geometry, punto) {
    if (geometry.length < 2) return geometry;

    // Encontrar el nodo más cercano al punto
    let idxCercano = 0;
    let minD = Infinity;
    geometry.forEach((n, i) => {
        const d = dist(n, punto);
        if (d < minD) { minD = d; idxCercano = i; }
    });

    // Buscar hacia atrás y hacia adelante el primer nodo
    // que sea una "esquina" (intersección). Como no tenemos
    // datos de intersecciones, usamos una heurística:
    // limitamos el segmento a un máximo de 150 metros (~0.0013 grados)
    // desde el punto en cada dirección.
    const MAX_DIST = 0.0015; // ~150 metros en grados

    let inicio = idxCercano;
    let fin = idxCercano;

    // Expandir hacia atrás
    for (let i = idxCercano - 1; i >= 0; i--) {
        if (dist(geometry[i], punto) > MAX_DIST) break;
        inicio = i;
    }

    // Expandir hacia adelante
    for (let i = idxCercano + 1; i < geometry.length; i++) {
        if (dist(geometry[i], punto) > MAX_DIST) break;
        fin = i;
    }

    return geometry.slice(inicio, fin + 1);
}

// Cache: almacena el resultado por punto (lat,lng redondeados)
const wayCache = {};

// Ruta que recibe TODOS los puntos de una vez y hace
// una sola query a Overpass para todos juntos
app.post('/getWaysForPoints', async (req, res) => {
    const puntos = req.body.puntos; // [{lat, lng, key}, ...]

    if (!puntos || !Array.isArray(puntos) || puntos.length === 0) {
        return res.status(400).json({ error: 'Se requiere array de puntos' });
    }

    // Separar los que ya están en caché de los que hay que consultar
    const resultado = {};
    const puntosNuevos = [];

    puntos.forEach(p => {
        const cacheKey = `${parseFloat(p.lat).toFixed(5)},${parseFloat(p.lng).toFixed(5)}`;
        if (wayCache[cacheKey] !== undefined) {
            resultado[p.key] = wayCache[cacheKey];
        } else {
            puntosNuevos.push({ ...p, cacheKey });
        }
    });

    if (puntosNuevos.length === 0) {
        return res.json(resultado);
    }

    // Construir UNA SOLA query Overpass con todos los puntos nuevos
    // Usamos "union" de búsquedas around por cada punto
    const radio = 25;
    const unionParts = puntosNuevos
        .map(p => `way(around:${radio},${p.lat},${p.lng})["highway"];`)
        .join('\n');

    const query = `
[out:json][timeout:30];
(
${unionParts}
);
out geom;
    `;

    try {
        console.log(`Consultando Overpass con ${puntosNuevos.length} puntos en una sola query...`);
        const data = await queryOverpass(query);

        if (!data.elements) {
            puntosNuevos.forEach(p => {
                wayCache[p.cacheKey] = null;
                resultado[p.key] = null;
            });
            return res.json(resultado);
        }

        // Para cada punto nuevo, encontrar el way más cercano en la respuesta
        puntosNuevos.forEach(p => {
            const punto = { lat: parseFloat(p.lat), lon: parseFloat(p.lng) };
            let bestWay = null;
            let bestDist = Infinity;

            data.elements.forEach(way => {
                if (!way.geometry || way.geometry.length === 0) return;
                way.geometry.forEach(node => {
                    const d = dist(node, punto);
                    if (d < bestDist) {
                        bestDist = d;
                        bestWay = way;
                    }
                });
            });

            if (!bestWay) {
                wayCache[p.cacheKey] = null;
                resultado[p.key] = null;
                return;
            }

            // Recortar a la cuadra del punto
            const segmento = recortarACuadra(bestWay.geometry, punto);

            const info = {
                wayId: bestWay.id,
                name: (bestWay.tags && bestWay.tags.name) ? bestWay.tags.name : 'Calle sin nombre',
                coords: segmento.map(n => [n.lat, n.lon])
            };

            wayCache[p.cacheKey] = info;
            resultado[p.key] = info;
            console.log(`  → "${info.name}" (${segmento.length} nodos) para [${p.lat},${p.lng}]`);
        });

        res.json(resultado);

    } catch (e) {
        console.error('Error consultando Overpass:', e.message);
        // Devolver null para todos los puntos nuevos en vez de romper todo
        puntosNuevos.forEach(p => { resultado[p.key] = null; });
        res.json(resultado);
    }
});

// ─────────────────────────────────────────────
// RUTAS EXISTENTES
// ─────────────────────────────────────────────

app.post("/createOpinion_establecimiento", requireAuth, (req, res) => {
    const {
        latitud, longitud, nombre_establecimiento,
        espacios_aptos, ascensor_apto, baños_aptos, puerta_apta,
        rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna,
        descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, puntaje
    } = req.body;
    
    const usuarioId = req.session.idUsuario; // <- de la sesión

    const radio = 0.0006;
    const buscarUbicacion = `
        SELECT ubicación.idUbicación FROM ubicación
        INNER JOIN opinion_establecimiento ON ubicación.idUbicación = opinion_establecimiento.Ubicación_idUbicación
        WHERE LOWER(opinion_establecimiento.nombre_establecimiento) = LOWER(?)
        AND ABS(ubicación.latitud - ?) < ? AND ABS(ubicación.longitud - ?) < ?
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
            `, [idUbicacion, usuarioId, nombre_establecimiento, espacios_aptos,
                ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta,
                descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios],
            (err, result) => {
                if (err) { console.log(err); return res.status(500).json(err); }
                db.query(
                    `INSERT INTO puntaje_establecimiento(Usuario_idUsuario, Opinion_establecimiento_idOpinion, puntaje) VALUES(?,?,?)`,
                    [usuarioId, result.insertId, puntaje],
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
            db.query(`INSERT INTO ubicación(latitud, longitud, direccion) VALUES(?,?,'placeholder')`,
                [latitud, longitud], (err, result) => {
                    if (err) { console.log(err); return res.status(500).json(err); }
                    guardarOpinion(result.insertId);
                }
            );
        }
    });
});

app.post("/createOpinion_vereda", requireAuth, (req, res) => {
    const { latitud, longitud, vereda_apta, descripcion_vereda, direccion } = req.body;
    const usuarioId = req.session.idUsuario;
    
    db.query('INSERT INTO ubicación(latitud, longitud, direccion) VALUES (?, ?, ?)',
        [latitud, longitud, direccion], (err, result) => {
            if (err) { console.log(err); return res.status(500).json({ error: "Error al guardar la ubicación" }); }
            db.query(
                'INSERT INTO Opinion_vereda(Ubicación_idUbicación, Usuario_idUsuario, vereda_apta, descripcion_vereda, fecha) VALUES (?, ?, ?, ?, curdate())',
                [result.insertId, usuarioId, vereda_apta, descripcion_vereda],
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

app.get('/api/me', (req, res) => {
    if (req.session.authenticated && req.session.idUsuario) {
        db.query('SELECT idUsuario, email, usuario FROM usuario WHERE idUsuario = ?', [req.session.idUsuario], (err, results) => {
            if (err || results.length === 0) {
                return res.status(500).json({ error: 'Error al obtener usuario' });
            }
            res.json(results[0]);
        });
    } else {
        res.status(401).json({ error: 'No autenticado' });
    }
});

app.get("/usuarios", (req, res) => {
    db.query('SELECT * FROM usuario', (err, result) => {
        if (err) console.log(err);
        else res.send(result);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', (req, res) => {
    const { email, contraseña } = req.body;
    db.query('SELECT * FROM usuario WHERE email = ?', [email], async (error, results) => {
        if (error) return res.status(500).json({ success: false, message: 'Error en el servidor' });
        if (results.length > 0) {
            const match = await bcrypt.compare(contraseña, results[0].contraseña);
            if (match) {
                req.session.authenticated = true;
                req.session.idUsuario = results[0].idUsuario;
                res.json({ success: true, message: 'Login exitoso' });
            } else {
                res.json({ success: false, message: 'Contraseña incorrecta' });
            }
        } else {
            res.json({ success: false, message: 'Usuario no encontrado' });
        }
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get("/getOpinions", (req, res) => {
    db.query(`
        SELECT ubicación.latitud, ubicación.longitud, opinion_establecimiento.nombre_establecimiento
        FROM ubicación
        INNER JOIN opinion_establecimiento ON ubicación.idUbicación = opinion_establecimiento.Ubicación_idUbicación
    `, (err, result) => {
        if (err) res.status(500).json({ error: "Error al obtener las opiniones" });
        else res.json(result);
    });
});

app.get('/getOpinion', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    db.query(`
        SELECT nombre_establecimiento, opinion_establecimiento.*, ubicación.latitud, ubicación.longitud,
               usuario.usuario AS nombreUsuario, puntaje_establecimiento.puntaje
        FROM opinion_establecimiento
        INNER JOIN ubicación ON opinion_establecimiento.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN usuario ON opinion_establecimiento.Usuario_idUsuario = usuario.idUsuario
        LEFT JOIN puntaje_establecimiento
            ON puntaje_establecimiento.Opinion_establecimiento_idOpinion = opinion_establecimiento.idOpinion
            AND puntaje_establecimiento.Usuario_idUsuario = opinion_establecimiento.Usuario_idUsuario
        WHERE ubicación.latitud = ? AND ubicación.longitud = ?
    `, [lat, lng], (err, result) => {
        if (err) res.status(500).json({ error: "Error al obtener las opiniones" });
        else res.json(result);
    });
});

app.get("/getOpinionsVereda", (req, res) => {
    db.query(`
        SELECT ubicación.latitud, ubicación.longitud, ubicación.direccion,
               opinion_vereda.vereda_apta, opinion_vereda.descripcion_vereda,
               opinion_vereda.fecha, usuario.usuario AS nombreUsuario
        FROM ubicación
        INNER JOIN opinion_vereda ON ubicación.idUbicación = opinion_vereda.Ubicación_idUbicación
        INNER JOIN usuario ON opinion_vereda.Usuario_idUsuario = usuario.idUsuario
    `, (err, result) => {
        if (err) res.status(500).json({ error: "Error al obtener opiniones de vereda" });
        else res.json(result);
    });
});

app.get("/getOpinionVereda", (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    db.query(`
        SELECT opinion_vereda.*, ubicación.latitud, ubicación.longitud, usuario.usuario AS nombreUsuario
        FROM opinion_vereda
        INNER JOIN ubicación ON opinion_vereda.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN usuario ON opinion_vereda.Usuario_idUsuario = usuario.idUsuario
        WHERE ubicación.latitud = ? AND ubicación.longitud = ?
    `, [lat, lng], (err, result) => {
        if (err) res.status(500).json({ error: "Error al obtener opiniones de vereda" });
        else res.json(result);
    });
});

app.get("/getPerfil", requireAuth, (req, res) => {
    const idUsuario = req.session.idUsuario;
    db.query(
        "SELECT idUsuario, email, usuario FROM usuario WHERE idUsuario = ?",
        [idUsuario], (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Error en la base de datos" });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }
            res.json(results[0]);
        }
    );
});

app.get("/getOpinionesUsuario", requireAuth, (req, res) => {
    const idUsuario = req.session.idUsuario;
    const queryEst = `
        SELECT 
            'establecimiento' AS tipo,
            oe.idOpinion AS id,
            oe.fecha,
            oe.nombre_establecimiento AS nombre,
            u.latitud,
            u.longitud,
            u.direccion,
            oe.espacios_aptos,
            oe.ascensor_apto,
            oe.baños_aptos,
            oe.puerta_apta,
            oe.rampa_interna_apta,
            oe.rampa_externa_apta,
            oe.descripcion_rampa_interna,
            oe.descripcion_ascensor,
            oe.descripcion_rampa_externa,
            oe.descripcion_espacios,
            pe.puntaje
        FROM opinion_establecimiento oe
        INNER JOIN ubicación u ON oe.Ubicación_idUbicación = u.idUbicación
        LEFT JOIN puntaje_establecimiento pe 
            ON pe.Opinion_establecimiento_idOpinion = oe.idOpinion 
            AND pe.Usuario_idUsuario = oe.Usuario_idUsuario
        WHERE oe.Usuario_idUsuario = ?
        ORDER BY oe.fecha DESC
    `;

    const queryVer = `
        SELECT 
            'vereda' AS tipo,
            ov.idOpinion_vereda AS id,
            ov.fecha,
            u.direccion AS nombre,
            u.latitud,
            u.longitud,
            ov.vereda_apta,
            ov.descripcion_vereda
        FROM opinion_vereda ov
        INNER JOIN ubicación u ON ov.Ubicación_idUbicación = u.idUbicación
        WHERE ov.Usuario_idUsuario = ?
        ORDER BY ov.fecha DESC
    `;

    Promise.all([
        new Promise((resolve, reject) => {
            db.query(queryEst, [idUsuario], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(queryVer, [idUsuario], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        })
    ])
    .then(([opinionesEst, opinionesVer]) => {
        const todas = [...opinionesEst, ...opinionesVer];
        todas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        res.json(todas);
    })
    .catch(err => {
        console.error(err);
        res.status(500).json({ error: "Error al obtener opiniones del usuario" });
    });
});