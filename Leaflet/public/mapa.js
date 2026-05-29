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

        // Evento para opción Establecimiento
        optionEstablishment.onclick = () => {
            console.log("Opción Establecimiento seleccionada");
            modalSelection.style.display = 'none';
            openEstablishmentOpinionModal(latLng);
        };

        // Evento para opción Vereda
        optionSidewalk.onclick = () => {
            console.log("Opción Vereda seleccionada");
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

    // Llama a la función para obtener las opiniones cuando se carga la página
    fetchOpinions();
    layerEstablecimientos.addTo(map);
    layerVeredas.addTo(map);
}

async function openEstablishmentOpinionModal(latLng) {
    console.log("Coordenadas:", latLng);
    const modal = document.getElementById('modalAddOpinion');
    modal.style.display = 'block';
    
    // Asignar coordenadas a los inputs ocultos
    document.getElementById('longitud').value = latLng.lng.toFixed(8);
    document.getElementById('latitud').value = latLng.lat.toFixed(8);
    
    const nombreEstablecimientoInput = document.getElementById('nombreEstablecimiento');
    nombreEstablecimientoInput.value = "Buscando...";
    nombreEstablecimientoInput.removeAttribute('readonly');

    try {
        // 1. Primero, intentamos obtener el nombre del lugar de OSM (Nominatim)
        const resGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}&namedetails=1`);
        const dataGeo = await resGeo.json();
        
        if (dataGeo.namedetails && dataGeo.namedetails.name) {
            nombreEstablecimientoInput.value = dataGeo.namedetails.name;
        } else {
            nombreEstablecimientoInput.value = "";
        }

        // 2. Luego, verificamos si YA existen opiniones en la BD para este punto
        const resOpinions = await fetch(`/getOpinion?lat=${latLng.lat.toFixed(8)}&lng=${latLng.lng.toFixed(8)}`);
        const dataOpinions = await resOpinions.json();

        if (dataOpinions && dataOpinions.length > 0) {
            // Si hay opiniones, prevalece el nombre que ya está en la base de datos
            nombreEstablecimientoInput.value = dataOpinions[0].nombre_establecimiento;
            nombreEstablecimientoInput.setAttribute('readonly', true);
        }
    } catch (error) {
        console.error("Error al inicializar el modal:", error);
        nombreEstablecimientoInput.value = "";
    }
}


   
function openVeredaOpinionModal(latLng) {
    const modal = document.getElementById('modalAddOpinionVereda');
    modal.style.display = 'block';

    document.getElementById('latitud_vereda').value = latLng.lat.toFixed(8);
    document.getElementById('longitud_vereda').value = latLng.lng.toFixed(8);
}

// Ícono rojo para vereda (definilo al inicio del archivo, junto con otros íconos)
const redSidewalkIcon = L.icon({
    iconUrl: 'https://cdn.pixabay.com/photo/2015/12/14/20/29/tracker-1093167_1280.png', // pin amarillo, cambiá si querés
    iconSize: [18, 30],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41],
    shadowAnchor: [12, 41]
});

// Función para obtener la lista de opiniones y marcarlas en el mapa
async function fetchOpinions() {
    try {
        // Opiniones de establecimiento
        const resEst = await fetch('http://localhost:3001/getOpinions');
        if (!resEst.ok) throw new Error("Error al obtener opiniones de establecimientos");
        const estOpinions = await resEst.json();

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
                <b>Opiniones registradas:</b> ${group.length}<br>
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

        // Opiniones de vereda
        const resVer = await fetch('http://localhost:3001/getOpinionsVereda');
        if (!resVer.ok) throw new Error("Error al obtener opiniones de vereda");
        const verOpinions = await resVer.json();

        console.log('Opiniones vereda:', verOpinions);

        verOpinions.forEach(op => {
            console.log(`Latitud: ${op.latitud}, Longitud: ${op.longitud}`);  // <--- Esto te muestra cada coordenada
        });

        const groupedVer = {};
        verOpinions.forEach(op => {
            const key = `${op.latitud},${op.longitud}`;
            if (!groupedVer[key]) groupedVer[key] = [];
            groupedVer[key].push(op);
        });

        Object.entries(groupedVer).forEach(([key, group]) => {
            const [lat, lng] = key.split(',').map(parseFloat);
            console.log('Creando marcador vereda en:', lat, lng);
            const primerOpinion = group[0];

            
            const marker = L.marker([lat, lng], { icon: redSidewalkIcon }).addTo(layerVeredas);

// CAMBIA ESTO:
marker.bindPopup(`
    <b>Opinión sobre vereda pública</b><br>
    <b>Dirección:</b> ${primerOpinion.direccion || 'No disponible'}<br>
    <b>Vereda apta:</b> ${primerOpinion.vereda_apta ? 'Sí' : 'No'}<br>
    <b>Opiniones registradas:</b> ${group.length}<br>
`);

// PARA QUE EL TOOLTIP MUESTRE LA DIRECCIÓN:
marker.bindTooltip(primerOpinion.direccion || 'Vereda pública', {
    permanent: false,
    direction: 'top',
    offset: [0, -10],
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
        const url = `http://localhost:3001/getOpinion?lat=${latitud}&lng=${longitud}`;
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
                const opinionHTML = `
                    <div>
                        <b>Nombre del establecimiento:</b> ${opinion.nombre_establecimiento}<br>
                        <b>Opinión de usuario:</b> ${opinion.nombreUsuario}<br>
                        <b>Espacios aptos:</b> ${opinion.espacios_aptos ? 'Sí' : 'No'}<br>
                        <b>Ascensor apto:</b> ${opinion.ascensor_apto ? 'Sí' : 'No'}<br>
                        <b>Baños aptos:</b> ${opinion.baños_aptos ? 'Sí' : 'No'}<br>
                        <b>Puerta apta:</b> ${opinion.puerta_apta ? 'Sí' : 'No'}<br>
                        <b>Rampa interna apta:</b> ${opinion.rampa_interna_apta ? 'Sí' : 'No'}<br>
                        <b>Rampa externa apta:</b> ${opinion.rampa_externa_apta ? 'Sí' : 'No'}<br>
                        <b>Descripción de los espacios:</b> ${opinion.descripcion_espacios || 'No disponible'}<br>
                        <b>Descripción del ascensor:</b> ${opinion.descripcion_ascensor || 'No disponible'}<br>
                        <b>Descripción de la rampa interna:</b> ${opinion.descripcion_rampa_interna || 'No disponible'}<br>
                        <b>Descripción de la rampa externa:</b> ${opinion.descripcion_rampa_externa || 'No disponible'}<br>
                        <b>Fecha:</b> ${opinion.fecha}<br>
                        <b>Puntaje:</b> ${opinion.puntaje || 'No evaluado'}<br>  <!-- <--- Agregado -->
                    </div>
                    <hr>
                `;
                sidebar.innerHTML += opinionHTML;
            });
            const btnAgregar = document.createElement('button');
            btnAgregar.innerText = 'Agregar otra opinión';
            btnAgregar.onclick = () => {
                openEstablishmentOpinionModal({ lat: parseFloat(latitud), lng: parseFloat(longitud) });
                document.getElementById('sidebar').style.display = 'none'; // opcional: cerrar barra

            };

            sidebar.appendChild(btnAgregar);
        }

    } catch (error) {
        console.error('Hubo un problema al obtener las opiniones:', error);
    }
}

