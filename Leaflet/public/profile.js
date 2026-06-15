let todasLasOpiniones = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarPerfil();
    cargarOpiniones();
});

async function cargarPerfil() {
    try {
        const response = await fetch(`/getPerfil`);
        if (!response.ok) throw new Error('Error al cargar el perfil');
        const user = await response.json();

        document.getElementById('profile-username').textContent = user.usuario || 'Sin nombre';
        document.getElementById('profile-email').textContent = user.email || 'Sin email';
    } catch (error) {
        console.error('Error cargando perfil:', error);
        document.getElementById('profile-username').textContent = 'Error al cargar';
        document.getElementById('profile-email').textContent = 'Intente nuevamente';
    }
}

async function cargarOpiniones() {
    const container = document.getElementById('opinions-list');

    container.innerHTML =
        '<div class="text-center text-muted" style="font-size: 1.2rem;">Cargando opiniones...</div>';

    try {
        const response = await fetch('/getOpinionesUsuario');

        if (!response.ok) {
            throw new Error('Error al cargar opiniones');
        }

        todasLasOpiniones = await response.json();

        if (todasLasOpiniones.length === 0) {
            container.innerHTML =
                '<div class="alert alert-info text-center" style="font-size: 1.1rem;">Aún no has publicado ninguna opinión.</div>';
            return;
        }

        mostrarOpiniones(todasLasOpiniones);

    } catch (error) {
        console.error('Error cargando opiniones:', error);

        container.innerHTML =
            '<div class="alert alert-danger text-center" style="font-size: 1.1rem;">No se pudieron cargar tus opiniones. Intenta más tarde.</div>';
    }
}

function mostrarOpiniones(opiniones) {
    const container = document.getElementById('opinions-list');

    if (opiniones.length === 0) {
        container.innerHTML =
            '<div class="alert alert-info text-center">No hay opiniones para mostrar.</div>';
        return;
    }

    container.innerHTML = '';

    opiniones.forEach(opinion => {
        const card = crearTarjetaOpinion(opinion);
        container.appendChild(card);
    });
}

function filtrarOpiniones(tipo) {

    document.querySelectorAll('.filtro-opinion').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-primary');
    });

    const botonActivo = document.getElementById(`btn-${tipo}`);

    if (botonActivo) {
        botonActivo.classList.remove('btn-outline-primary');
        botonActivo.classList.add('btn-primary');
    }

    if (tipo === 'todas') {
        mostrarOpiniones(todasLasOpiniones);
        return;
    }

    const filtradas = todasLasOpiniones.filter(op => op.tipo === tipo);

    mostrarOpiniones(filtradas);
}

