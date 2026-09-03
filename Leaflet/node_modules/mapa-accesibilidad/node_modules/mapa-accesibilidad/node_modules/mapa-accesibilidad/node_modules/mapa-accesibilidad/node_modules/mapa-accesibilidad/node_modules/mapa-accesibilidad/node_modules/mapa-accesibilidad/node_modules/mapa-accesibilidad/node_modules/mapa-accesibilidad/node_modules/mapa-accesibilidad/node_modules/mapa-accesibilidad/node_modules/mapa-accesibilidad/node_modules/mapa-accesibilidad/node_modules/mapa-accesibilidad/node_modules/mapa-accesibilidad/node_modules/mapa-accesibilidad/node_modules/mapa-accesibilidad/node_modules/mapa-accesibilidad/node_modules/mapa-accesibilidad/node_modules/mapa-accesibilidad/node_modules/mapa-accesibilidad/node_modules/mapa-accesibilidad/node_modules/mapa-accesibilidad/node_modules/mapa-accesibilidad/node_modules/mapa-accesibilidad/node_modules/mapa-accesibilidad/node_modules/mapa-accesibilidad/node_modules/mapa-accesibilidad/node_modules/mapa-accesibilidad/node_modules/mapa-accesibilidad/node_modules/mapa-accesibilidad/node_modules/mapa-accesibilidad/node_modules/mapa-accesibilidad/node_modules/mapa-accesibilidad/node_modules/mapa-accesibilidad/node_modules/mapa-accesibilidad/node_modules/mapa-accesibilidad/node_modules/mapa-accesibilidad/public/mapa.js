let map;
let currentMarker;
let timeout;
let layerEstablecimientos = L.layerGroup();
let layerVeredas = L.layerGroup();
let layerRuta = L.layerGroup();

// Estadísticas por cuadra (way de OSM), recalculadas en cada fetchOpinions().
// Se reutilizan para puntuar la accesibilidad de las rutas sugeridas.
let wayStats = {};

// ─────────────────────────────────────────────
// FOTOS: selección, previsualización y subida
// ─────────────────────────────────────────────
const fotosEstablecimientoEstado = { files: [] };
const fotosVeredaEstado = { files: [] };
const MAX_FOTOS = 6;

function initFotos() {
    document.getElementById('fotosEstablecimientoInput').addEventListener('change', (e) => {
        agregarFotosSeleccionadas(e, fotosEstablecimientoEstado, 'fotosEstablecimientoPreview');
    });
    document.getElementById('fotosVeredaInput').addEventListener('change', (e) => {
        agregarFotosSeleccionadas(e, fotosVeredaEstado, 'fotosVeredaPreview');
    });

    document.getElementById('closeLightbox').addEventListener('click', cerrarLightbox);
    document.getElementById('modalLightbox').addEventListener('click', (e) => {
        if (e.target.id === 'modalLightbox') cerrarLightbox();
    });
}

function agregarFotosSeleccionadas(event, estado, previewId) {
    const nuevos = Array.from(event.target.files);
    estado.files = estado.files.concat(nuevos).slice(0, MAX_FOTOS);
    event.target.value = ''; // permite volver a elegir el mismo archivo si lo saca y lo agrega de nuevo
    renderizarPreviewFotos(estado, previewId);
}

function renderizarPreviewFotos(estado, previewId) {
    const cont = document.getElementById(previewId);
    cont.innerHTML = '';
    estado.files.forEach((file, idx) => {
        const url = URL.createObjectURL(file);
        const item = document.createElement('div');
        item.className = 'foto-preview-item';
        item.innerHTML = `<img src="${url}" alt="Foto ${idx + 1}"><button type="button" class="foto-preview-remove">&times;</button>`;
        item.querySelector('.foto-preview-remove').onclick = () => {
            estado.files.splice(idx, 1);
            renderizarPreviewFotos(estado, previewId);
        };
        cont.appendChild(item);
    });
}

function limpiarFotosEstado(estado, inputId, previewId) {
    estado.files = [];
    document.getElementById(inputId).value = '';
    document.getElementById(previewId).innerHTML = '';
}

async function subirFotos(idUbicacion, files) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.append('idUbicacion', idUbicacion);
    files.forEach(f => formData.append('fotos', f));

    try {
        const res = await fetch('/uploadFotos', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        if (!res.ok) console.error('No se pudieron subir las fotos:', await res.text());
    } catch (e) {
        console.error('Error subiendo fotos:', e);
    }
}

async function obtenerFotosDePunto(lat, lng) {
    try {
        const res = await fetch(`/getFotos?lat=${lat}&lng=${lng}`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error('Error obteniendo fotos:', e);
        return [];
    }
}

// Junta las fotos de varios puntos (por ejemplo, todos los puntos de una
// cuadra de vereda) sin repetir la misma URL dos veces.
async function obtenerFotosDePuntos(puntos) {
    const listas = await Promise.all(puntos.map(p => obtenerFotosDePunto(p.lat, p.lng)));
    const vistas = new Set();
    const resultado = [];
    listas.flat().forEach(f => {
        if (!vistas.has(f.url)) {
            vistas.add(f.url);
            resultado.push(f);
        }
    });
    return resultado;
}

// Evita que un resumen de IA que tarda en llegar se pinte encima de un
// panel lateral distinto, si mientras tanto el usuario ya abrió otro lugar.
let sidebarToken = 0;

async function pedirResumenIA(contexto, contenedorId, miToken) {
    const contenedor = document.getElementById(contenedorId);
    if (contenedor) contenedor.innerHTML = '<div class="resumen-ia cargando"><i class="fa-solid fa-wand-magic-sparkles"></i> Generando resumen...</div>';

    try {
        const res = await fetch('/resumenLugar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contexto })
        });
        const data = await res.json();

        if (miToken !== sidebarToken) return; // el usuario ya cambió de lugar
        const destino = document.getElementById(contenedorId);
        if (!destino) return;

        destino.innerHTML = data.resumen
            ? `<div class="resumen-ia"><i class="fa-solid fa-wand-magic-sparkles"></i> ${data.resumen}</div>`
            : '';
    } catch (e) {
        console.error('Error obteniendo resumen IA:', e);
        if (miToken !== sidebarToken) return;
        const destino = document.getElementById(contenedorId);
        if (destino) destino.innerHTML = '';
    }
}

function renderizarGaleria(fotos) {
    if (!fotos || fotos.length === 0) return '';
    const imgs = fotos.map(f => `<img src="${f.url}" alt="Foto subida por ${f.nombreUsuario}" onclick="abrirLightbox('${f.url}')">`).join('');
    return `
        <div class="photo-gallery">${imgs}</div>
        <div class="photo-gallery-count"><i class="fa-solid fa-camera"></i> ${fotos.length} foto${fotos.length > 1 ? 's' : ''} de la comunidad</div>
    `;
}

function abrirLightbox(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('modalLightbox').style.display = 'flex';
}

