// 1. REFERENCIAS HTML
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

// FUNCIÓN PARA EXTRAER EL CÓDIGO DEL PAÍS (Ej: "Madrid (ESP)" -> "ESP")
function getOnlyCountryCode(venue) {
    if (!venue) return "INT";
    const match = venue.match(/\(([^)]+)\)$/); 
    return match ? match[1].toUpperCase() : "INT";
}

// 2. INICIALIZAR CALENDARIO (FLATPICKR)
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

// 3. CARGA DE DATOS DESDE EL JSON DE GITHUB
async function loadData() {
    try {
        // Añadimos un timestamp para evitar que el navegador guarde una versión vieja (caché)
        const response = await fetch(`eventos_2026.json?t=${new Date().getTime()}`);
        const data = await response.json();
        
        allEvents = data.map(ev => ({
            ...ev,
            parsedDate: new Date(ev.startDate)
        }));

        allEvents.sort((a, b) => a.parsedDate - b.parsedDate);

        updateFilterOptions(allEvents);
        applyFilters();
    } catch (error) {
        console.error("Error cargando JSON:", error);
        eventCountText.innerText = "Error cargando eventos...";
    }
}

// 4. ACTUALIZAR OPCIONES DE LOS SELECTORES
function updateFilterOptions(events) {
    // Solo mostramos opciones basadas en eventos de 2026 (sin Cat E/F)
    const validEvents = events.filter(e => e.parsedDate.getFullYear() === 2026);

    // Países
    const countryCodes = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countrySelect.innerHTML = '<option value="all">Países</option>';
    countryCodes.forEach(code => {
        countrySelect.innerHTML += `<option value="${code}">${code}</option>`;
    });

    // Niveles (Categorías A, B, C, D...)
    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelSelect.innerHTML = '<option value="all">Niveles</option>';
    levels.forEach(l => levelSelect.innerHTML += `<option value="${l}">${l}</option>`);
}

// 5. FILTRADO MAESTRO
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;

    const filtered = allEvents.filter(ev => {
        const eventDate = ev.parsedDate;
        const m = (eventDate.getMonth() + 1).toString().padStart(2, '0');
        
        const matchesSearch = ev.name.toLowerCase().includes(search) || 
                             ev.venue.toLowerCase().includes(search);
        
        const matchesMonth = month === 'all' || m === month;
        
        const eventCode = getOnlyCountryCode(ev.venue);
        const matchesCountry = selectedCode === 'all' || eventCode === selectedCode;
        
        const matchesLevel = level === 'all' || ev.category === level;
        
        // Lógica de Género: Buscamos en el array de disciplinas
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = ev.disciplines.some(d => d.gender === target || d.gender === 'Both');
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(eventDate).setHours(0,0,0,0);
            const start = new Date(dateStart).setHours(0,0,0,0);
            const end = new Date(dateEnd).setHours(0,0,0,0);
            matchesDateRange = evTime >= start && evTime <= end;
        }

        return matchesSearch && matchesMonth && matchesCountry && matchesLevel && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}

// 6. RENDERIZAR TARJETAS EN EL GRID
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.parsedDate.toLocaleDateString('es-ES', { 
            day: '2-digit', month: 'short', year: '2-digit' 
        });

        // Estilos por nivel (Colores de siempre)
        let levelName = ev.category;
        let levelClass = "";
        switch(ev.category) {
            case 'A': levelName = "GOLD"; levelClass = "level-gold"; break;
            case 'B': levelName = "SILVER"; levelClass = "level-silver"; break;
            case 'C': levelName = "BRONZE"; levelClass = "level-bronze"; break;
            case 'D': levelName = "CHALLENGER"; levelClass = "level-challenger"; break;
            case 'GW': levelName = "G-WALK"; levelClass = "level-gold"; break;
            default: levelName = ev.category; levelClass = "level-silver";
        }

        // Etiquetas de género (simplificado para la tarjeta)
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

// 7. MODAL DETALLADO (CONTACTOS ARREGLADOS)
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-area').innerText = ev.area;
    document.getElementById('modal-cat').innerText = ev.category;
    document.getElementById('modal-date-tag').innerText = ev.parsedDate.toLocaleDateString('es-ES', { dateStyle: 'long' });

    // Disciplinas (Muestra todas las pruebas del mitin)
    const discs = ev.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');
    document.getElementById('modal-vault').innerText = discs;

    // Enlaces
    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.links.web) {
        linksCont.innerHTML += `<a href="${ev.links.web}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web Oficial</a>`;
    }
    if (ev.links.results) {
        linksCont.innerHTML += `<a href="${ev.links.results}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;
    }

    // CONTACTOS (Ahora se muestran los del Scraper)
    const contactCont = document.getElementById('modal-contacts');
    if (ev.contact && ev.contact.length > 0) {
        contactCont.innerHTML = ev.contact.map(c => `
            <div class="contact-box" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                <p style="margin:0; font-weight:bold; color:#fff;"><i class="fas fa-user-tie"></i> ${c.name || 'Organizador'}</p>
                ${c.email ? `<p style="margin:0;"><i class="fas fa-envelope"></i> <a href="mailto:${c.email}" style="color:#00d1b2;">${c.email}</a></p>` : ''}
                ${c.phoneNumber ? `<p style="margin:0;"><i class="fas fa-phone"></i> ${c.phoneNumber}</p>` : ''}
            </div>
        `).join('');
    } else {
        contactCont.innerHTML = '<p style="color:#888; font-style:italic;"><i class="fas fa-info-circle"></i> No hay datos de contacto directo. Consulta la web oficial.</p>';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

// CERRAR MODAL
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
        currentGender = btn.dataset.gender; 
        applyFilters();
    });
});

// Botón limpiar fechas
if(clearDateBtn) {
    clearDateBtn.onclick = () => {
        fp.clear();
        dateStart = null;
        dateEnd = null;
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

// INICIO
loadData();