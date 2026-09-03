const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mysql = require("mysql2");
const bcrypt = require('bcrypt');
const https = require('https');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ─────────────────────────────────────────────
// IA: moderación de opiniones y resúmenes en lenguaje natural
// ─────────────────────────────────────────────
// Si no hay ANTHROPIC_API_KEY configurada, las funciones de IA se
// desactivan solas (moderación = aprobar todo, resumen = omitido) para que
// el resto del sitio funcione igual sin necesidad de una clave.
const IA_HABILITADA = !!process.env.ANTHROPIC_API_KEY;
const anthropic = IA_HABILITADA ? new Anthropic() : null;
if (!IA_HABILITADA) {
    console.warn('ANTHROPIC_API_KEY no configurada: moderación y resúmenes con IA desactivados.');
}

const ModeracionSchema = z.object({
    aprobado: z.boolean(),
    motivo: z.string().nullable()
});

// Revisa el texto libre de una opinión (spam, contenido ofensivo, o una
// contradicción evidente entre lo marcado y lo escrito, ej: "apta" pero
// la descripción dice que está totalmente rota). Solo rechaza casos claros:
// el objetivo es filtrar basura, no litigar cada opinión subjetiva.
async function moderarOpinion(resumenParaModerar) {
    if (!IA_HABILITADA) return { aprobado: true, motivo: null };

    const textoLibre = Object.values(resumenParaModerar.descripciones || {}).filter(Boolean).join(' ').trim();
    if (!textoLibre) return { aprobado: true, motivo: null }; // nada que moderar

    try {
        const response = await anthropic.messages.parse({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: 'Moderás opiniones de un mapa colaborativo de accesibilidad edilicia y de veredas en Argentina. ' +
                'Aprobá casi todo: la mayoría de las opiniones son legítimas aunque estén mal escritas o sean muy breves. ' +
                'Rechazá SOLO si el texto es spam/publicidad, contenido ofensivo o no tiene ninguna relación con accesibilidad, ' +
                'o si contradice de forma evidente y directa los datos marcados (por ejemplo: se marcó como apto/apta pero el texto ' +
                'describe claramente que está roto, inaccesible o no se puede usar). Ante la duda, aprobá.',
            messages: [{
                role: 'user',
                content: `Datos marcados: ${JSON.stringify(resumenParaModerar.campos)}\nTexto escrito por el usuario: ${textoLibre}`
            }],
            output_config: { format: zodOutputFormat(ModeracionSchema) }
        });

        if (!response.parsed_output) return { aprobado: true, motivo: null }; // si falla el parseo, no bloqueamos
        return response.parsed_output;
    } catch (e) {
        console.error('Error moderando con IA (se aprueba por defecto):', e.message);
        return { aprobado: true, motivo: null };
    }
}

// Genera un párrafo breve en español resumiendo la accesibilidad de un
// lugar o cuadra a partir de los datos ya agregados. Devuelve null si la IA
// no está disponible o falla, para que el llamador simplemente lo omita.
async function generarResumenIA(contexto) {
    if (!IA_HABILITADA) return null;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            system: 'Escribís resúmenes breves y neutrales (2-3 oraciones, en español rioplatense) sobre la accesibilidad ' +
                'de un lugar o una vereda, a partir de datos agregados de opiniones de una comunidad. ' +
                'Mencioná lo positivo y lo negativo si ambos aparecen en los datos. No inventes datos que no te dieron. ' +
                'No uses viñetas ni markdown, solo texto corrido.',
            messages: [{ role: 'user', content: JSON.stringify(contexto) }]
        });
        const bloque = response.content.find(b => b.type === 'text');
        return bloque ? bloque.text.trim() : null;
    } catch (e) {
        console.error('Error generando resumen con IA:', e.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// FOTOS: configuración de subida de archivos
// ─────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const fotoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const nombreUnico = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, nombreUnico);
    }
});