function cerrarLightbox() {
    document.getElementById('modalLightbox').style.display = 'none';
    document.getElementById('lightboxImg').src = '';
}

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-34.7334, -58.3920], 16);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const mapDiv = document.getElementById('map');
    const modal = document.getElementById('modalAddOpinion');
    const modalSelection = document.getElementById('modalSelection');
    const optionEstablishment = document.getElementById('optionEstablishment');
    const optionSidewalk = document.getElementById('optionSidewalk');

    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').style.display = 'none';
    });

    mapDiv.addEventListener('dblclick', function(event) {
        const latLng = map.mouseEventToLatLng(event);
        modalSelection.style.display = 'block';
        optionEstablishment.onclick = () => {
            modalSelection.style.display = 'none';
            openEstablishmentOpinionModal(latLng);
        };
        optionSidewalk.onclick = () => {
            modalSelection.style.display = 'none';
            openVeredaOpinionModal(latLng);
        };
    });

    closeModalSelection.onclick = () => { modalSelection.style.display = 'none'; };

    document.getElementById('closeModalAddOpinion').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    document.getElementById('closeModalAddOpinionVereda').addEventListener('click', () => {
        document.getElementById('modalAddOpinionVereda').style.display = 'none';
    });

    layerEstablecimientos.addTo(map);
    layerVeredas.addTo(map);
    layerRuta.addTo(map);

    initRoutePanel();
    initFotos();

    const leyenda = L.control({ position: 'bottomleft' });
    leyenda.onAdd = function() {
        const div = L.DomUtil.create('div');
        div.style.cssText = 'background:white;padding:8px 12px;border-radius:8px;box-shadow:0 1px 5px rgba(0,0,0,0.3);font-size:13px;line-height:1.8';
        div.innerHTML = `
            <b>Veredas por cuadra</b><br>
            <span style="color:#28a745;font-size:18px">━━</span> ≥66% aptas<br>
            <span style="color:#ffc107;font-size:18px">━━</span> 33–65% aptas<br>
            <span style="color:#dc3545;font-size:18px">━━</span> &lt;33% aptas
        `;
        return div;
    };
    leyenda.addTo(map);

    fetchOpinions();
}

// ─────────────────────────────────────────────
// HELPERS DE PUNTAJE (escala 1-5)
// ─────────────────────────────────────────────
const PUNTAJE_LABELS = {
    1: 'Malo',
    2: 'Aceptable',
    3: 'Regular',
    4: 'Bueno',
    5: 'Excelente'
};

function puntajeLabel(p) {
    return PUNTAJE_LABELS[p] ? `${p} — ${PUNTAJE_LABELS[p]}` : (p ? String(p) : 'No evaluado');
}

// Convierte puntaje promedio (1-5) a color y etiqueta
function puntajeResumen(avg) {
    if (avg === null) return { color: '#aaa', label: 'Sin puntaje', stars: '' };
    const rounded = Math.round(avg * 10) / 10;
    let color = avg >= 4 ? '#28a745' : avg >= 2.5 ? '#ffc107' : '#dc3545';
    let label = PUNTAJE_LABELS[Math.round(avg)] || 'Regular';
    // Estrellas con medias estrellas aproximadas
    const stars = renderStars(avg);
    return { color, label, stars, rounded };
}

function renderStars(avg) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (avg >= i) {
            html += '<span style="color:#ffc107">★</span>';
        } else if (avg >= i - 0.5) {
            html += '<span style="color:#ffc107">½</span>';
        } else {
            html += '<span style="color:#ddd">★</span>';
        }
    }
    return html;
}

// Barra de progreso pequeña para campos booleanos
function barraBoolean(pct, label) {
    const color = pct >= 66 ? '#28a745' : pct >= 33 ? '#ffc107' : '#dc3545';
    return `
        <div style="margin-bottom:5px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
                <span>${label}</span>
                <span style="color:${color};font-weight:bold">${pct}%</span>
            </div>
            <div style="background:#e9ecef;border-radius:4px;height:6px">
                <div style="width:${pct}%;background:${color};height:6px;border-radius:4px"></div>
            </div>
        </div>
    `;
}

