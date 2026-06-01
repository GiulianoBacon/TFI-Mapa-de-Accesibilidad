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

    var mapDiv = document.getElementById('map');
    var modal = document.getElementById('modalAddOpinion');
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

    closeModalSelection.onclick = function() {
        modalSelection.style.display = 'none';
    };

    document.getElementById('closeModalAddOpinion').addEventListener('click', function() {
        modal.style.display = 'none';
    });

    document.getElementById('closeModalAddOpinionVereda').addEventListener('click', function() {
        document.getElementById('modalAddOpinionVereda').style.display = 'none';
    });

    fetchOpinions();
    layerEstablecimientos.addTo(map);
    layerVeredas.addTo(map);
    ({ position: 'bottomright' });

    // Leyenda de colores para veredas
    const leyenda = L.control({ position: 'bottomleft' });
    leyenda.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.cssText = 'background:white;padding:8px 12px;border-radius:8px;box-shadow:0 1px 5px rgba(0,0,0,0.3);font-size:13px;line-height:1.8';
        div.innerHTML = `
            <b>Veredas</b><br>
            <span style="color:#28a745">●</span> ≥66% aptas<br>
            <span style="color:#ffc107">●</span> 33–65% aptas<br>
            <span style="color:#dc3545">●</span> &lt;33% aptas
        `;
        return div;
    };
    leyenda.addTo(map);
}

async function openEstablishmentOpinionModal(latLng) {
    const modal = document.getElementById('modalAddOpinion');
    modal.style.display = 'block';

    document.getElementById('longitud').value = latLng.lng.toFixed(8);
    document.getElementById('latitud').value = latLng.lat.toFixed(8);

    const nombreEstablecimientoInput = document.getElementById('nombreEstablecimiento');
    nombreEstablecimientoInput.value = "Buscando...";
    nombreEstablecimientoInput.removeAttribute('readonly');

    try {
        const resGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}&namedetails=1`);
        const dataGeo = await resGeo.json();

        if (dataGeo.namedetails && dataGeo.namedetails.name) {
            nombreEstablecimientoInput.value = dataGeo.namedetails.name;
        } else {
            nombreEstablecimientoInput.value = "";
        }

        const resOpinions = await fetch(`/getOpinion?lat=${latLng.lat.toFixed(8)}&lng=${latLng.lng.toFixed(8)}`);
        const dataOpinions = await resOpinions.json();

        if (dataOpinions && dataOpinions.length > 0) {
            nombreEstablecimientoInput.value = dataOpinions[0].nombre_establecimiento;
            nombreEstablecimientoInput.setAttribute('readonly', true);
        }
    } catch (error) {
        console.error("Error al inicializar el modal:", error);
        nombreEstablecimientoInput.value = "";
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
        const responseGeocode = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}`);
        const dataGeocode = await responseGeocode.json();

        if (dataGeocode.address) {
            inputDireccion.value = dataGeocode.address.road || dataGeocode.address.pedestrian || dataGeocode.display_name.split(',')[0] || "";
            inputAltura.value = dataGeocode.address.house_number || "";
        } else {
            inputDireccion.value = "";
        }
    } catch (error) {
        console.error("Error obteniendo dirección:", error);
        inputDireccion.value = "";
    }
}

