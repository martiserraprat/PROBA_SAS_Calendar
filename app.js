// 1. REFERENCIAS HTML (Tus referencias de siempre)
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
const countrySelect = document.getElementById('filter-country');
const levelSelect = document.getElementById('filter-level');
const eventCountText = document.getElementById('event-count');
const genderButtons = document.querySelectorAll('.g-btn');
const clearDateBtn = document.getElementById('clear-date');

let allEvents = [];
let currentGender = 'all';
let dateStart = null;
let dateEnd = null;
let fp = null; 

// FUNCIÓN PARA EL FILTRO (Extrae el código del país)
function getOnlyCountryCode(venue) {
    if (!venue) return "INT";
    const match = venue.match(/\(([^)]+)\)$/); 
    return match ? match[1].toUpperCase() : "INT";
}

// 2. INICIALIZAR CALENDARIO FLATPICKR
if (window.flatpickr) {
    fp = window.flatpickr("#date-range", {
        mode: "range",
        dateFormat: "d/m/y",
        theme: "dark",
        locale: { firstDayOfWeek: 1 },
        disableMobile: "true",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                dateStart = selectedDates[0];
                dateEnd = selectedDates[1];
                if(clearDateBtn) clearDateBtn.style.display = "inline-block";
            } else {
                dateStart = null;
                dateEnd = null;
            }
            applyFilters();
        }
    });
}

// 3. CARGA DESDE JSON (Sustituye a Firebase)
async function loadData() {
    try {
        const response = await fetch('eventos_2026.json');
        const data = await response.json();
        
        // Convertimos las fechas de texto a objetos Date de JS para que funcionen tus filtros
        allEvents = data.map(ev => ({
            ...ev,
            // Si el scraper guardó startDate, lo convertimos
            parsedDate: new Date(ev.startDate)
        }));

        // Ordenar por fecha
        allEvents.sort((a, b) => a.parsedDate - b.parsedDate);

        updateFilterOptions(allEvents);
        applyFilters();
    } catch (error) {
        console.error("Error cargando JSON:", error);
        eventCountText.innerText = "Error cargando eventos...";
    }
}