const upload = multer({
    storage: fotoStorage,
    limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // 5MB por foto, máx. 6 fotos por vez
    fileFilter: (req, file, cb) => {
        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (tiposPermitidos.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Formato de imagen no permitido'));
    }
});

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

// Normaliza un nombre de calle para poder comparar "Av. Manuel Ugarte",
// "manuel ugarte" y "MANUEL UGARTE 2586" entre sí.
function normalizarNombreCalle(str) {
    if (!str) return '';
    return str
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
        .toLowerCase()
        .replace(/^(av\.?|avenida|calle|pasaje|psje\.?)\s+/, '') // prefijos comunes
        .replace(/\s*\d+\s*$/, '') // altura al final
        .trim();
}

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

        // Para cada punto nuevo, encontrar el way más cercano en la respuesta.
        // Si el punto trae una dirección reportada por el usuario, se prioriza
        // un way cuyo nombre coincida con esa calle (evita "engancharse" con
        // la calle que cruza en una esquina, que puede estar más cerca en línea recta).
        puntosNuevos.forEach(p => {
            const punto = { lat: parseFloat(p.lat), lon: parseFloat(p.lng) };
            const calleEsperada = normalizarNombreCalle(p.direccion);

            let bestWay = null;
            let bestDist = Infinity;
            let bestWayPorNombre = null;
            let bestDistPorNombre = Infinity;

            data.elements.forEach(way => {
                if (!way.geometry || way.geometry.length === 0) return;

                const nombreWay = normalizarNombreCalle(way.tags && way.tags.name);
                const coincideNombre = calleEsperada && nombreWay &&
                    (nombreWay === calleEsperada || nombreWay.includes(calleEsperada) || calleEsperada.includes(nombreWay));

                way.geometry.forEach(node => {
                    const d = dist(node, punto);
                    if (d < bestDist) {
                        bestDist = d;
                        bestWay = way;
                    }
                    if (coincideNombre && d < bestDistPorNombre) {
                        bestDistPorNombre = d;
                        bestWayPorNombre = way;
                    }
                });
            });

            // Si hay un way cercano cuyo nombre coincide con la dirección reportada, se prefiere.
            const wayElegido = bestWayPorNombre || bestWay;

            if (!wayElegido) {
                wayCache[p.cacheKey] = null;
                resultado[p.key] = null;
                return;
            }

            // Recortar a la cuadra del punto
            const segmento = recortarACuadra(wayElegido.geometry, punto);

            const info = {
                wayId: wayElegido.id,
                name: (wayElegido.tags && wayElegido.tags.name) ? wayElegido.tags.name : 'Calle sin nombre',
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

app.post("/createOpinion_establecimiento", requireAuth, async (req, res) => {
    const {
        latitud, longitud, nombre_establecimiento,
        espacios_aptos, ascensor_apto, baños_aptos, puerta_apta,
        rampa_interna_apta, rampa_externa_apta, descripcion_rampa_interna,
        descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios, puntaje
    } = req.body;

    const moderacion = await moderarOpinion({
        campos: { espacios_aptos, ascensor_apto, baños_aptos, puerta_apta, rampa_interna_apta, rampa_externa_apta },
        descripciones: { descripcion_rampa_interna, descripcion_ascensor, descripcion_rampa_externa, descripcion_espacios }
    });
    if (!moderacion.aprobado) {
        return res.status(422).json({ error: 'moderacion', motivo: moderacion.motivo || 'No pudimos publicar esta opinión.' });
    }

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
                        res.json({ message: "Opinión registrada", idUbicacion });
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

app.post("/createOpinion_vereda", requireAuth, async (req, res) => {
    const { latitud, longitud, vereda_apta, descripcion_vereda, direccion } = req.body;
    const usuarioId = req.session.idUsuario;

    const moderacion = await moderarOpinion({
        campos: { vereda_apta },
        descripciones: { descripcion_vereda }
    });
    if (!moderacion.aprobado) {
        return res.status(422).json({ error: 'moderacion', motivo: moderacion.motivo || 'No pudimos publicar esta opinión.' });
    }

    db.query('INSERT INTO ubicación(latitud, longitud, direccion) VALUES (?, ?, ?)',
        [latitud, longitud, direccion], (err, result) => {
            if (err) { console.log(err); return res.status(500).json({ error: "Error al guardar la ubicación" }); }
            db.query(
                'INSERT INTO Opinion_vereda(Ubicación_idUbicación, Usuario_idUsuario, vereda_apta, descripcion_vereda, fecha) VALUES (?, ?, ?, ?, curdate())',
                [result.insertId, usuarioId, vereda_apta, descripcion_vereda],
                (err) => {
                    if (err) { console.log(err); return res.status(500).json({ error: "Error al guardar la opinión" }); }
                    res.json({ message: "Opinión de vereda registrada con éxito", idUbicacion: result.insertId });
                }
            );
        }
    );
});

// ─────────────────────────────────────────────
// FOTOS
// ─────────────────────────────────────────────
app.post("/uploadFotos", requireAuth, (req, res) => {
    upload.array('fotos', 6)(req, res, (err) => {
        if (err) {
            console.log(err);
            return res.status(400).json({ error: err.message || 'Error al subir las fotos' });
        }

        const idUbicacion = parseInt(req.body.idUbicacion, 10);
        const usuarioId = req.session.idUsuario;
        const archivos = req.files || [];

        if (!idUbicacion) {
            return res.status(400).json({ error: 'Falta la ubicación a la que asociar las fotos' });
        }
        if (archivos.length === 0) {
            return res.json({ message: 'Sin fotos para subir', fotos: [] });
        }

        const valores = archivos.map(f => [idUbicacion, usuarioId, f.filename]);
        db.query(
            'INSERT INTO foto (Ubicación_idUbicación, Usuario_idUsuario, archivo, fecha) VALUES ?',
            [valores.map(v => [...v, new Date()])],
            (err) => {
                if (err) { console.log(err); return res.status(500).json({ error: 'Error al guardar las fotos' }); }
                res.json({ message: 'Fotos subidas correctamente', fotos: archivos.map(f => `/uploads/${f.filename}`) });
            }
        );
    });
});

app.get('/getFotos', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radio = 0.0006;

    db.query(`
        SELECT foto.archivo, foto.fecha, usuario.usuario AS nombreUsuario
        FROM foto
        INNER JOIN ubicación ON foto.Ubicación_idUbicación = ubicación.idUbicación
        INNER JOIN usuario ON foto.Usuario_idUsuario = usuario.idUsuario
        WHERE ABS(ubicación.latitud - ?) < ? AND ABS(ubicación.longitud - ?) < ?
        ORDER BY foto.fecha DESC
    `, [lat, radio, lng, radio], (err, result) => {
        if (err) { console.log(err); return res.status(500).json({ error: 'Error al obtener las fotos' }); }
        res.json(result.map(f => ({
            url: `/uploads/${f.archivo}`,
            fecha: f.fecha,
            nombreUsuario: f.nombreUsuario
        })));
    });
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
        SELECT 
            ubicación.latitud, ubicación.longitud, opinion_establecimiento.nombre_establecimiento, COALESCE(ROUND(AVG(puntaje_establecimiento.puntaje), 1), 0) AS promedio_puntaje
        FROM ubicación
        INNER JOIN opinion_establecimiento ON ubicación.idUbicación = opinion_establecimiento.Ubicación_idUbicación
        LEFT JOIN puntaje_establecimiento ON opinion_establecimiento.idOpinion = puntaje_establecimiento.Opinion_establecimiento_idOpinion
        GROUP BY ubicación.latitud, ubicación.longitud, opinion_establecimiento.nombre_establecimiento
    `, (err, result) => {
        if (err) res.status(500).json({ error: "Error al obtener las opiniones" });
        else res.json(result);
    });
});

app.get("/getTopColaboradores", (req, res) => {
    db.query(`
        SELECT
            usuario.usuario AS nombreUsuario,
            COALESCE(est.cantidad, 0) AS establecimientos,
            COALESCE(ver.cantidad, 0) AS veredas,
            COALESCE(est.cantidad, 0) + COALESCE(ver.cantidad, 0) AS total
        FROM usuario
        LEFT JOIN (
            SELECT Usuario_idUsuario, COUNT(*) AS cantidad
            FROM opinion_establecimiento
            GROUP BY Usuario_idUsuario
        ) est ON est.Usuario_idUsuario = usuario.idUsuario
        LEFT JOIN (
            SELECT Usuario_idUsuario, COUNT(*) AS cantidad
            FROM opinion_vereda
            GROUP BY Usuario_idUsuario
        ) ver ON ver.Usuario_idUsuario = usuario.idUsuario
        HAVING total > 0
        ORDER BY total DESC, nombreUsuario ASC
        LIMIT 10
    `, (err, result) => {
        if (err) { console.log(err); res.status(500).json({ error: "Error al obtener el ranking de colaboradores" }); }
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

// Resumen en lenguaje natural (IA) de un lugar o una cuadra, a partir de
// datos ya agregados en el cliente. No requiere sesión: es información
// pública, igual que el resto de las opiniones.
app.post("/resumenLugar", async (req, res) => {
    const { contexto } = req.body;
    if (!contexto) return res.status(400).json({ error: 'Falta el contexto a resumir' });

    const resumen = await generarResumenIA(contexto);
    res.json({ resumen }); // resumen puede ser null si la IA no está disponible
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


// ─────────────────────────────────────────────
// RUTA ACCESIBLE (reintegrado del server original)
// ─────────────────────────────────────────────

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : require('http');
        lib.get(url, { headers: { 'User-Agent': 'MapaAccesibilidad/1.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error('Respuesta no JSON: ' + data.substring(0, 100))); }
            });
        }).on('error', reject);
    });
}

function decodePolyline(encoded, precision = 5) {
    const factor = Math.pow(10, precision);
    const coords = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coords.push([lat / factor, lng / factor]);
    }
    return coords;
}

function obtenerScoresDeVereda() {
    return new Promise((resolve, reject) => {
        db.query(`
            SELECT ubicación.latitud, ubicación.longitud,
                   AVG(opinion_vereda.vereda_apta) AS score_promedio,
                   COUNT(*) AS total_opiniones
            FROM opinion_vereda
            INNER JOIN ubicación ON opinion_vereda.Ubicación_idUbicación = ubicación.idUbicación
            GROUP BY ubicación.latitud, ubicación.longitud
        `, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

app.post('/rutaAccesible', async (req, res) => {
    const { origen, destino } = req.body;
    if (!origen || !destino) return res.status(400).json({ error: 'Faltan origen y destino' });

    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?alternatives=3&geometries=polyline&overview=full&steps=false`;
        console.log('Consultando OSRM...');
        const osrmData = await httpGet(osrmUrl);

        if (!osrmData.routes || osrmData.routes.length === 0) {
            return res.status(404).json({ error: 'No se encontró ruta' });
        }

        const scoresDB = await obtenerScoresDeVereda();
        const scoreMap = {};
        scoresDB.forEach(row => {
            const key = `${parseFloat(row.latitud).toFixed(4)},${parseFloat(row.longitud).toFixed(4)}`;
            scoreMap[key] = { score: parseFloat(row.score_promedio), total: row.total_opiniones };
        });

        console.log(`Scores de vereda cargados: ${Object.keys(scoreMap).length} puntos`);

        let mejorRuta = null;
        let mejorScore = -Infinity;

        for (const ruta of osrmData.routes) {
            const coords = decodePolyline(ruta.geometry);
            let sumaScores = 0;
            let puntosConScore = 0;
            const TOLERANCIA = 0.0005;

            coords.forEach(c => {
                const latKey = parseFloat(c[0].toFixed(4));
                const lngKey = parseFloat(c[1].toFixed(4));
                for (let dlat = -1; dlat <= 1; dlat++) {
                    for (let dlng = -1; dlng <= 1; dlng++) {
                        const key = `${(latKey + dlat * TOLERANCIA).toFixed(4)},${(lngKey + dlng * TOLERANCIA).toFixed(4)}`;
                        if (scoreMap[key]) { sumaScores += scoreMap[key].score; puntosConScore++; break; }
                    }
                }
            });

            const scoreAccesibilidad = puntosConScore > 0 ? sumaScores / puntosConScore : 0.5;
            const distanciaBase = osrmData.routes[0].distance;
            const penalizacionDistancia = ((ruta.distance - distanciaBase) / distanciaBase) * 0.5;
            const scoreFinal = scoreAccesibilidad - penalizacionDistancia;

            console.log(`Ruta ${osrmData.routes.indexOf(ruta)+1}: ${(ruta.distance/1000).toFixed(2)}km, acc=${scoreAccesibilidad.toFixed(2)}, final=${scoreFinal.toFixed(2)}`);

            if (scoreFinal > mejorScore) {
                mejorScore = scoreFinal;
                mejorRuta = { ruta, coords, scoreAccesibilidad, puntosConScore };
            }
        }

        const { ruta, coords, scoreAccesibilidad, puntosConScore } = mejorRuta;
        const TAMANO_SEGMENTO = Math.max(1, Math.floor(coords.length / 20));
        const segmentos = [];
        const TOLERANCIA = 0.0005;

        for (let i = 0; i < coords.length - TAMANO_SEGMENTO; i += TAMANO_SEGMENTO) {
            const segCoords = coords.slice(i, i + TAMANO_SEGMENTO + 1);
            let sumaLocal = 0, contLocal = 0;
            segCoords.forEach(c => {
                const latKey = parseFloat(c[0].toFixed(4));
                const lngKey = parseFloat(c[1].toFixed(4));
                for (let dlat = -1; dlat <= 1; dlat++) {
                    for (let dlng = -1; dlng <= 1; dlng++) {
                        const key = `${(latKey + dlat * TOLERANCIA).toFixed(4)},${(lngKey + dlng * TOLERANCIA).toFixed(4)}`;
                        if (scoreMap[key]) { sumaLocal += scoreMap[key].score; contLocal++; break; }
                    }
                }
            });
            segmentos.push({ coords: segCoords, score: contLocal > 0 ? sumaLocal / contLocal : -1 });
        }

        const totalCallesRuta = Math.ceil(coords.length / TAMANO_SEGMENTO);
        const callesConDatos = segmentos.filter(s => s.score >= 0).length;
        let advertencia = null;
        if (callesConDatos === 0) advertencia = 'Esta ruta aún no tiene opiniones de vereda. El camino se calcula por distancia.';
        else if (callesConDatos < totalCallesRuta * 0.3) advertencia = 'Pocos tramos de esta ruta tienen opiniones. Los resultados son parciales.';

        res.json({
            coordenadas: coords,
            segmentos,
            distanciaMetros: ruta.distance,
            duracionSegundos: ruta.duration,
            scoreAccesibilidad: puntosConScore > 0 ? scoreAccesibilidad : -1,
            callesEvaluadas: callesConDatos,
            advertencia
        });

    } catch (e) {
        console.error('Error en /rutaAccesible:', e.message);
        res.status(500).json({ error: e.message });
    }
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