// Función para obtener las opiniones y marcarlas en el mapa
async function fetchOpinions() {
    try {
        // --- ESTABLECIMIENTOS ---
        const resEst = await fetch('/getOpinions');
        if (!resEst.ok) throw new Error("Error al obtener opiniones de establecimientos");
        const estOpinions = await resEst.json();

        layerEstablecimientos.clearLayers();

        const grouped = {};
        estOpinions.forEach(op => {
            const key = `${op.latitud},${op.longitud}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(op);
        });

        Object.entries(grouped).forEach(([key, group]) => {
            const [lat, lng] = key.split(',').map(parseFloat);
            const primerOpinion = group[0];

            const marker = L.marker([lat, lng]).addTo(layerEstablecimientos);

            marker.bindPopup(`
                <b>Nombre:</b> ${primerOpinion.nombre_establecimiento}<br>
                <b>Opiniones registradas:</b> ${group.length}
            `);

            marker.bindTooltip(primerOpinion.nombre_establecimiento, {
                permanent: false,
                direction: 'top',
                offset: [0, -10],
                opacity: 0.9
            });

            marker.on('click', () => {
                fetchOpinionLatLng(lat, lng);
            });
        });

        // --- VEREDAS ---
        const resVer = await fetch('/getOpinionsVereda');
        if (!resVer.ok) throw new Error("Error al obtener opiniones de vereda");
        const verOpinions = await resVer.json();

        layerVeredas.clearLayers();

        const groupedVer = {};
        verOpinions.forEach(op => {
            const key = `${op.latitud},${op.longitud}`;
            if (!groupedVer[key]) groupedVer[key] = [];
            groupedVer[key].push(op);
        });

        Object.entries(groupedVer).forEach(([key, group]) => {
            const [lat, lng] = key.split(',').map(parseFloat);
            const primerOpinion = group[0];

            // Calcular porcentaje de "vereda_apta"
            const totalOpiniones = group.length;
            const aptasCount = group.filter(op => op.vereda_apta == 1).length;
            const porcentaje = aptasCount / totalOpiniones;

            // Color según porcentaje
            let color;
            if (porcentaje >= 0.66) {
                color = '#28a745'; // verde
            } else if (porcentaje >= 0.33) {
                color = '#ffc107'; // amarillo
            } else {
                color = '#dc3545'; // rojo
            }

            const marker = L.circleMarker([lat, lng], {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85
            }).addTo(layerVeredas);

            const pct = Math.round(porcentaje * 100);
            marker.bindPopup(`
                <b>Vereda pública</b><br>
                <b>Dirección:</b> ${primerOpinion.direccion || 'No disponible'}<br>
                <b>Aptas:</b> ${aptasCount} de ${totalOpiniones} opiniones (${pct}%)
            `);

            marker.bindTooltip(`${primerOpinion.direccion || 'Vereda'} — ${pct}% apta`, {
                permanent: false,
                direction: 'top',
                offset: [0, -5],
                opacity: 0.9
            });

            marker.on('click', () => {
                fetchOpinionLatLngVereda(lat, lng);
            });
        });

    } catch (error) {
        console.error('Hubo un problema al obtener las opiniones:', error);
    }
}

async function fetchOpinionLatLng(latitud, longitud) {
    try {
        const url = `/getOpinion?lat=${latitud}&lng=${longitud}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error al obtener opiniones: ${response.statusText}`);
        }

        const opinions = await response.json();

        const sbar = document.getElementById('sidebar');
        sbar.style.display = 'block';
        const sidebar = document.getElementById('sidebar-content');
        sidebar.style.display = 'block';
        sidebar.innerHTML = '';

        if (opinions.length === 0) {
            sidebar.innerHTML = '<p>No hay opiniones para esta ubicación.</p>';
        } else {
            opinions.forEach(opinion => {
                sidebar.innerHTML += `
                    <div>
                        <b>Nombre del establecimiento:</b> ${opinion.nombre_establecimiento}<br>
                        <b>Usuario:</b> ${opinion.nombreUsuario}<br>
                        <b>Espacios aptos:</b> ${opinion.espacios_aptos ? 'Sí' : 'No'}<br>
                        <b>Ascensor apto:</b> ${opinion.ascensor_apto ? 'Sí' : 'No'}<br>
                        <b>Baños aptos:</b> ${opinion.baños_aptos ? 'Sí' : 'No'}<br>
                        <b>Puerta apta:</b> ${opinion.puerta_apta ? 'Sí' : 'No'}<br>
                        <b>Rampa interna apta:</b> ${opinion.rampa_interna_apta ? 'Sí' : 'No'}<br>
                        <b>Rampa externa apta:</b> ${opinion.rampa_externa_apta ? 'Sí' : 'No'}<br>
                        <b>Descripción espacios:</b> ${opinion.descripcion_espacios || 'No disponible'}<br>
                        <b>Descripción ascensor:</b> ${opinion.descripcion_ascensor || 'No disponible'}<br>
                        <b>Descripción rampa interna:</b> ${opinion.descripcion_rampa_interna || 'No disponible'}<br>
                        <b>Descripción rampa externa:</b> ${opinion.descripcion_rampa_externa || 'No disponible'}<br>
                        <b>Fecha:</b> ${opinion.fecha}<br>
                        <b>Puntaje:</b> ${opinion.puntaje || 'No evaluado'}
                    </div>
                    <hr>
                `;
            });

            const btnAgregar = document.createElement('button');
            btnAgregar.className = 'btn btn-sm btn-primary mt-2';
            btnAgregar.innerText = 'Agregar otra opinión';
            btnAgregar.onclick = () => {
                openEstablishmentOpinionModal({ lat: parseFloat(latitud), lng: parseFloat(longitud) });
                document.getElementById('sidebar').style.display = 'none';
            };
            sidebar.appendChild(btnAgregar);
        }

    } catch (error) {
        console.error('Hubo un problema al obtener las opiniones:', error);
    }
}

async function fetchOpinionLatLngVereda(lat, lng) {
    try {
        const response = await fetch(`/getOpinionVereda?lat=${lat}&lng=${lng}`);
        const opinions = await response.json();
        const sidebar = document.getElementById('sidebar-content');
        document.getElementById('sidebar').style.display = 'block';
        sidebar.innerHTML = '';

        if (opinions.length === 0) {
            sidebar.innerHTML = '<p>No hay opiniones de vereda para esta ubicación.</p>';
        } else {
            opinions.forEach(opinion => {
                sidebar.innerHTML += `
                    <div>
                        <b>Usuario:</b> ${opinion.nombreUsuario}<br>
                        <b>¿Vereda apta?:</b> ${opinion.vereda_apta ? 'Sí' : 'No'}<br>
                        <b>Descripción:</b> ${opinion.descripcion_vereda || 'No disponible'}<br>
                        <b>Fecha:</b> ${opinion.fecha}
                    </div>
                    <hr>
                `;
            });

            const btnAgregar = document.createElement('button');
            btnAgregar.className = 'btn btn-sm btn-secondary mt-2';
            btnAgregar.innerText = 'Agregar otra opinión de vereda';
            btnAgregar.onclick = () => {
                openVeredaOpinionModal({ lat, lng });
                document.getElementById('sidebar').style.display = 'none';
            };
            sidebar.appendChild(btnAgregar);
        }
    } catch (error) {
        console.error('Hubo un problema al obtener opiniones de vereda:', error);
    }
}

async function handleSearch() {
    const query = document.getElementById('busqueda');
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.value)}`);
    const data = await response.json();
    if (data.length > 0) {
        const [lon, lat] = [data[0].lon, data[0].lat];
        map.panTo(new L.LatLng(parseFloat(lat), parseFloat(lon)));
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }
        currentMarker = L.marker([parseFloat(lat), parseFloat(lon)]).addTo(map);
    }
}

async function handleInputChange() {
    clearTimeout(timeout);

    timeout = setTimeout(async () => {
        const query = document.getElementById('busqueda').value;

        if (query.length > 5) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setSuggestions(data);
            } catch (error) {
                console.error('Error en la búsqueda:', error);
            }
        } else {
            setSuggestions([]);
        }
    }, 500);
}