// ─────────────────────────────────────────────
// CARGA PRINCIPAL
// ─────────────────────────────────────────────
async function fetchOpinions() {
    try {
        // --- ESTABLECIMIENTOS ---
        const resEst = await fetch('/getOpinions');
        if (!resEst.ok) throw new Error("Error al obtener opiniones de establecimientos");
        const estOpinions = await resEst.json();

        layerEstablecimientos.clearLayers();

        estOpinions.forEach(est => {
            const lat = parseFloat(est.latitud);
            const lng = parseFloat(est.longitud);
            const avgPuntaje = parseFloat(est.promedio_puntaje);
            let markerColor = '#dc3545';
            if (avgPuntaje >= 4) {
                markerColor = '#28a745';
            } else if (avgPuntaje >= 2.5) {
                markerColor = '#ffc107';
            }

            const svgIcon = L.divIcon({
                className: 'custom-marker',
                html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41C12.5 41 25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" 
                            fill="${markerColor}" stroke="white" stroke-width="2"/>
                        <circle cx="12.5" cy="12.5" r="4" fill="white" opacity="0.9"/>
                    </svg>`,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            });
            
            const marker = L.marker([lat, lng], {
                icon: svgIcon
            }).addTo(layerEstablecimientos);

            marker.bindTooltip(est.nombre_establecimiento, { permanent: false, direction: 'top', offset: [0, -10], opacity: 0.9 });
            marker.on('click', () => fetchOpinionLatLng(lat, lng));
        });

        // --- VEREDAS ---
        const resVer = await fetch('/getOpinionsVereda');
        if (!resVer.ok) throw new Error("Error al obtener opiniones de vereda");
        const verOpinions = await resVer.json();

        layerVeredas.clearLayers();
        if (verOpinions.length === 0) return;

        const puntosUnicos = [];
        const puntosVistos = new Set();
        verOpinions.forEach(op => {
            const key = `${op.latitud},${op.longitud}`;
            if (!puntosVistos.has(key)) {
                puntosVistos.add(key);
                puntosUnicos.push({ lat: op.latitud, lng: op.longitud, key, direccion: op.direccion });
            }
        });

        console.log(`Enviando ${puntosUnicos.length} puntos únicos al servidor...`);
        const resWays = await fetch('/getWaysForPoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ puntos: puntosUnicos })
        });

        if (!resWays.ok) throw new Error("Error al obtener ways de Overpass");
        const waysPorKey = await resWays.json();

        const opinionesPorWay = {};
        const geometriaPorWay = {};

        verOpinions.forEach(op => {
            const puntoKey = `${op.latitud},${op.longitud}`;
            const wayInfo = waysPorKey[puntoKey];
            if (!wayInfo) return;
            const wid = String(wayInfo.wayId);
            if (!opinionesPorWay[wid]) {
                opinionesPorWay[wid] = [];
                geometriaPorWay[wid] = wayInfo;
            } else {
                if (wayInfo.coords.length > geometriaPorWay[wid].coords.length) {
                    geometriaPorWay[wid] = wayInfo;
                }
            }
            opinionesPorWay[wid].push(op);
        });

        wayStats = {};

        Object.entries(opinionesPorWay).forEach(([wayId, ops]) => {
            const wayInfo = geometriaPorWay[wayId];
            const totalOpiniones = ops.length;
            const aptasCount = ops.filter(op => op.vereda_apta == 1).length;
            const porcentaje = aptasCount / totalOpiniones;
            const pct = Math.round(porcentaje * 100);

            let color;
            if (porcentaje >= 0.66)      color = '#28a745';
            else if (porcentaje >= 0.33) color = '#ffc107';
            else                          color = '#dc3545';

            wayStats[wayId] = { name: wayInfo.name, coords: wayInfo.coords, pct, aptasCount, totalOpiniones, color };

            const polyline = L.polyline(wayInfo.coords, { color, weight: 6, opacity: 0.85 }).addTo(layerVeredas);
            polyline.bindPopup(`<b>${wayInfo.name}</b><br><b>Aptas:</b> ${aptasCount} de ${totalOpiniones} (${pct}%)`);
            polyline.bindTooltip(`${wayInfo.name} — ${pct}% apta`, { permanent: false, sticky: true, opacity: 0.9 });
            polyline.on('click', () => mostrarOpinionesVereda(wayInfo.name, ops));
        });

        console.log(`Dibujadas ${Object.keys(opinionesPorWay).length} cuadras.`);

    } catch (error) {
        console.error('Error en fetchOpinions:', error);
    }
}
// ─────────────────────────────────────────────
// SIDEBAR — VEREDA (sin cambios)
// ─────────────────────────────────────────────
async function mostrarOpinionesVereda(nombreCalle, opinions) {
    const sbar = document.getElementById('sidebar');
    const sidebar = document.getElementById('sidebar-content');
    sbar.style.display = 'block';
    sidebar.innerHTML = '<div style="font-size:13px;color:#888">Cargando...</div>';

    const total = opinions.length;
    const aptas = opinions.filter(op => op.vereda_apta == 1).length;
    const pct = Math.round((aptas / total) * 100);
    let colorTexto = pct >= 66 ? '#28a745' : pct >= 33 ? '#e6a800' : '#dc3545';
    let estadoTexto = pct >= 66 ? 'Buena accesibilidad' : pct >= 33 ? 'Accesibilidad media' : 'Baja accesibilidad';

    const puntosUnicos = [...new Map(opinions.map(op => [`${op.latitud},${op.longitud}`, { lat: op.latitud, lng: op.longitud }])).values()];
    const fotos = await obtenerFotosDePuntos(puntosUnicos);

    sidebarToken++;
    const miToken = sidebarToken;

    sidebar.innerHTML = `
        <h6 style="font-weight:bold;margin-bottom:4px">${nombreCalle}</h6>
        <div style="margin-bottom:10px;padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px">
            <span style="color:${colorTexto};font-weight:bold">${estadoTexto}</span>
            &nbsp;·&nbsp; ${aptas} de ${total} opiniones aptas (${pct}%)
        </div>

        <div id="resumenIA-vereda"></div>

        ${renderizarGaleria(fotos)}

        <hr style="margin:8px 0">
    `;

    pedirResumenIA({
        tipo: 'vereda',
        calle: nombreCalle,
        total_opiniones: total,
        pct_aptas: pct,
        descripciones: opinions.map(op => op.descripcion_vereda).filter(Boolean)
    }, 'resumenIA-vereda', miToken);

    opinions.forEach(op => {
        const direccion = op.direccion || nombreCalle;
        sidebar.innerHTML += `
            <div style="font-size:13px;margin-bottom:8px">
                <div style="font-size:11px;color:#888;margin-bottom:2px">${direccion}</div>
                <b>${op.nombreUsuario}</b>&nbsp;
                <span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;
                    background:${op.vereda_apta ? '#d4edda' : '#f8d7da'};
                    color:${op.vereda_apta ? '#155724' : '#721c24'};font-weight:bold">
                    ${op.vereda_apta ? '✓ Apta' : '✗ No apta'}
                </span><br>
                ${op.descripcion_vereda ? `<span style="color:#555">${op.descripcion_vereda}</span><br>` : ''}
                <span style="font-size:11px;color:#aaa">${op.fecha}</span>
            </div>
            <hr style="margin:6px 0">
        `;
    });

    const btnAgregar = document.createElement('button');
    btnAgregar.className = 'btn btn-sm btn-outline-secondary mt-1';
    btnAgregar.innerText = '+ Agregar opinión en esta vereda/cuadra';
    btnAgregar.onclick = () => {
        const lat = parseFloat(opinions[0].latitud);
        const lng = parseFloat(opinions[0].longitud);
        openVeredaOpinionModal({ lat, lng });
        sbar.style.display = 'none';
    };
    sidebar.appendChild(btnAgregar);
}

// ─────────────────────────────────────────────
// SIDEBAR — ESTABLECIMIENTO (nuevo: resumen + detalle expandible)
// ─────────────────────────────────────────────
async function fetchOpinionLatLng(latitud, longitud) {
    try {
        const [response, fotos] = await Promise.all([
            fetch(`/getOpinion?lat=${latitud}&lng=${longitud}`),
            obtenerFotosDePunto(latitud, longitud)
        ]);
        if (!response.ok) throw new Error(response.statusText);
        const opinions = await response.json();

        const sbar = document.getElementById('sidebar');
        sbar.style.display = 'block';
        const sidebar = document.getElementById('sidebar-content');
        sidebar.innerHTML = '';

        if (opinions.length === 0) {
            sidebar.innerHTML = '<p>No hay opiniones para esta ubicación.</p>';
            return;
        }

        const nombre = opinions[0].nombre_establecimiento;
        const total = opinions.length;

        // ── Calcular promedio de puntaje ──
        const puntajes = opinions.map(op => op.puntaje).filter(p => p !== null && p !== undefined);
        const avgPuntaje = puntajes.length > 0
            ? puntajes.reduce((a, b) => a + b, 0) / puntajes.length
            : null;
        const resP = puntajeResumen(avgPuntaje);

        // ── Calcular % de cada campo booleano ──
        const campos = [
            { key: 'espacios_aptos',      label: 'Espacios aptos'    },
            { key: 'ascensor_apto',       label: 'Ascensor'          },
            { key: 'baños_aptos',         label: 'Baños aptos'       },
            { key: 'puerta_apta',         label: 'Puerta apta'       },
            { key: 'rampa_interna_apta',  label: 'Rampa interna'     },
            { key: 'rampa_externa_apta',  label: 'Rampa externa'     },
        ];

        let barrasHTML = '';
        campos.forEach(c => {
            const respondieron = opinions.filter(op => op[c.key] !== null && op[c.key] !== undefined);
            if (respondieron.length === 0) return;
            const siCount = respondieron.filter(op => op[c.key] == 1 || op[c.key] === true).length;
            const pct = Math.round((siCount / respondieron.length) * 100);
            barrasHTML += barraBoolean(pct, c.label);
        });

        // ── SECCIÓN RESUMEN ──
        sidebarToken++;
        const miToken = sidebarToken;

        sidebar.innerHTML = `
            <h6 style="font-weight:bold;margin-bottom:2px">${nombre}</h6>
            <div style="font-size:12px;color:#888;margin-bottom:10px">${total} opinión${total > 1 ? 'es' : ''}</div>

            <div id="resumenIA-establecimiento"></div>

            ${renderizarGaleria(fotos)}

            <!-- Puntaje promedio -->
            <div style="text-align:center;padding:10px;background:#f8f9fa;border-radius:8px;margin-bottom:12px">
                <div style="font-size:22px;margin-bottom:2px">${resP.stars}</div>
                <div style="font-size:20px;font-weight:bold;color:${resP.color}">${avgPuntaje !== null ? resP.rounded : '—'}</div>
                <div style="font-size:13px;color:${resP.color};font-weight:bold">${resP.label}</div>
                ${puntajes.length < total ? `<div style="font-size:11px;color:#aaa">(${puntajes.length} de ${total} con puntaje)</div>` : ''}
            </div>

            <!-- Barras booleanas -->
            <div style="margin-bottom:12px">
                <div style="font-size:12px;font-weight:bold;color:#555;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Accesibilidad por aspecto</div>
                ${barrasHTML || '<div style="font-size:12px;color:#aaa">Sin datos</div>'}
            </div>

            <hr style="margin:8px 0">

            <!-- Botón para desplegar opiniones individuales -->
            <button id="btnVerDetalles"
                onclick="toggleDetallesEstablecimiento(this)"
                class="btn btn-sm btn-outline-secondary w-100 mb-2"
                style="font-size:12px">
                Ver opiniones detalladas (${total})
            </button>

            <!-- Contenedor colapsable -->
            <div id="detallesEstablecimiento" style="display:none"></div>
        `;

        pedirResumenIA({
            tipo: 'establecimiento',
            nombre,
            total_opiniones: total,
            puntaje_promedio: avgPuntaje !== null ? resP.rounded : null,
            aspectos: campos.map(c => {
                const respondieron = opinions.filter(op => op[c.key] !== null && op[c.key] !== undefined);
                if (respondieron.length === 0) return null;
                const siCount = respondieron.filter(op => op[c.key] == 1 || op[c.key] === true).length;
                return { aspecto: c.label, pct_apto: Math.round((siCount / respondieron.length) * 100) };
            }).filter(Boolean),
            descripciones: opinions.flatMap(op => [
                op.descripcion_espacios, op.descripcion_ascensor,
                op.descripcion_rampa_interna, op.descripcion_rampa_externa
            ]).filter(Boolean)
        }, 'resumenIA-establecimiento', miToken);

        // Pre-renderizar el HTML de opiniones individuales en el div oculto
        const contenedor = sidebar.querySelector('#detallesEstablecimiento');
        opinions.forEach((op, idx) => {
            const pLabel = puntajeLabel(op.puntaje);
            const pColor = op.puntaje >= 4 ? '#28a745' : op.puntaje >= 3 ? '#ffc107' : op.puntaje ? '#dc3545' : '#aaa';

            // Campos con "Sí"
            const aptos = campos.filter(c => op[c.key] == 1 || op[c.key] === true).map(c => c.label);
            const noAptos = campos.filter(c => op[c.key] == 0 || op[c.key] === false).map(c => c.label);

            const div = document.createElement('div');
            div.style.cssText = 'border:1px solid #e9ecef;border-radius:8px;padding:10px;margin-bottom:8px;font-size:13px';
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <b>${op.nombreUsuario}</b>
                    <span style="font-weight:bold;color:${pColor};font-size:13px">${pLabel}</span>
                </div>
                ${aptos.length > 0 ? `
                    <div style="margin-bottom:3px">
                        <span style="color:#28a745;font-size:11px">✓ ${aptos.join(' · ')}</span>
                    </div>` : ''}
                ${noAptos.length > 0 ? `
                    <div style="margin-bottom:3px">
                        <span style="color:#dc3545;font-size:11px">✗ ${noAptos.join(' · ')}</span>
                    </div>` : ''}
                ${op.descripcion_espacios ? `<div style="color:#555;font-size:12px;margin-top:4px"><i>Espacios:</i> ${op.descripcion_espacios}</div>` : ''}
                ${op.descripcion_ascensor ? `<div style="color:#555;font-size:12px"><i>Ascensor:</i> ${op.descripcion_ascensor}</div>` : ''}
                ${op.descripcion_rampa_interna ? `<div style="color:#555;font-size:12px"><i>Rampa int.:</i> ${op.descripcion_rampa_interna}</div>` : ''}
                ${op.descripcion_rampa_externa ? `<div style="color:#555;font-size:12px"><i>Rampa ext.:</i> ${op.descripcion_rampa_externa}</div>` : ''}
                <div style="font-size:11px;color:#aaa;margin-top:4px">${op.fecha}</div>
            `;
            contenedor.appendChild(div);
        });

        // Botón agregar
        const btnAgregar = document.createElement('button');
        btnAgregar.className = 'btn btn-sm btn-primary w-100 mt-1';
        btnAgregar.innerText = '+ Agregar mi opinión';
        btnAgregar.onclick = () => {
            openEstablishmentOpinionModal({ lat: parseFloat(latitud), lng: parseFloat(longitud) });
            sbar.style.display = 'none';
        };
        sidebar.appendChild(btnAgregar);

    } catch (error) {
        console.error('Error obteniendo opiniones:', error);
    }
}

// Toggle del panel de detalles individuales
function toggleDetallesEstablecimiento(btn) {
    const div = document.getElementById('detallesEstablecimiento');
    if (div.style.display === 'none') {
        div.style.display = 'block';
        btn.textContent = btn.textContent.replace('Ver', 'Ocultar');
    } else {
        div.style.display = 'none';
        btn.textContent = btn.textContent.replace('Ocultar', 'Ver');
    }
}

// ─────────────────────────────────────────────
// MODALES
// ─────────────────────────────────────────────
async function openEstablishmentOpinionModal(latLng) {
    const modal = document.getElementById('modalAddOpinion');
    modal.style.display = 'block';
    document.getElementById('longitud').value = latLng.lng.toFixed(8);
    document.getElementById('latitud').value = latLng.lat.toFixed(8);
    limpiarFotosEstado(fotosEstablecimientoEstado, 'fotosEstablecimientoInput', 'fotosEstablecimientoPreview');

    const nombreInput = document.getElementById('nombreEstablecimiento');
    nombreInput.value = "Buscando...";
    nombreInput.removeAttribute('readonly');

    try {
        const resGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}&namedetails=1`);
        const dataGeo = await resGeo.json();
        nombreInput.value = (dataGeo.namedetails && dataGeo.namedetails.name) ? dataGeo.namedetails.name : "";

        const resOp = await fetch(`/getOpinion?lat=${latLng.lat.toFixed(8)}&lng=${latLng.lng.toFixed(8)}`);
        const dataOp = await resOp.json();
        if (dataOp && dataOp.length > 0) {
            nombreInput.value = dataOp[0].nombre_establecimiento;
            nombreInput.setAttribute('readonly', true);
        }
    } catch (e) {
        console.error("Error inicializando modal:", e);
        nombreInput.value = "";
    }
}

// Ubicación real donde se va a registrar la opinión de vereda. Por defecto es
// el punto donde se hizo doble clic en el mapa; si el usuario edita la altura
// detectada automáticamente, se reemplaza por la ubicación de la dirección
// que efectivamente escribió (ver validarAlturaVereda), para que el texto
// guardado y el punto en el mapa nunca queden desincronizados.
let coordsVeredaClick = null;
let coordsVeredaVerificadas = null;
let alturaDetectadaOriginal = '';

async function openVeredaOpinionModal(latLng) {
    const modal = document.getElementById('modalAddOpinionVereda');
    modal.style.display = 'block';
    document.getElementById('latitud_vereda').value = latLng.lat.toFixed(8);
    document.getElementById('longitud_vereda').value = latLng.lng.toFixed(8);
    limpiarFotosEstado(fotosVeredaEstado, 'fotosVeredaInput', 'fotosVeredaPreview');

    coordsVeredaClick = { lat: latLng.lat, lng: latLng.lng };
    coordsVeredaVerificadas = null;

    const inputDireccion = document.getElementById('direccion_vereda');
    const inputAltura = document.getElementById('altura_vereda');
    const feedback = document.getElementById('alturaFeedback');
    inputDireccion.value = "Buscando calle...";
    inputAltura.value = "";
    feedback.textContent = '';
    feedback.className = 'altura-feedback';
    inputAltura.onblur = validarAlturaVereda;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}`);
        const data = await res.json();
        if (data.address) {
            inputDireccion.value = data.address.road || data.address.pedestrian || data.display_name.split(',')[0] || "";
            inputAltura.value = data.address.house_number || "";
        } else {
            inputDireccion.value = "";
        }
    } catch (e) {
        console.error("Error obteniendo dirección:", e);
        inputDireccion.value = "";
    }

    alturaDetectadaOriginal = inputAltura.value;
}

