let map;
let currentMarker;
let timeout; 

document.addEventListener('DOMContentLoaded', () => {
    map = L.map('map').setView([-34.7334, -58.3920], 16);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var mapDiv = document.getElementById('map');
    var modal = document.getElementById('modalAddOpinion');

    mapDiv.addEventListener('dblclick', function() {
        const latLng = map.mouseEventToLatLng(event);
        modal.style.display = 'block';

        var long = document.getElementById('longitud');
        var lat = document.getElementById('latitud');

        long.value = latLng.lng.toFixed(8);
        lat.value = latLng.lat.toFixed(8); 
    });

    document.getElementById('closeModalAddOpinion').addEventListener('click', function() {
        modal.style.display = 'none';
    });

});


async function handleSearch() {
    const query = document.getElementById('busqueda')
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
};

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
};


function setSuggestions(data){
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
};

function handleSuggestionClick (suggestion) {
    const query = document.getElementById('busqueda');
    query.value = suggestion.display_name;
    handleSearch();
    const suggestionsList = document.getElementById('suggestions');
    suggestionsList.innerHTML = '';
};

function addOpinion_establecimiento(event){
    event.preventDefault();
  
    const formData = new FormData(event.target);
  
    const data = {
        latitud: formData.get("latitud"),
        longitud: formData.get("longitud"),
        Usuario_idUsuario: 1,
        espacios_aptos: formData.has("espacios_aptos"),
        ascensor_apto: formData.has("ascensor_apto"),
        baños_aptos: formData.has("baños_aptos"),
        puerta_apta: formData.has("puerta_apta"),
        rampa_interna_apta: formData.has("rampa_interna_apta"),
        rampa_externa_apta: formData.has("rampa_externa_apta"),
        descripcion_rampa_interna: formData.get("descripcion_rampa_interna"),
        descripcion_ascensor: formData.get("descripcion_ascensor"),
        descripcion_rampa_externa: formData.get("descripcion_rampa_externa"),
        descripcion_espacios: formData.get("descripcion_espacios")
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
        event.target.reset();
        var modal = document.getElementById('modalAddOpinion');
        modal.style.display = 'none';
    })
    .catch(error => {
        console.error("Hubo un problema con la solicitud:", error);
    });
};