function setSuggestions(data) {
    const suggestionsList = document.getElementById('suggestions');
    suggestionsList.innerHTML = '';

    if (data.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No hay sugerencias disponibles';
        suggestionsList.appendChild(li);
        return;
    }

    data.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = item.display_name;
        li.setAttribute('key', index);
        li.onclick = () => handleSuggestionClick(item);
        suggestionsList.appendChild(li);
    });
}

function handleSuggestionClick(suggestion) {
    const query = document.getElementById('busqueda');
    query.value = suggestion.display_name;
    handleSearch();
    const suggestionsList = document.getElementById('suggestions');
    suggestionsList.innerHTML = '';
}

function addOpinion_establecimiento(event) {
    event.preventDefault();

    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
        alert('Debes iniciar sesión para publicar una opinión');
        return;
    }

    const formData = new FormData(event.target);

    const data = {
        latitud: formData.get("latitud"),
        longitud: formData.get("longitud"),
        Usuario_idUsuario: 1,
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
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error("Error en la solicitud: " + response.statusText);
        return response.json();
    })
    .then(data => {
        alert(data.message);
        fetchOpinions();
        event.target.reset();
        document.getElementById('modalAddOpinion').style.display = 'none';
    })
    .catch(error => {
        console.error("Hubo un problema con la solicitud:", error);
    });
}

async function addOpinion_vereda(event) {
    event.preventDefault();

    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
        alert('Debes iniciar sesión para publicar una opinión');
        return;
    }

    const formData = new FormData(event.target);
    const direccionCompleta = `${formData.get("direccion_vereda")} ${formData.get("altura_vereda")}`.trim();

    const data = {
        latitud: formData.get("latitud_vereda"),
        longitud: formData.get("longitud_vereda"),
        direccion: direccionCompleta,
        Usuario_idUsuario: 1,
        vereda_apta: formData.has("vereda_apta") ? 1 : 0,
        descripcion_vereda: formData.get("descripcion_vereda")
    };

    try {
        const response = await fetch("/createOpinion_vereda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error("Error en la solicitud: " + response.statusText);

        const result = await response.json();
        alert(result.message);
        fetchOpinions();
        event.target.reset();
        document.getElementById('modalAddOpinionVereda').style.display = 'none';

    } catch (error) {
        console.error("Hubo un problema con la solicitud:", error);
    }
}

function toggleLayer(type) {
    if (type === 'establecimientos') {
        if (map.hasLayer(layerEstablecimientos)) {
            map.removeLayer(layerEstablecimientos);
        } else {
            map.addLayer(layerEstablecimientos);
        }
    } else {
        if (map.hasLayer(layerVeredas)) {
            map.removeLayer(layerVeredas);
        } else {
            map.addLayer(layerVeredas);
        }
    }
}