// Si el usuario cambia la altura detectada automáticamente, la opinión ya no
// puede seguir guardándose en el punto exacto donde hizo doble clic (porque
// ese número podría corresponder a otro lugar de la cuadra). En vez de dejar
// que direccion y ubicación queden desincronizadas, se busca la dirección
// completa que el usuario efectivamente escribió y se usa esa ubicación real.
async function validarAlturaVereda() {
    const feedback = document.getElementById('alturaFeedback');
    const alturaActual = document.getElementById('altura_vereda').value.trim();
    const calle = document.getElementById('direccion_vereda').value.trim();

    if (!alturaActual || alturaActual === alturaDetectadaOriginal) {
        coordsVeredaVerificadas = null;
        feedback.textContent = '';
        feedback.className = 'altura-feedback';
        return;
    }

    feedback.textContent = 'Verificando dirección...';
    feedback.className = 'altura-feedback verificando';

    try {
        const query = `${calle} ${alturaActual}, Buenos Aires, Argentina`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();

        if (data.length === 0) {
            throw new Error('Sin resultados');
        }

        const encontrada = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };

        // Si la dirección "corregida" cae muy lejos de donde se hizo doble clic
        // en el mapa, es más probable que sea un resultado erróneo (otra calle
        // con el mismo nombre en otro barrio) que una corrección real.
        const distancia = haversine(coordsVeredaClick.lat, coordsVeredaClick.lng, encontrada.lat, encontrada.lng);
        if (distancia > 500) {
            throw new Error('Resultado demasiado lejos del punto marcado');
        }

        coordsVeredaVerificadas = encontrada;
        document.getElementById('latitud_vereda').value = encontrada.lat.toFixed(8);
        document.getElementById('longitud_vereda').value = encontrada.lng.toFixed(8);
        feedback.textContent = `✓ Verificado: se va a registrar en ${calle} ${alturaActual}`;
        feedback.className = 'altura-feedback ok';
    } catch (e) {
        coordsVeredaVerificadas = null;
        document.getElementById('latitud_vereda').value = coordsVeredaClick.lat.toFixed(8);
        document.getElementById('longitud_vereda').value = coordsVeredaClick.lng.toFixed(8);
        feedback.textContent = '⚠ No pudimos confirmar esa altura; se va a registrar en el punto que marcaste en el mapa';
        feedback.className = 'altura-feedback advertencia';
    }
}

