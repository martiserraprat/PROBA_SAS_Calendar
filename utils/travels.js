// ==========================================
// 1. CONFIGURACIÓN Y CARGA DE DATOS
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const destinoRaw = decodeURIComponent(urlParams.get('destino') || '');
const fechaCompeticion = urlParams.get('fecha');

let dbAeropuertos = []; // Aquí guardaremos tu JSON de arrays

document.addEventListener('DOMContentLoaded', async () => {
    // UI Inicial
    document.getElementById('destination-title').innerText = destinoRaw || "Planificador de Viaje";
    
    // Carga del Mapa Google (Ubicación del evento)
    const map = document.getElementById('gmap-iframe');
    if (destinoRaw && map) {
        map.src = `https://maps.google.com/maps?q=${encodeURIComponent(destinoRaw)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    }

    // CARGA DEL JSON LOCAL (Formato Compacto)
    try {
        const response = await fetch('aeropuertos.json');
        dbAeropuertos = await response.json();
        console.log(`✅ Base de datos cargada: ${dbAeropuertos.length} aeropuertos.`);
    } catch (e) {
        console.error("Error cargando aeropuertos.json:", e);
    }

    // Eventos de botones
    document.getElementById('btn-configurar').addEventListener('click', iniciarLogistica);
    document.getElementById('flight-form').addEventListener('submit', enviarAGoogleFlights);
});

// ==========================================
// 2. LÓGICA DE LOGÍSTICA (PASO 2)
// ==========================================
async function iniciarLogistica() {
    const ciudadOrigen = document.getElementById('user-city-input').value;
    if (!ciudadOrigen) return alert("Por favor, introduce tu ciudad de origen.");

    // Cambiar de vista
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'block';

    // Rellenar fechas automáticas
    if (fechaCompeticion) {
        const d = new Date(fechaCompeticion);
        const ida = new Date(d); ida.setDate(d.getDate() - 1);
        const vuelta = new Date(d); vuelta.setDate(d.getDate() + 1);
        
        document.getElementById('date-outbound').value = ida.toISOString().split('T')[0];
        document.getElementById('date-return').value = vuelta.toISOString().split('T')[0];
    }

    // 1. Buscamos coordenadas de las ciudades (Nominatim)
    const coordOrigen = await obtenerCoords(ciudadOrigen);
    
    // Limpiamos el destino para el radar (ej: de "Estadio, Paris" a "Paris")
    const ciudadDestinoLimpia = destinoRaw.split(',').pop().replace(/\(.*\)/g, '').trim();
    const coordDestino = await obtenerCoords(ciudadDestinoLimpia);

    // 2. Ejecutar Radar Local (Búsqueda en el Array de Arrays)
    if (coordOrigen) {
        buscarCercanos(coordOrigen, 'origin-airports', 'origin-input');
    }
    if (coordDestino) {
        buscarCercanos(coordDestino, 'destination-airports', 'destination-input');
    }
}

// ==========================================
// 3. MOTOR DE BÚSQUEDA LOCAL
// ==========================================
async function obtenerCoords(ciudad) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ciudad)}&format=json&limit=1`);
        const data = await res.json();
        return data.length ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    } catch (e) { return null; }
}

function buscarCercanos(coordsRef, containerId, inputId) {
    const container = document.getElementById(containerId);
    
    // Filtramos tu base de datos: [0:IATA, 1:Nombre, 2:Lat, 3:Lon]
    const encontrados = dbAeropuertos.map(air => {
        const d = calcularDistancia(coordsRef.lat, coordsRef.lon, air[2], air[3]);
        return { iata: air[0], nombre: air[1], dist: d };
    })
    .filter(air => air.dist < 150) // Radio de 150km
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5); // Los 5 más cercanos

    container.innerHTML = encontrados.length ? "" : "<small>Sin aeropuertos cerca</small>";

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
            container.querySelectorAll('.airport-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        container.appendChild(btn);
    });
}

// ==========================================
// 4. ENVÍO A GOOGLE FLIGHTS (ESTÁNDAR PRO)
// ==========================================
function enviarAGoogleFlights(e) {
    e.preventDefault();
    
    const origin = document.getElementById('origin-input').value.trim().toUpperCase();
    const dest = document.getElementById('destination-input').value.trim().toUpperCase();
    const dateOut = document.getElementById('date-outbound').value; // YYYY-MM-DD
    const dateRet = document.getElementById('date-return').value;   // YYYY-MM-DD

    if (!origin || !dest || origin.length !== 3 || dest.length !== 3) {
        alert("⚠️ Selecciona los aeropuertos pulsando en los botones azules.");
        return;
    }

    // Google Flights prefiere las fechas limpias en su estructura de URL
    // La estructura moderna es: /flights/ORIGEN-DESTINO-FECHA*DESTINO-ORIGEN-FECHA
    
    const urlBase = "https://www.google.com/travel/flights/search-results?tfs=";
    
    // Creamos el objeto de búsqueda que Google entiende (Protocol Buffers en Base64 o JSON simplificado)
    // Pero la forma más fácil y que NO FALLA es la URL de consulta directa:
    const searchUrl = `https://www.google.com/travel/flights?q=Flights%20to%20${dest}%20from%20${origin}%20on%20${dateOut}%20through%20${dateRet}`;
    
    console.log("✈️ Buscando rutas actualizadas en Google:", searchUrl);
    window.open(searchUrl, '_blank');
}

// Utilidad matemática (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}