function crearTarjetaOpinion(opinion) {
    const card = document.createElement('div');
    card.className = 'card shadow-sm rounded-3 bg-opinion-card mb-4 border-0';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-4';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'd-flex justify-content-between align-items-start mb-3';

    const tipoBadge = document.createElement('span');
    tipoBadge.className = `badge px-3 py-2`;
    tipoBadge.style.fontSize = '1rem';
    tipoBadge.style.fontWeight = '500';
    tipoBadge.textContent = opinion.tipo === 'establecimiento' ? 'Establecimiento' : 'Vereda';

    const fecha = new Date(opinion.fecha).toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const fechaSpan = document.createElement('span');
    fechaSpan.className = 'text-muted';
    fechaSpan.style.fontSize = '0.95rem';
    fechaSpan.textContent = fecha;

    headerDiv.appendChild(tipoBadge);
    headerDiv.appendChild(fechaSpan);
    cardBody.appendChild(headerDiv);

    const nombreLugar = document.createElement('h4');
    nombreLugar.className = 'card-title mb-3 font-weight-bold';
    nombreLugar.style.fontSize = '1.5rem';
    nombreLugar.textContent = opinion.nombre || (opinion.direccion || 'Lugar sin nombre');
    cardBody.appendChild(nombreLugar);

    if (opinion.tipo === 'establecimiento') {
        if (opinion.puntaje) {
            const puntajeDiv = document.createElement('div');
            puntajeDiv.className = 'mb-3';
            puntajeDiv.style.fontSize = '1.1rem';
            const estrellas = renderizarEstrellas(opinion.puntaje);
            puntajeDiv.innerHTML = `<strong>Puntaje:</strong> ${estrellas} (${opinion.puntaje}/5)`;
            cardBody.appendChild(puntajeDiv);
        }

        const accesibilidadDiv = document.createElement('div');
        accesibilidadDiv.className = 'row mt-2 mb-2';
        accesibilidadDiv.style.fontSize = '1rem';
        const campos = [
            { label: 'Espacios aptos', valor: opinion.espacios_aptos },
            { label: 'Ascensor apto', valor: opinion.ascensor_apto },
            { label: 'Baños aptos', valor: opinion.baños_aptos },
            { label: 'Puerta apta', valor: opinion.puerta_apta },
            { label: 'Rampa interna', valor: opinion.rampa_interna_apta },
            { label: 'Rampa externa', valor: opinion.rampa_externa_apta }
        ];
        let camposHtml = '<div class="col-12 mb-2"><strong>Accesibilidad:</strong></div>';
        campos.forEach(campo => {
            const icono = campo.valor == 1 ? '✓' : '✗';
            camposHtml += `<div class="col-6 col-md-4" style="font-size: 0.95rem;">${icono} ${campo.label}</div>`;
        });
        accesibilidadDiv.innerHTML = camposHtml;
        cardBody.appendChild(accesibilidadDiv);

        const descripciones = [];
        if (opinion.descripcion_espacios) descripciones.push(`Espacios: ${opinion.descripcion_espacios}`);
        if (opinion.descripcion_ascensor) descripciones.push(`Ascensor: ${opinion.descripcion_ascensor}`);
        if (opinion.descripcion_rampa_interna) descripciones.push(`Rampa interna: ${opinion.descripcion_rampa_interna}`);
        if (opinion.descripcion_rampa_externa) descripciones.push(`Rampa externa: ${opinion.descripcion_rampa_externa}`);

        if (descripciones.length > 0) {
            const descDiv = document.createElement('div');
            descDiv.className = 'mt-3 text-secondary bg-white p-2 rounded';
            descDiv.style.fontSize = '0.95rem';
            descDiv.innerHTML = `<i class="fas fa-comment"></i> ${descripciones.join(' · ')}`;
            cardBody.appendChild(descDiv);
        }
    } else {
        const apta = opinion.vereda_apta == 1;
        const estadoSpan = document.createElement('span');
        estadoSpan.className = `badge mb-3 d-inline-block`;
        estadoSpan.style.fontSize = '0.95rem';
        estadoSpan.style.padding = '0.5rem 0.8rem';
        estadoSpan.textContent = apta ? '✓ Vereda apta' : '✗ Vereda no apta';
        cardBody.appendChild(estadoSpan);

        if (opinion.descripcion_vereda) {
            const descDiv = document.createElement('div');
            descDiv.className = 'mt-2 text-secondary bg-white p-2 rounded';
            descDiv.style.fontSize = '0.95rem';
            descDiv.innerHTML = `<i class="fas fa-pencil-alt"></i> ${opinion.descripcion_vereda}`;
            cardBody.appendChild(descDiv);
        }
    }

    const ubicacionDiv = document.createElement('div');
    ubicacionDiv.className = 'mt-3 text-muted';
    ubicacionDiv.style.fontSize = '0.9rem';
    ubicacionDiv.innerHTML = `<i class="fas fa-map-marker-alt"></i> Lat: ${opinion.latitud}, Lng: ${opinion.longitud}`;
    cardBody.appendChild(ubicacionDiv);

    card.appendChild(cardBody);
    return card;
}

function renderizarEstrellas(puntaje) {
    let estrellas = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= puntaje) {
            estrellas += '<i class="fas fa-star" style="color: #ffc107; font-size: 1.2rem;"></i>';
        } else if (i - 0.5 <= puntaje) {
            estrellas += '<i class="fas fa-star-half-alt" style="color: #ffc107; font-size: 1.2rem;"></i>';
        } else {
            estrellas += '<i class="far fa-star" style="color: #ddd; font-size: 1.2rem;"></i>';
        }
    }
    return estrellas;
}