// ─────────────────────────────────────────────
// FORMULARIOS
// ─────────────────────────────────────────────
async function addOpinion_establecimiento(event) {
    event.preventDefault();

    // Verificar autenticación antes de continuar
    try {
        const authCheck = await fetch('/api/me', { credentials: 'include' });
        if (!authCheck.ok) {
            alert('Debes iniciar sesión para publicar una opinión');
            return;
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        alert('Debes iniciar sesión para publicar una opinión');
        return;
    }

    const formData = new FormData(event.target);
    const data = {
        latitud: formData.get("latitud"),
        longitud: formData.get("longitud"),
        nombre_establecimiento: formData.get("nombre_establecimiento"),
        espacios_aptos: formData.has("espacios_aptos"),
        ascensor_apto: formData.has("ascensor_apto"),
        baños_aptos: formData.has("baños_aptos"),
        puerta_apta: formData.has("puerta_apta"),
        rampa_interna_apta: formData.has("rampa_interna_apta"),
        rampa_externa_apta: formData.has("rampa_externa_apta"),
        descripcion_rampa_interna: formData.get("descripcion_rampa_interna"),
        descripcion_ascensor: formData.get("descripcion_ascensor"),
        descripcion_rampa_externa: formData.get("descripcion_rampa_externa"),
        descripcion_espacios: formData.get("descripcion_espacios"),
        puntaje: parseInt(formData.get("puntaje"))
    };

    fetch("/createOpinion_establecimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'   // importante para enviar la cookie de sesión
    })
    .then(async res => {
        if (!res.ok) {
            if (res.status === 401) throw new Error('No autenticado');
            if (res.status === 422) {
                const body = await res.json().catch(() => ({}));
                const err = new Error(body.motivo || 'No pudimos publicar esta opinión.');
                err.esModeracion = true;
                throw err;
            }
            throw new Error(res.statusText);
        }
        return res.json();
    })
    .then(async data => {
        await subirFotos(data.idUbicacion, fotosEstablecimientoEstado.files);
        alert(data.message);
        fetchOpinions();  // recargar el mapa para mostrar la nueva opinión
        event.target.reset();
        limpiarFotosEstado(fotosEstablecimientoEstado, 'fotosEstablecimientoInput', 'fotosEstablecimientoPreview');
        document.getElementById('modalAddOpinion').style.display = 'none';
    })
    .catch(e => {
        console.error("Error:", e);
        if (e.message === 'No autenticado') {
            alert('Debes iniciar sesión para publicar una opinión');
        } else if (e.esModeracion) {
            alert(e.message);
        } else {
            alert('Hubo un error al enviar la opinión. Intenta nuevamente.');
        }
    });
}

async function addOpinion_vereda(event) {
    event.preventDefault();

    // Verificar autenticación antes de continuar
    try {
        const authCheck = await fetch('/api/me', { credentials: 'include' });
        if (!authCheck.ok) {
            alert('Debes iniciar sesión para publicar una opinión');
            return;
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        alert('Debes iniciar sesión para publicar una opinión');
        return;
    }

    // Por si el usuario editó la altura y todavía no se validó (por ejemplo,
    // si el navegador no llegó a disparar el blur antes del submit).
    await validarAlturaVereda();

    const formData = new FormData(event.target);
    const direccionCompleta = `${formData.get("direccion_vereda")} ${formData.get("altura_vereda")}`.trim();

    // Si la altura fue editada y se pudo verificar una dirección real para
    // ella, se guarda ahí; si no, se guarda en el punto donde se hizo doble
    // clic en el mapa. Nunca se guarda un texto de dirección que no
    // corresponda con la ubicación real de la opinión.
    const ubicacionFinal = coordsVeredaVerificadas || coordsVeredaClick;

    const data = {
        latitud: ubicacionFinal.lat,
        longitud: ubicacionFinal.lng,
        direccion: direccionCompleta,
        vereda_apta: formData.has("vereda_apta") ? 1 : 0,
        descripcion_vereda: formData.get("descripcion_vereda")
    };

    try {
        const res = await fetch("/createOpinion_vereda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        if (!res.ok) {
            if (res.status === 401) throw new Error('No autenticado');
            if (res.status === 422) {
                const body = await res.json().catch(() => ({}));
                const err = new Error(body.motivo || 'No pudimos publicar esta opinión.');
                err.esModeracion = true;
                throw err;
            }
            throw new Error(res.statusText);
        }
        const result = await res.json();
        await subirFotos(result.idUbicacion, fotosVeredaEstado.files);
        alert(result.message);
        fetchOpinions();   // recargar el mapa
        event.target.reset();
        limpiarFotosEstado(fotosVeredaEstado, 'fotosVeredaInput', 'fotosVeredaPreview');
        document.getElementById('modalAddOpinionVereda').style.display = 'none';
    } catch (e) {
        console.error("Error:", e);
        if (e.message === 'No autenticado') {
            alert('Debes iniciar sesión para publicar una opinión');
        } else if (e.esModeracion) {
            alert(e.message);
        } else {
            alert('Hubo un error al enviar la opinión. Intenta nuevamente.');
        }
    }
}

// ─────────────────────────────────────────────
// BÚSQUEDA
// ─────────────────────────────────────────────
async function handleSearch() {
    const query = document.getElementById('busqueda').value;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        map.panTo(new L.LatLng(lat, lon));
        if (currentMarker) map.removeLayer(currentMarker);
        currentMarker = L.marker([lat, lon]).addTo(map);
    }
}