// 4. ACTUALIZAR OPCIONES DE FILTRO (Tu lógica original)
function updateFilterOptions(events) {
    const validEvents = events.filter(e => {
        const year = e.parsedDate.getFullYear();
        return e.category !== 'F' && e.category !== 'E' && year === 2026;
    });

    // Países
    const countryCodes = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countrySelect.innerHTML = '<option value="all">Países</option>';
    countryCodes.forEach(code => {
        countrySelect.innerHTML += `<option value="${code}">${code}</option>`;
    });

    // Niveles
    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelSelect.innerHTML = '<option value="all">Niveles</option>';
    levels.forEach(l => levelSelect.innerHTML += `<option value="${l}">${l}</option>`);

    // Meses
    const monthNames = {
        "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
        "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
        "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    };
    const availableMonths = [...new Set(validEvents.map(e => {
        return (e.parsedDate.getMonth() + 1).toString().padStart(2, '0');
    }))].sort();

    monthSelect.innerHTML = '<option value="all">Meses</option>';
    availableMonths.forEach(m => {
        monthSelect.innerHTML += `<option value="${m}">${monthNames[m]}</option>`;
    });
}

// 5. FILTRADO MAESTRO (Tu lógica exacta de Firebase adaptada)
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;

    const filtered = allEvents.filter(ev => {
        const eventDate = ev.parsedDate;
        const year = eventDate.getFullYear();
        const m = (eventDate.getMonth() + 1).toString().padStart(2, '0');
        
        const is2026 = year === 2026;
        const isNotLowLevel = ev.category !== 'F' && ev.category !== 'E';

        const matchesSearch = ev.name.toLowerCase().includes(search) || 
                             ev.venue.toLowerCase().includes(search);
        
        const matchesMonth = month === 'all' || m === month;
        
        const eventCode = getOnlyCountryCode(ev.venue);
        const matchesCountry = selectedCode === 'all' || eventCode === selectedCode;
        
        const matchesLevel = level === 'all' || ev.category === level;
        
        // Adaptación Género: El nuevo scraper guarda disciplinas en un array
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = ev.disciplines.some(d => 
                d.name.includes("Vault") && (d.gender === target || d.gender === 'Both')
            );
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(eventDate).setHours(0,0,0,0);
            const start = new Date(dateStart).setHours(0,0,0,0);
            const end = new Date(dateEnd).setHours(0,0,0,0);
            matchesDateRange = evTime >= start && evTime <= end;
        }

        return is2026 && isNotLowLevel && matchesSearch && matchesMonth && matchesCountry && matchesLevel && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}

// 6. RENDERIZAR TARJETAS (Tu diseño de GOLD, SILVER, etc.)
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.parsedDate.toLocaleDateString('es-ES', { 
            day: '2-digit', month: 'short', year: '2-digit' 
        });

        // Niveles
        let levelName = ev.category;
        let levelClass = "";
        switch(ev.category) {
            case 'A': levelName = "GOLD"; levelClass = "level-gold"; break;
            case 'B': levelName = "SILVER"; levelClass = "level-silver"; break;
            case 'C': levelName = "BRONZE"; levelClass = "level-bronze"; break;
            case 'D': levelName = "CHALLENGER"; levelClass = "level-challenger"; break;
            default: levelName = ev.category; levelClass = "level-silver";
        }

        // Género (Simplificado para las etiquetas de la tarjeta)
        const hasMen = ev.disciplines.some(d => d.gender === 'Men' || d.gender === 'Both');
        const hasWomen = ev.disciplines.some(d => d.gender === 'Women' || d.gender === 'Both');
        
        let genderLabel = "M / F";
        let genderClass = "tag-both";
        if (hasMen && !hasWomen) { genderLabel = "MASCULINO"; genderClass = "tag-m"; }
        if (!hasMen && hasWomen) { genderLabel = "FEMENINO"; genderClass = "tag-f"; }

        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <span class="card-date"><i class="far fa-calendar-check"></i> ${dateStr}</span>
            <h3>${ev.name}</h3>
            <div class="location-info">
                <i class="fas fa-map-marker-alt"></i> ${ev.venue}
            </div>
            <div class="card-tags">
                <span class="tag ${genderClass}">${genderLabel}</span>
                <span class="tag ${levelClass}">${levelName}</span>
            </div>
        `;
        card.onclick = () => openModal(ev);
        eventGrid.appendChild(card);
    });
}

// 7. MODAL (Adaptado a la estructura del Scraper)
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-area').innerText = ev.area;
    document.getElementById('modal-cat').innerText = ev.category;
    
    // Mostramos las disciplinas en el modal-vault
    const discs = ev.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');
    document.getElementById('modal-vault').innerText = discs;
    
    document.getElementById('modal-date-tag').innerText = ev.parsedDate.toLocaleDateString('es-ES', { dateStyle: 'long' });

    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    // El scraper de ahora pone el link de WA directamente aquí
    if (ev.links.web) linksCont.innerHTML += `<a href="${ev.links.web}" target="_blank" class="link-btn">Info Oficial</a>`;

    const contactCont = document.getElementById('modal-contacts');
    contactCont.innerHTML = '<p>Revisar web oficial para contacto.</p>';

    modal.style.display = 'flex';
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

// 8. LISTENERS
searchInput.addEventListener('input', applyFilters);
monthSelect.addEventListener('change', applyFilters);
countrySelect.addEventListener('change', applyFilters);
levelSelect.addEventListener('change', applyFilters);

genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        genderButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGender = btn.dataset.gender; // Usa 🚹 o 🚺
        applyFilters();
    });
});

// Arrancar carga
loadData();