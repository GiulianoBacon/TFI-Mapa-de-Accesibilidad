let map;
let currentMarker;
let timeout;
let layerEstablecimientos = L.layerGroup();
let layerVeredas = L.layerGroup();

function initMap() {
    map = L.map('map').setView([-34.7334, -58.3920], 16);

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
                puntosUnicos.push({ lat: op.latitud, lng: op.longitud, key });
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
function mostrarOpinionesVereda(nombreCalle, opinions) {
    const sbar = document.getElementById('sidebar');
    const sidebar = document.getElementById('sidebar-content');
    sbar.style.display = 'block';

    const total = opinions.length;
    const aptas = opinions.filter(op => op.vereda_apta == 1).length;
    const pct = Math.round((aptas / total) * 100);
    let colorTexto = pct >= 66 ? '#28a745' : pct >= 33 ? '#e6a800' : '#dc3545';
    let estadoTexto = pct >= 66 ? 'Buena accesibilidad' : pct >= 33 ? 'Accesibilidad media' : 'Baja accesibilidad';

    sidebar.innerHTML = `
        <h6 style="font-weight:bold;margin-bottom:4px">${nombreCalle}</h6>
        <div style="margin-bottom:10px;padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px">
            <span style="color:${colorTexto};font-weight:bold">${estadoTexto}</span>
            &nbsp;·&nbsp; ${aptas} de ${total} opiniones aptas (${pct}%)
        </div>
        <hr style="margin:8px 0">
    `;

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
        const response = await fetch(`/getOpinion?lat=${latitud}&lng=${longitud}`);
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
        sidebar.innerHTML = `
            <h6 style="font-weight:bold;margin-bottom:2px">${nombre}</h6>
            <div style="font-size:12px;color:#888;margin-bottom:10px">${total} opinión${total > 1 ? 'es' : ''}</div>

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

async function openVeredaOpinionModal(latLng) {
    const modal = document.getElementById('modalAddOpinionVereda');
    modal.style.display = 'block';
    document.getElementById('latitud_vereda').value = latLng.lat.toFixed(8);
    document.getElementById('longitud_vereda').value = latLng.lng.toFixed(8);

    const inputDireccion = document.getElementById('direccion_vereda');
    const inputAltura = document.getElementById('altura_vereda');
    inputDireccion.value = "Buscando calle...";
    inputAltura.value = "";

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
    .then(res => {
        if (!res.ok) {
            if (res.status === 401) throw new Error('No autenticado');
            throw new Error(res.statusText);
        }
        return res.json();
    })
    .then(data => {
        alert(data.message);
        fetchOpinions();  // recargar el mapa para mostrar la nueva opinión
        event.target.reset();
        document.getElementById('modalAddOpinion').style.display = 'none';
    })
    .catch(e => {
        console.error("Error:", e);
        if (e.message === 'No autenticado') {
            alert('Debes iniciar sesión para publicar una opinión');
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

    const formData = new FormData(event.target);
    const direccionCompleta = `${formData.get("direccion_vereda")} ${formData.get("altura_vereda")}`.trim();

    const data = {
        latitud: formData.get("latitud_vereda"),
        longitud: formData.get("longitud_vereda"),
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
            throw new Error(res.statusText);
        }
        const result = await res.json();
        alert(result.message);
        fetchOpinions();   // recargar el mapa
        event.target.reset();
        document.getElementById('modalAddOpinionVereda').style.display = 'none';
    } catch (e) {
        console.error("Error:", e);
        if (e.message === 'No autenticado') {
            alert('Debes iniciar sesión para publicar una opinión');
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