async function handleInputChange() {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
        const query = document.getElementById('busqueda').value;
        if (query.length > 5) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
                const data = await res.json();
                setSuggestions(data);
            } catch (e) {
                console.error('Error en búsqueda:', e);
            }
        } else {
            setSuggestions([]);
        }
    }, 500);
}

function setSuggestions(data) {
    const list = document.getElementById('suggestions');
    list.innerHTML = '';
    if (data.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No hay sugerencias disponibles';
        list.appendChild(li);
        return;
    }
    data.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = item.display_name;
        li.setAttribute('key', index);
        li.onclick = () => handleSuggestionClick(item);
        list.appendChild(li);
    });
}

function handleSuggestionClick(suggestion) {
    document.getElementById('busqueda').value = suggestion.display_name;
    handleSearch();
    document.getElementById('suggestions').innerHTML = '';
}

// ─────────────────────────────────────────────
// TOGGLE CAPAS
// ─────────────────────────────────────────────
function toggleLayer(type) {
    if (type === 'establecimientos') {
        if (map.hasLayer(layerEstablecimientos)) map.removeLayer(layerEstablecimientos);
        else map.addLayer(layerEstablecimientos);
    } else {
        if (map.hasLayer(layerVeredas)) map.removeLayer(layerVeredas);
        else map.addLayer(layerVeredas);
    }
}

// ─────────────────────────────────────────────
// RUTA ACCESIBLE (A → B)
// ─────────────────────────────────────────────
const MAX_ROUTE_DISTANCE_M = 3000; // 3 km: más allá de esto no estimamos
const RADIO_MATCH_CUADRA_M = 35;   // qué tan cerca tiene que pasar la ruta de una cuadra evaluada
const VELOCIDAD_CAMINATA_M_MIN = 66; // ~4 km/h, ritmo conservador (movilidad reducida)
const LARGO_CUADRA_M = 100;        // largo aproximado de una cuadra porteña
const MAX_CUADRAS_DESVIO = 3;      // cuánto de más se tolera, por cada cruce con una vereda mala, para evitarla

let routeOriginCoords = null;
let routeDestinationCoords = null;

function initRoutePanel() {
    const toggleBtn = document.getElementById('toggleRoutePanel');
    const panel = document.getElementById('routePanel');
    const closeBtn = document.getElementById('closeRoutePanel');
    const calcBtn = document.getElementById('calcRouteBtn');

    toggleBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
        limpiarRuta();
    });
    calcBtn.addEventListener('click', calcularRuta);

    setupRouteAutocomplete(
        document.getElementById('routeOrigin'),
        document.getElementById('routeOriginSuggestions'),
        (coords) => { routeOriginCoords = coords; }
    );
    setupRouteAutocomplete(
        document.getElementById('routeDestination'),
        document.getElementById('routeDestinationSuggestions'),
        (coords) => { routeDestinationCoords = coords; }
    );
}

function setupRouteAutocomplete(inputEl, listEl, setCoords) {
    let debounceTimer;
    inputEl.addEventListener('input', () => {
        setCoords(null);
        clearTimeout(debounceTimer);
        const query = inputEl.value.trim();
        if (query.length <= 4) {
            listEl.innerHTML = '';
            return;
        }
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6`);
                const data = await res.json();
                listEl.innerHTML = '';
                data.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item.display_name;
                    li.onclick = () => {
                        inputEl.value = item.display_name;
                        listEl.innerHTML = '';
                        setCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
                    };
                    listEl.appendChild(li);
                });
            } catch (e) {
                console.error('Error de autocompletado:', e);
            }
        }, 400);
    });
}

async function geocodeAddress(texto) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&limit=1`);
        const data = await res.json();
        if (data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (e) {
        console.error('Error geocodificando dirección:', e);
        return null;
    }
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cruza la geometría de una ruta de OSRM con las cuadras que ya tenemos
// evaluadas (wayStats) para estimar qué tan accesible es el trayecto.
function evaluarAccesibilidadRuta(route) {
    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]); // OSRM da [lon,lat] -> Leaflet usa [lat,lon]

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    coords.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    });
    const margen = 0.001; // ~100 m, para el prefiltro por caja

    const cuadrasEncontradas = [];

    Object.entries(wayStats).forEach(([wayId, way]) => {
        const dentroDeCaja = way.coords.some(([lat, lng]) =>
            lat >= minLat - margen && lat <= maxLat + margen &&
            lng >= minLng - margen && lng <= maxLng + margen
        );
        if (!dentroDeCaja) return;

        // Buscamos el punto exacto donde la ruta pasa más cerca de esta cuadra
        // (una cuadra puede abarcar varios cientos de metros, así que nos importa
        // el punto de cruce real, no el medio de todo el tramo).
        let distanciaMinima = Infinity;
        let puntoCruce = null;
        coords.forEach(([rLat, rLng]) => {
            way.coords.forEach(([wLat, wLng]) => {
                const d = haversine(rLat, rLng, wLat, wLng);
                if (d < distanciaMinima) {
                    distanciaMinima = d;
                    puntoCruce = [wLat, wLng];
                }
            });
        });

        if (distanciaMinima <= RADIO_MATCH_CUADRA_M) {
            cuadrasEncontradas.push({ wayId, ...way, puntoCruce });
        }
    });

    const score = cuadrasEncontradas.length > 0
        ? Math.round(cuadrasEncontradas.reduce((sum, c) => sum + c.pct, 0) / cuadrasEncontradas.length)
        : null;

    return {
        coords,
        distance: route.distance,
        // OSRM (servidor demo público) no calcula el tiempo a ritmo peatonal real
        // en su perfil "foot", así que lo estimamos nosotros a partir de la distancia.
        duration: (route.distance / VELOCIDAD_CAMINATA_M_MIN) * 60,
        score,
        cuadras: cuadrasEncontradas
    };
}

