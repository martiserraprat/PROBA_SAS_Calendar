// 1. Obtener parámetros y LIMPIAR el destino
const urlParams = new URLSearchParams(window.location.search);
const destinoRaw = decodeURIComponent(urlParams.get('destino') || '');
const fechaCompeticion = urlParams.get('fecha');

// Función para extraer SOLO la ciudad (ej: de "Sätrahallen, Stockholm (SWE)" saca "Stockholm")
function limpiarDestinoParaRadar(texto) {
    if (!texto) return "";
    // 1. Quitamos lo que haya entre paréntesis (ej: SWE)
    let limpio = texto.replace(/\(.*\)/g, '');
    // 2. Si hay una coma, nos quedamos con la parte de la derecha (la ciudad)
    if (limpio.includes(',')) {
        const partes = limpio.split(',');
        limpio = partes[partes.length - 1]; 
    }
    return limpio.trim();
}

const ciudadDestinoLimpia = limpiarDestinoParaRadar(destinoRaw);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('destination-title').innerText = destinoRaw || "Destino Desconocido";
    
    // Mapa: Aquí sí usamos el nombre completo para que marque el sitio exacto
    const map = document.getElementById('gmap-iframe');
    if(destinoRaw) {
        map.src = `https://maps.google.com/maps?q=${encodeURIComponent(destinoRaw)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }

    document.getElementById('btn-configurar').addEventListener('click', iniciarLogistica);
});
async function iniciarLogistica() {
    const ciudadOrigen = document.getElementById('user-city-input').value;
    if (!ciudadOrigen) return alert("Escribe tu ciudad de origen");

    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'block';

    // Rellenar fechas (Ida: día anterior, Vuelta: día posterior)
    if (fechaCompeticion) {
        const d = new Date(fechaCompeticion);
        const ida = new Date(d); ida.setDate(d.getDate() - 1);
        const vuelta = new Date(d); vuelta.setDate(d.getDate() + 1);
        document.getElementById('date-outbound').value = ida.toISOString().split('T')[0];
        document.getElementById('date-return').value = vuelta.toISOString().split('T')[0];
    }

    // 🚀 LANZAMIENTO DE RADARES
    // Radar 1: Ciudad que escribe el usuario
    buscarAeropuertos(ciudadOrigen, 'origin-airports', 'origin-input');
    
    // Radar 2: Ciudad del evento (usando el nombre LIMPIO)
    // Pasamos 'ciudadDestinoLimpia' (ej: Stockholm) en lugar de 'destinoRaw'
    buscarAeropuertos(ciudadDestinoLimpia, 'destination-airports', 'destination-input');
}

async function buscarAeropuertos(nombreCiudad, containerId, inputId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "<span class='loader'>📡 Escaneando...</span>";

    try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nombreCiudad)}&format=json&limit=1`);
        const geoData = await geoRes.json();
        
        if (!geoData || geoData.length === 0) {
            container.innerHTML = `<span style='color: #ff4d4d;'>📍 No ubico "${nombreCiudad}"</span>`;
            return;
        }

        const latCity = parseFloat(geoData[0].lat);
        const lonCity = parseFloat(geoData[0].lon);

        const query = `[out:json][timeout:25];
            (node["aeroway"="aerodrome"]["iata"](around:150000,${latCity},${lonCity});
             way["aeroway"="aerodrome"]["iata"](around:150000,${latCity},${lonCity}););
            out center;`;
        
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        // Mapeamos los datos incluyendo el cálculo de distancia
        const airports = data.elements
            .filter(el => el.tags && el.tags.iata)
            .map(el => {
                const latAir = el.lat || el.center.lat;
                const lonAir = el.lon || el.center.lon;
                const dist = calcularDistancia(latCity, lonCity, latAir, lonAir);
                return { 
                    iata: el.tags.iata, 
                    name: el.tags.name || "Airport",
                    distancia: dist 
                };
            });

        container.innerHTML = "";
        if (airports.length === 0) {
            container.innerHTML = "<span style='color: #888;'>Sin aeropuertos cerca</span>";
            return;
        }

        // Ordenar por cercanía y quitar duplicados
        const unique = [...new Map(airports.map(item => [item.iata, item])).values()]
                       .sort((a, b) => a.distancia - b.distancia);

        unique.forEach(air => {
            const btn = document.createElement('button');
            btn.type = "button";
            btn.className = "airport-pill big-pill"; // Clase nueva
            
            btn.innerHTML = `
                <div class="pill-left">
                    <b>${air.iata}</b>
                </div>
                <div class="pill-right">
                    <span class="air-name">${air.name}</span>
                    <span class="air-dist"><i class="fas fa-location-arrow"></i> a ${air.distancia.toFixed(1)} km</span>
                </div>
            `;
            
            btn.onclick = () => {
                document.getElementById(inputId).value = air.iata;
                container.querySelectorAll('.airport-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            container.appendChild(btn);
        });

    } catch (e) {
        container.innerHTML = "<span style='color: #ff4d4d;'>⚠️ Error</span>";
    }
}

// 📏 Función matemática para calcular KM entre dos puntos (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Envío a Skyscanner
document.getElementById('flight-form').addEventListener('submit', e => {
    e.preventDefault();
    const o = document.getElementById('origin-input').value;
    const d = document.getElementById('destination-input').value;
    const i = document.getElementById('date-outbound').value.replace(/-/g, '').slice(2);
    const v = document.getElementById('date-return').value.replace(/-/g, '').slice(2);
    window.open(`https://www.skyscanner.es/transporte/vuelos/${o}/${d}/${i}/${v}/`, '_blank');
});

function renderAirports(airports, containerId, inputId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if(airports.length === 0) {
        container.innerHTML = "<small>No hay aeropuertos comerciales cerca.</small>";
        return;
    }

    airports.forEach((air) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "airport-pill";
        const nombreCorto = air.tags.name.split(' ')[0];
        btn.innerHTML = `<b>${air.tags.iata}</b> <small>${nombreCorto}</small>`;
        
        btn.onclick = () => {
            // Solo se rellena el input cuando el usuario hace clic físicamente
            document.getElementById(inputId).value = air.tags.iata;
            
            // Cambiar estado visual
            container.querySelectorAll('.airport-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };

        container.appendChild(btn);
    });
}