// ranking.js — Top colaboradores del mapa (home)

function nivelColaborador(total) {
    if (total >= 10) return 'Súper colaborador';
    if (total >= 3) return 'Colaborador activo';
    return 'Colaborador';
}

function medallaORango(posicion) {
    const medallas = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return medallas[posicion] || `#${posicion}`;
}

async function cargarRanking() {
    const contenedor = document.getElementById('ranking-container');
    if (!contenedor) return;

    try {
        const res = await fetch('/getTopColaboradores');
        if (!res.ok) throw new Error('Error al obtener el ranking');
        const datos = await res.json();

        if (!datos || datos.length === 0) {
            contenedor.innerHTML = '<div class="ranking-empty">Todavía no hay opiniones cargadas. ¡Sé el primer colaborador del mapa!</div>';
            return;
        }

        contenedor.innerHTML = '';
        datos.forEach((persona, index) => {
            contenedor.appendChild(crearTarjetaColaborador(persona, index + 1));
        });
    } catch (error) {
        console.error('Error cargando ranking:', error);
        contenedor.innerHTML = '<div class="ranking-empty">No se pudo cargar el ranking en este momento.</div>';
    }
}

function crearTarjetaColaborador(persona, posicion) {
    const card = document.createElement('div');
    card.className = 'ranking-card flip-card';
    card.tabIndex = 0; // permite activar el flip con teclado (:focus-within)

    const total = persona.total;
    const detalle = [];
    if (persona.establecimientos > 0) detalle.push(`${persona.establecimientos} de establecimientos`);
    if (persona.veredas > 0) detalle.push(`${persona.veredas} de veredas`);

    card.innerHTML = `
        <div class="flip-card-inner">
            <div class="flip-card-front">
                <div class="ranking-badge">${medallaORango(posicion)}</div>
                <div class="ranking-name">${persona.nombreUsuario}</div>
            </div>
            <div class="flip-card-back">
                <div class="ranking-total">${total}</div>
                <div class="ranking-label">opinión${total === 1 ? '' : 'es'} en total</div>
                <div class="ranking-detalle">${detalle.join(' · ') || '&nbsp;'}</div>
                <div class="ranking-nivel">${nivelColaborador(total)}</div>
            </div>
        </div>
    `;

    return card;
}
