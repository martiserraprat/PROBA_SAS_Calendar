// ==========================================
// 1. CONFIGURACIÓN Y CARGA DE DATOS
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const destinoRaw = decodeURIComponent(urlParams.get('destino') || '');
const fechaCompeticion = urlParams.get('fecha');

let dbAeropuertos = [];
let coordsSede = null; 

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('destination-title').innerText = destinoRaw || "Planificador de Viaje";
    
    // Carga del Mapa Google (Corregido: sin el '0' o '1' delante de la llave)
    const map = document.getElementById('gmap-iframe');
    if (destinoRaw && map) {
        map.src = `https://maps.google.com/maps?q=${encodeURIComponent(destinoRaw)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    }

    // Cargar JSON de aeropuertos
    try {
        const response = await fetch('aeropuertos.json');
        dbAeropuertos = await response.json();
    } catch (e) { 
        console.error("Error cargando aeropuertos.json", e); 
    }

    document.getElementById('btn-configurar').addEventListener('click', iniciarLogistica);
    document.getElementById('flight-form').addEventListener('submit', enviarAGoogleFlights);
});

// ==========================================
// 2. LÓGICA DE LOGÍSTICA
// ==========================================
async function iniciarLogistica() {
    const ciudadOrigen = document.getElementById('user-city-input').value;
    if (!ciudadOrigen) return alert("Introduce tu ciudad de origen");

    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'block';

    // Rellenar fechas automáticamente
    if (fechaCompeticion) {
        const d = new Date(fechaCompeticion);
        const ida = new Date(d); ida.setDate(d.getDate() - 2); // 2 días antes
        const vuelta = new Date(d); vuelta.setDate(d.getDate() + 2); // 2 días después
        document.getElementById('date-outbound').value = ida.toISOString().split('T')[0];
        document.getElementById('date-return').value = vuelta.toISOString().split('T')[0];
    }

    // 1. Obtener Coordenadas Origen (Nominatim)
    const resO = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ciudadOrigen)}&format=json&limit=1`);
    const dataO = await resO.json();

    // 2. Obtener Coordenadas Destino
    const ciudadDestinoLimpia = destinoRaw.split(',').pop().replace(/\(.*\)/g, '').trim();
    const resD = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ciudadDestinoLimpia)}&format=json&limit=1`);
    const dataD = await resD.json();

    let originCoords = null;
    if (dataO.length) {
        originCoords = { lat: parseFloat(dataO[0].lat), lon: parseFloat(dataO[0].lon) };
        ejecutarRadarLocal(dataO[0], 'origin-airports', 'origin-input', false);
    }

    if (dataD.length) {
        coordsSede = { lat: parseFloat(dataD[0].lat), lon: parseFloat(dataD[0].lon) };
        ejecutarRadarLocal(dataD[0], 'destination-airports', 'destination-input', true);
    }

    mostrarOpcionCoche(ciudadOrigen, destinoRaw, originCoords);
}

// ==========================================
// 3. RADAR Y DISTANCIAS
// ==========================================
function ejecutarRadarLocal(coords, containerId, inputId, esDestino) {
    const container = document.getElementById(containerId);
    const lat = parseFloat(coords.lat);
    const lon = parseFloat(coords.lon);

    const encontrados = dbAeropuertos.map(air => ({
        iata: air[0],
        nombre: air[1],
        lat: air[2],
        lon: air[3],
        dist: calcularDistancia(lat, lon, air[2], air[3])
    }))
    .filter(air => air.dist < 250) // Radio de 250km
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

    container.innerHTML = encontrados.length ? "" : "<small>No hay aeropuertos cerca</small>";

    encontrados.forEach(air => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "airport-pill big-pill";
        btn.innerHTML = `
            <div class="pill-left"><b>${air.iata}</b></div>
            <div class="pill-right">
                <span class="air-name">${air.nombre}</span>
                <span class="air-dist">a ${air.dist.toFixed(1)} km</span>
            </div>`;

        btn.onclick = () => {
            document.getElementById(inputId).value = air.iata;

            if (esDestino && coordsSede) {
                const kmHastaSede = calcularDistancia(coordsSede.lat, coordsSede.lon, air.lat, air.lon);
                const airportToEvent = document.getElementById('airport-to-event');
                airportToEvent.innerHTML = `
                    <div class="info-mini-transfer" style="display:flex; align-items:center; gap:12px; justify-content: space-between;">
                        <span>Desde <b>${air.iata}</b> estás a <b>${kmHastaSede.toFixed(1)} km</b> de la sede.</span>
                        <button id="btn-air-to-event" class="btn-drive-compact" style="padding: 8px 15px; font-size: 0.8rem;">
                            <i class="fas fa-route"></i> Maps
                        </button>
                    </div>
                `;

                document.getElementById('btn-air-to-event').onclick = () => {
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${air.lat},${air.lon}&destination=${coordsSede.lat},${coordsSede.lon}&travelmode=driving`;
                    window.open(url, '_blank');
                };
            }

            container.querySelectorAll('.airport-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        container.appendChild(btn);
    });
}

// ==========================================
// 4. OPCIÓN COCHE Y VUELOS
// ==========================================
function mostrarOpcionCoche(origen, destino, originCoords = null) {
    const driveDiv = document.getElementById('drive-info');
    driveDiv.style.display = 'block';
    document.getElementById('drive-distance-text').innerText = `Ruta desde ${origen}`;

    const btn = document.getElementById('btn-drive-maps');
    btn.onclick = () => {
        let o = originCoords ? `${originCoords.lat},${originCoords.lon}` : encodeURIComponent(origen);
        let d = coordsSede ? `${coordsSede.lat},${coordsSede.lon}` : encodeURIComponent(destino);
        const url = `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`;
        window.open(url, '_blank');
    };
}

function enviarAGoogleFlights(e) {
    e.preventDefault();
    const origin = document.getElementById('origin-input').value;
    const dest = document.getElementById('destination-input').value;
    const dateOut = document.getElementById('date-outbound').value;
    const dateRet = document.getElementById('date-return').value;

    if (!origin || !dest) return alert("Selecciona los aeropuertos haciendo clic en ellos.");

    // URL directa y moderna de Google Flights
    const searchUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${dest}%20from%20${origin}%20on%20${dateOut}%20through%20${dateRet}`;
    window.open(searchUrl, '_blank');
}

// Fórmulas matemáticas
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}