// El servidor demo de OSRM casi nunca devuelve alternativas reales para
// trayectos cortos, así que si la ruta elegida pasa por una cuadra con mala
// accesibilidad reportada, forzamos un desvío: le pedimos a OSRM una ruta
// que pase por un punto corrido hacia un costado de esa cuadra, y la
// comparamos contra la original.
function calcularPuntoDesvio(cuadra, ladoSigno, distanciaM = 120) {
    const coords = cuadra.coords;

    // Si sabemos el punto exacto donde la ruta cruza esta cuadra, corremos el
    // desvío desde ahí (una cuadra puede abarcar varios cientos de metros, y
    // desviarse desde su punto medio general puede no alejarse del cruce real).
    let referencia = cuadra.puntoCruce;
    let idxReferencia = referencia
        ? coords.findIndex(([lat, lng]) => lat === referencia[0] && lng === referencia[1])
        : -1;

    if (idxReferencia === -1) {
        referencia = [(coords[0][0] + coords[coords.length - 1][0]) / 2, (coords[0][1] + coords[coords.length - 1][1]) / 2];
        idxReferencia = Math.floor(coords.length / 2);
    }

    // Dirección local de la calle alrededor del punto de referencia
    const antes = coords[Math.max(0, idxReferencia - 1)];
    const despues = coords[Math.min(coords.length - 1, idxReferencia + 1)];
    const dLat = despues[0] - antes[0];
    const dLng = despues[1] - antes[1];
    const largo = Math.sqrt(dLat * dLat + dLng * dLng) || 1;

    // Perpendicular al segmento, normalizado
    const perpLat = -dLng / largo;
    const perpLng = dLat / largo;

    const metrosPorGradoLat = 111320;
    const metrosPorGradoLng = 111320 * Math.cos(referencia[0] * Math.PI / 180);

    return {
        lat: referencia[0] + (perpLat * distanciaM / metrosPorGradoLat) * ladoSigno,
        lng: referencia[1] + (perpLng * distanciaM / metrosPorGradoLng) * ladoSigno
    };
}

// Punto corrido en una dirección cardinal (0°=Norte, 90°=Este, 180°=Sur, 270°=Oeste)
// desde una referencia. Se usa como complemento al desvío perpendicular: si la
// calle problemática es diagonal, "perpendicular a ella" puede no coincidir con
// ninguna calle real cercana, mientras que probar las 4 direcciones cardinales
// tiene más chances de caer sobre una calle real de la cuadrícula.
function calcularPuntoCardinal(lat, lng, direccionGrados, distanciaM) {
    const metrosPorGradoLat = 111320;
    const metrosPorGradoLng = 111320 * Math.cos(lat * Math.PI / 180);
    const rad = direccionGrados * Math.PI / 180;
    return {
        lat: lat + (Math.cos(rad) * distanciaM) / metrosPorGradoLat,
        lng: lng + (Math.sin(rad) * distanciaM) / metrosPorGradoLng
    };
}

function puntoMedioCuadra(coords) {
    const inicio = coords[0];
    const fin = coords[coords.length - 1];
    return [(inicio[0] + fin[0]) / 2, (inicio[1] + fin[1]) / 2];
}

// Busca, entre las cuadras que ya tenemos evaluadas, una con buena accesibilidad
// (≥66% apta) cerca de la cuadra problemática, para probar una ruta que pase
// deliberadamente por ahí en lugar de adivinar un punto al costado a ciegas.
function encontrarCuadraBuenaCercana(cuadraProblema, maxDistanciaM = 250) {
    const [latProblema, lngProblema] = cuadraProblema.puntoCruce || puntoMedioCuadra(cuadraProblema.coords);
    let mejor = null;
    let mejorDist = Infinity;

    Object.values(wayStats).forEach(way => {
        if (way.pct < 66 || way.wayId === cuadraProblema.wayId) return;
        const [latWay, lngWay] = puntoMedioCuadra(way.coords);
        const d = haversine(latProblema, lngProblema, latWay, lngWay);
        if (d <= maxDistanciaM && d < mejorDist) {
            mejorDist = d;
            mejor = way;
        }
    });

    return mejor;
}