async function fetchOpinionLatLngVereda(lat, lng) {
    const response = await fetch(`http://localhost:3001/getOpinionVereda?lat=${lat}&lng=${lng}`);
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
                    <b>Opinión de usuario:</b> ${opinion.nombreUsuario}<br>
                    <b>¿Vereda apta?:</b> ${opinion.vereda_apta ? 'Sí' : 'No'}<br>
                    <b>Descripción:</b> ${opinion.descripcion_vereda}<br>
                    <b>Fecha:</b> ${opinion.fecha}
                </div>
                <hr>
            `;
        });
        const btnAgregar = document.createElement('button');
        btnAgregar.innerText = 'Agregar otra opinión de vereda';
        btnAgregar.onclick = () => {
            // Pasamos las coordenadas a la función openVeredaOpinionModal
            openVeredaOpinionModal({ lat, lng });
            document.getElementById('sidebar').style.display = 'none';
        };
        sidebar.appendChild(btnAgregar);
    }
}

// Función para manejar la búsqueda y centrar el mapa
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

// Función para manejar los cambios en el input de búsqueda con retraso
async function handleInputChange() {
    clearTimeout(timeout);

    timeout = setTimeout(async () => {
        const query = document.getElementById('busqueda').value;
        console.log("Input value:", query);

        if (query.length > 5) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setSuggestions(data); // Actualiza las sugerencias
            } catch (error) {
                console.error('Error en la búsqueda:', error);
            }
        } else {
            setSuggestions([]); // Limpiar las sugerencias si el texto es muy corto
        }
    }, 500); // Espera 500 milisegundos antes de ejecutar la búsqueda
}

// Función para mostrar las sugerencias de búsqueda
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

// Función para manejar el clic en una sugerencia
function handleSuggestionClick(suggestion) {
    const query = document.getElementById('busqueda');
    query.value = suggestion.display_name;
    handleSearch();
    const suggestionsList = document.getElementById('suggestions');
    suggestionsList.innerHTML = '';
}

// Función para agregar una nueva opinión desde el formulario
function addOpinion_establecimiento(event) {
    event.preventDefault();

    // Verifica si el usuario está logueado
    const loggedIn = localStorage.getItem('loggedIn') === 'true';

    if (!loggedIn) {
        alert('Debes iniciar sesión para publicar una opinión');
        return; // No se permite continuar si el usuario no está logueado
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

    fetch("http://localhost:3001/createOpinion_establecimiento", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log(response);
        if (!response.ok) {
            throw new Error("Error en la solicitud: " + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log(data);
        alert(data.message);
         // Cierra el popup automáticamente después de que se haya mostrado el mensaje
    fetchOpinions();
    setTimeout(() => {
        var modal = document.getElementById('modalAddOpinion');
        modal.style.display = 'none'; // Cierra el popup
        }, 1000); // Espera 1 segundo antes de cerrar el popup
        event.target.reset();
        var modal = document.getElementById('modalAddOpinion');
        modal.style.display = 'none';
    })
    .catch(error => {
        console.error("Hubo un problema con la solicitud:", error);
    });

    
}

// Cuando se abre el modal, buscamos la dirección y la escribimos en los inputs
async function openVeredaOpinionModal(latLng) {
    const modal = document.getElementById('modalAddOpinionVereda');
    modal.style.display = 'block';

    document.getElementById('latitud_vereda').value = latLng.lat.toFixed(8);
    document.getElementById('longitud_vereda').value = latLng.lng.toFixed(8);
    
    // Ponemos "Buscando..." mientras Nominatim hace su trabajo
    const inputDireccion = document.getElementById('direccion_vereda');
    const inputAltura = document.getElementById('altura_vereda');
    inputDireccion.value = "Buscando calle...";
    inputAltura.value = "";

    try {
        const responseGeocode = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}`);
        const dataGeocode = await responseGeocode.json();
        
        if (dataGeocode.address) {
            // Autocompletamos con los datos (calle y altura)
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

// Al hacer clic en Enviar, tomamos lo que haya en los inputs (autocompletado o corregido a mano)
async function addOpinion_vereda(event) {
    event.preventDefault();
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (!loggedIn) {
        alert('Debes iniciar sesión para publicar una opinión');
        return;
    }

    const formData = new FormData(event.target);
    
    // Concatenamos lo que haya en los inputs de dirección y altura
    const direccionCompleta = `${formData.get("direccion_vereda")} ${formData.get("altura_vereda")}`.trim();
    
    const data = {
        latitud: formData.get("latitud_vereda"),
        longitud: formData.get("longitud_vereda"),
        direccion: direccionCompleta, // Acá mandamos el texto listo al backend
        Usuario_idUsuario: 1, 
        vereda_apta: formData.has("vereda_apta") ? 1 : 0,
        descripcion_vereda: formData.get("descripcion_vereda")
    };
    
    try {
        const response = await fetch("http://localhost:3001/createOpinion_vereda", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error("Error en la solicitud: " + response.statusText);
        }
        
        const result = await response.json();
        alert(result.message);
        fetchOpinions();
        setTimeout(() => {
            document.getElementById('modalAddOpinionVereda').style.display = 'none';
        }, 1000);
        event.target.reset();
        
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