async function intentarDesvios(origen, destino, cuadraProblema, distanciaReferencia) {
    // Regla del usuario: siempre hay que rechazar una vereda en mal estado primero.
    // Solo se acepta pasar por ahí si evitarla cuesta más de N cuadras de más
    // *en ese cruce puntual* (no como porcentaje del viaje total).
    const distanciaMaxima = Math.min(MAX_ROUTE_DISTANCE_M, distanciaReferencia + (LARGO_CUADRA_M * MAX_CUADRAS_DESVIO));

    // Punto de referencia: el cruce real entre la ruta y la cuadra problemática.
    const referencia = cuadraProblema.puntoCruce || puntoMedioCuadra(cuadraProblema.coords);

    // Probamos varios puntos de paso candidatos: corrernos hacia cada costado
    // perpendicular a la calle problemática, y también en las 4 direcciones
    // cardinales (por si la calle es diagonal y "perpendicular" no cae sobre
    // ninguna calle real). Si conocemos una cuadra cercana con buena
    // accesibilidad, probamos además pasar deliberadamente por ahí.
    const candidatosVia = [
        calcularPuntoDesvio(cuadraProblema, 1, 100),
        calcularPuntoDesvio(cuadraProblema, -1, 100),
        calcularPuntoDesvio(cuadraProblema, 1, 220),
        calcularPuntoDesvio(cuadraProblema, -1, 220),
        calcularPuntoCardinal(referencia[0], referencia[1], 0, 120),
        calcularPuntoCardinal(referencia[0], referencia[1], 90, 120),
        calcularPuntoCardinal(referencia[0], referencia[1], 180, 120),
        calcularPuntoCardinal(referencia[0], referencia[1], 270, 120),
        calcularPuntoCardinal(referencia[0], referencia[1], 0, 240),
        calcularPuntoCardinal(referencia[0], referencia[1], 90, 240),
        calcularPuntoCardinal(referencia[0], referencia[1], 180, 240),
        calcularPuntoCardinal(referencia[0], referencia[1], 270, 240),
    ];

    const cuadraBuena = encontrarCuadraBuenaCercana(cuadraProblema);
    if (cuadraBuena) {
        const [lat, lng] = puntoMedioCuadra(cuadraBuena.coords);
        candidatosVia.push({ lat, lng });
    }

    const intentos = candidatosVia.map(async (via) => {
        try {
            const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${origen.lng},${origen.lat};${via.lng},${via.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson&steps=false`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes[0] && data.routes[0].distance <= distanciaMaxima) {
                const evaluado = evaluarAccesibilidadRuta(data.routes[0]);
                evaluado.esDesvio = true;
                return evaluado;
            }
        } catch (e) {
            console.error('Error probando ruta de desvío:', e);
        }
        return null;
    });

    const resultados = await Promise.all(intentos);
    return resultados.filter(r => r !== null);
}

const MAX_RONDAS_DESVIO = 3; // como mucho, tratamos de resolver 3 cuadras problemáticas por trayecto

// Parte de la mejor ruta natural y, mientras siga cruzando veredas en mal
// estado, va probando reemplazar cada cruce problemático por otro camino.
// Cada reemplazo se evalúa con presupuesto propio (MAX_CUADRAS_DESVIO por cruce),
// no como porcentaje del viaje completo.
async function resolverCuadrasProblema(origen, destino, rutaInicial) {
    let actual = rutaInicial;
    const descartadas = [];
    let huboDesvio = false;

    for (let ronda = 0; ronda < MAX_RONDAS_DESVIO; ronda++) {
        const problema = actual.cuadras
            .filter(c => c.pct < 50)
            .sort((a, b) => a.pct - b.pct)[0];

        if (!problema) break; // no queda ninguna cuadra mala en el camino actual

        const desvios = await intentarDesvios(origen, destino, problema, actual.distance);

        // Regla del usuario: rechazar SIEMPRE una vereda mal calificada tiene
        // prioridad por sobre cualquier otra consideración. Un desvío solo cuenta
        // si efectivamente deja de pasar por la cuadra problemática que se está
        // evaluando en esta ronda — mejorar el promedio general "diluyéndolo" con
        // una cuadra buena, sin dejar de pasar por la mala, NO cuenta como mejora.
        const desviosUtiles = desvios.filter(d => {
            const siguePasando = d.cuadras.some(c => c.wayId === problema.wayId);
            return !siguePasando;
        });

        if (desviosUtiles.length === 0) break; // no encontramos forma de mejorar este cruce dentro del presupuesto

        desviosUtiles.sort((a, b) => {
            const sa = a.score === null ? 50 : a.score;
            const sb = b.score === null ? 50 : b.score;
            if (sb !== sa) return sb - sa;
            return a.distance - b.distance;
        });

        descartadas.push(...desviosUtiles.slice(1));
        actual = desviosUtiles[0];
        huboDesvio = true;
    }

    return { final: actual, descartadas, huboDesvio };
}

async function calcularRuta() {
    const resultDiv = document.getElementById('routeResult');
    const btn = document.getElementById('calcRouteBtn');
    resultDiv.innerHTML = '';

    const origenTexto = document.getElementById('routeOrigin').value.trim();
    const destinoTexto = document.getElementById('routeDestination').value.trim();

    if (!origenTexto || !destinoTexto) {
        resultDiv.innerHTML = '<div class="route-error">Completá el origen y el destino.</div>';
        return;
    }

    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Calculando...';

    try {
        const origen = routeOriginCoords || await geocodeAddress(origenTexto);
        const destino = routeDestinationCoords || await geocodeAddress(destinoTexto);

        if (!origen || !destino) {
            resultDiv.innerHTML = '<div class="route-error">No pudimos encontrar una de las direcciones. Probá ser más específico.</div>';
            return;
        }

        const distanciaDirecta = haversine(origen.lat, origen.lng, destino.lat, destino.lng);
        if (distanciaDirecta > MAX_ROUTE_DISTANCE_M) {
            resultDiv.innerHTML = `<div class="route-error">El trayecto es demasiado largo para estimar (más de ${(MAX_ROUTE_DISTANCE_M / 1000).toFixed(0)} km en línea recta). Elegí puntos más cercanos.</div>`;
            return;
        }

        const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?alternatives=true&overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            resultDiv.innerHTML = '<div class="route-error">No se pudo calcular una ruta caminando entre esos puntos.</div>';
            return;
        }

        const candidatas = data.routes.filter(r => r.distance <= MAX_ROUTE_DISTANCE_M);
        if (candidatas.length === 0) {
            resultDiv.innerHTML = `<div class="route-error">El recorrido a pie supera los ${(MAX_ROUTE_DISTANCE_M / 1000).toFixed(0)} km, es demasiado largo para estimar.</div>`;
            return;
        }

        const evaluadas = candidatas.map(evaluarAccesibilidadRuta);

        const ordenar = (lista) => lista.sort((a, b) => {
            const scoreA = a.score === null ? 50 : a.score;
            const scoreB = b.score === null ? 50 : b.score;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.distance - b.distance;
        });

        ordenar(evaluadas);

        // Partimos de la mejor ruta natural y, mientras siga pasando por veredas
        // en mal estado, intentamos resolver cada una (una por vez, puede haber
        // más de una cuadra problemática en un mismo trayecto).
        const { final: elegida, descartadas: desviosDescartados, huboDesvio } =
            await resolverCuadrasProblema(origen, destino, evaluadas[0]);

        elegida.esDesvio = huboDesvio;

        const descartadas = [
            ...evaluadas.slice(1),
            ...desviosDescartados
        ].filter(r => r.score !== null && elegida.score !== null && r.score < elegida.score);

        dibujarRuta(elegida, origen, destino);
        renderRouteResult(elegida, descartadas);

    } catch (e) {
        console.error('Error calculando ruta:', e);
        resultDiv.innerHTML = '<div class="route-error">Ocurrió un error al calcular la ruta. Intentá nuevamente.</div>';
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

function limpiarRuta() {
    layerRuta.clearLayers();
    document.getElementById('routeResult').innerHTML = '';
}

function dibujarRuta(rutaEval, origen, destino) {
    layerRuta.clearLayers();

    const polyline = L.polyline(rutaEval.coords, {
        color: '#7c1f34',
        weight: 6,
        opacity: 0.9
    }).addTo(layerRuta);

    const puntoIcon = (color) => L.divIcon({
        className: 'route-point-marker',
        html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    L.marker([origen.lat, origen.lng], { icon: puntoIcon('#28a745') }).addTo(layerRuta).bindTooltip('Origen');
    L.marker([destino.lat, destino.lng], { icon: puntoIcon('#7c1f34') }).addTo(layerRuta).bindTooltip('Destino');

    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
}

function renderRouteResult(elegida, descartadas) {
    const resultDiv = document.getElementById('routeResult');
    const km = (elegida.distance / 1000).toFixed(1);
    const min = Math.round(elegida.duration / 60);

    let scoreHtml;
    if (elegida.score === null) {
        scoreHtml = `<div class="route-note">Todavía no hay opiniones de vereda cargadas en este trayecto. Sé el primero en sumar la tuya desde el mapa.</div>`;
    } else {
        const color = elegida.score >= 66 ? '#28a745' : elegida.score >= 33 ? '#e6a800' : '#dc3545';
        scoreHtml = `<div class="route-score" style="background:${color}22;color:${color}">${elegida.score}% de aptitud promedio en el trayecto</div>`;

        const problemas = elegida.cuadras.filter(c => c.pct < 50).sort((a, b) => a.pct - b.pct);
        if (problemas.length > 0) {
            scoreHtml += `
                <div class="route-warning">
                    <b>⚠ Esta ruta atraviesa ${problemas.length} tramo${problemas.length > 1 ? 's' : ''} con baja accesibilidad reportada:</b>
                    <ul>${problemas.map(c => `<li>${c.name} — ${c.pct}% apta</li>`).join('')}</ul>
                </div>`;
        }
    }

    const desvioHtml = elegida.esDesvio
        ? `<div class="route-note" style="margin-top:0.6rem">↪ Esta ruta hace un pequeño desvío respecto del camino más directo para evitar una zona con baja accesibilidad reportada.</div>`
        : '';

    const descartadasHtml = descartadas.length > 0
        ? `<div class="route-note" style="margin-top:0.6rem">Se evaluaron ${descartadas.length} ruta${descartadas.length > 1 ? 's' : ''} alternativa${descartadas.length > 1 ? 's' : ''} con peor accesibilidad estimada y se descartaron a favor de esta.</div>`
        : '';

    resultDiv.innerHTML = `
        <div class="route-summary">
            <div><span class="value">${km} km</span><span class="label">Distancia</span></div>
            <div><span class="value">${min} min</span><span class="label">A pie</span></div>
        </div>
        ${scoreHtml}
        ${desvioHtml}
        ${descartadasHtml}
        <button type="button" id="clearRouteBtn" class="btn btn-sm btn-outline-secondary w-100 mt-2">Borrar ruta del mapa</button>
    `;

    document.getElementById('clearRouteBtn').addEventListener('click', limpiarRuta);
}