// 1. REFERENCIAS HTML
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
const continentSelect = document.getElementById('filter-continent'); // NUEVO SELECTOR
const countrySelect = document.getElementById('filter-country');
const levelSelect = document.getElementById('filter-level');
const disciplineSelect = document.getElementById('filter-discipline');
const eventCountText = document.getElementById('event-count');
const genderButtons = document.querySelectorAll('.g-btn');
const clearDateBtn = document.getElementById('clear-date');

let allEvents = [];
let currentGender = 'all';
let dateStart = null;
let dateEnd = null;
let fp = null; 

const levelMap = { 
    'A': 'GOLD', 
    'B': 'SILVER', 
    'C': 'BRONZE', 
    'D': 'CHALLENGER', 
    'GW': 'DIAMOND' 
};

function getOnlyCountryCode(venue) {
    if (!venue) return "INT";
    const match = venue.match(/\(([^)]+)\)$/); 
    return match ? match[1].toUpperCase() : "INT";
}

// 2. CALENDARIO
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

// 3. CARGA DE DATOS (AQUÍ LIMPIAMOS LAS PRUEBAS Y EDADES)
async function loadData() {
    try {
        const response = await fetch(`eventos_2026.json?t=${new Date().getTime()}`);
        const data = await response.json();
        
        // Expresión regular para detectar basura de edades
        const regexSub = /\b(U14|U16|U18|U20|U23|Junior|Youth|Boys|Girls)\b/gi;

        allEvents = data
            // 1. Nos cargamos los mítines que sean exclusivos de categorías menores
            .filter(ev => !regexSub.test(ev.name))
            // 2. Limpiamos el nombre de las pruebas (disciplinas) por si cuelan alguna
            .map(ev => {
                let cleanDisciplines = [];
                if (ev.disciplines) {
                    const uniqueD = new Set();
                    ev.disciplines.forEach(d => {
                        // Quitamos el "U20", "Junior", etc. y dejamos solo "Pole Vault"
                        let cleanName = d.name.replace(regexSub, '').trim();
                        let key = cleanName + '|' + d.gender; // Para evitar duplicados en el mismo mitin
                        if(!uniqueD.has(key)) {
                            uniqueD.add(key);
                            cleanDisciplines.push({ name: cleanName, gender: d.gender });
                        }
                    });
                }
                
                return {
                    ...ev,
                    disciplines: cleanDisciplines,
                    parsedDate: new Date(ev.startDate)
                };
            });

        allEvents.sort((a, b) => a.parsedDate - b.parsedDate);

        updateFilterOptions(allEvents);
        applyFilters();
    } catch (error) {
        console.error("Error:", error);
    }
}

// 4. ACTUALIZAR SELECTORES DINÁMICOS
function updateFilterOptions(events) {
    const validEvents = events.filter(e => e.parsedDate.getFullYear() === 2026);

    // Continentes (Áreas)
    const continents = [...new Set(validEvents.map(e => e.area).filter(Boolean))].sort();
    continentSelect.innerHTML = '<option value="all">Continentes</option>';
    continents.forEach(c => continentSelect.innerHTML += `<option value="${c}">${c}</option>`);

    // Países
    const countryCodes = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countrySelect.innerHTML = '<option value="all">Países</option>';
    countryCodes.forEach(code => countrySelect.innerHTML += `<option value="${code}">${code}</option>`);

    // Niveles
    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelSelect.innerHTML = '<option value="all">Niveles</option>';
    levels.forEach(l => {
        const displayName = levelMap[l] || l;
        levelSelect.innerHTML += `<option value="${l}">${displayName}</option>`;
    });

    // Pruebas (Ahora estarán 100% limpias, sin U18 ni cosas raras)
    let allDiscs = [];
    validEvents.forEach(ev => {
        if(ev.disciplines) {
            ev.disciplines.forEach(d => allDiscs.push(d.name));
        }
    });
    const uniqueDiscs = [...new Set(allDiscs)].sort();
    disciplineSelect.innerHTML = '<option value="all">Todas las pruebas</option>';
    uniqueDiscs.forEach(d => disciplineSelect.innerHTML += `<option value="${d}">${d}</option>`);
}

// 5. FILTRADO MAESTRO
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const continent = continentSelect.value; // NUEVO
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;
    const disc = disciplineSelect.value; 

    const filtered = allEvents.filter(ev => {
        const eventDate = ev.parsedDate;
        const m = (eventDate.getMonth() + 1).toString().padStart(2, '0');
        
        const matchesSearch = ev.name.toLowerCase().includes(search) || 
                             ev.venue.toLowerCase().includes(search);
        
        const matchesMonth = month === 'all' || m === month;
        const matchesContinent = continent === 'all' || ev.area === continent; // NUEVO
        const matchesCountry = selectedCode === 'all' || getOnlyCountryCode(ev.venue) === selectedCode;
        const matchesLevel = level === 'all' || ev.category === level;
        const matchesDisc = disc === 'all' || ev.disciplines.some(d => d.name === disc);
        
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = ev.disciplines.some(d => (disc === 'all' || d.name === disc) && (d.gender === target || d.gender === 'Both'));
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(eventDate).setHours(0,0,0,0);
            const start = new Date(dateStart).setHours(0,0,0,0);
            const end = new Date(dateEnd).setHours(0,0,0,0);
            matchesDateRange = evTime >= start && evTime <= end;
        }

        // Aplicamos todos los filtros juntos
        return matchesSearch && matchesMonth && matchesContinent && matchesCountry && matchesLevel && matchesDisc && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}

// 6. RENDERIZAR TARJETAS
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.parsedDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });

        let levelName = levelMap[ev.category] || ev.category;
        let levelClass = "";
        switch(ev.category) {
            case 'A': levelClass = "level-gold"; break;
            case 'B': levelClass = "level-silver"; break;
            case 'C': levelClass = "level-bronze"; break;
            case 'D': levelClass = "level-challenger"; break;
            case 'GW': levelClass = "level-diamond"; break;
            default: levelClass = "level-silver";
        }

        const hasMen = ev.disciplines.some(d => d.gender === 'Men' || d.gender === 'Both');
        const hasWomen = ev.disciplines.some(d => d.gender === 'Women' || d.gender === 'Both');
        let genderLabel = (hasMen && hasWomen) ? "M / F" : (hasMen ? "MASCULINO" : "FEMENINO");
        let genderClass = (hasMen && hasWomen) ? "tag-both" : (hasMen ? "tag-m" : "tag-f");

        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <span class="card-date"><i class="far fa-calendar-check"></i> ${dateStr}</span>
            <h3>${ev.name}</h3>
            <div class="location-info"><i class="fas fa-map-marker-alt"></i> ${ev.venue}</div>
            <div class="card-tags">
                <span class="tag ${genderClass}">${genderLabel}</span>
                <span class="tag ${levelClass}">${levelName}</span>
            </div>
        `;
        card.onclick = () => openModal(ev);
        eventGrid.appendChild(card);
    });
}

// 7. MODAL
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-date-tag').innerText = ev.parsedDate.toLocaleDateString('es-ES', { dateStyle: 'long' });
    document.getElementById('modal-area').innerText = ev.area || "-";
    document.getElementById('modal-cat').innerText = levelMap[ev.category] || ev.category || "-";
    document.getElementById('modal-vault').innerText = ev.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');

    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.links.web) linksCont.innerHTML += `<a href="${ev.links.web}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web</a>`;
    if (ev.links.results) linksCont.innerHTML += `<a href="${ev.links.results}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;

    const contactCont = document.getElementById('modal-contacts');
    if (ev.contact && ev.contact.length > 0) {
        contactCont.innerHTML = ev.contact.map(c => `
            <div class="contact-box" style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; margin-bottom:12px; border-left:4px solid #00d1b2;">
                <p style="margin:0 0 5px 0; font-size:0.75rem; text-transform:uppercase; color:#00d1b2; font-weight:bold;">${c.title || 'ORGANIZER'}</p>
                <p style="margin:0; font-weight:bold; color:#fff;"><i class="fas fa-user-circle"></i> ${c.name || 'N/A'}</p>
                ${c.email ? `<p style="margin:5px 0 0 0; font-size:0.9rem;"><i class="fas fa-envelope"></i> <a href="mailto:${c.email}" style="color:#fff; opacity:0.8; text-decoration:none;">${c.email}</a></p>` : ''}
                ${c.phoneNumber ? `<p style="margin:5px 0 0 0; font-size:0.9rem; color:#aaa;"><i class="fas fa-phone"></i> ${c.phoneNumber}</p>` : ''}
            </div>
        `).join('');
    } else {
        contactCont.innerHTML = '<p style="color:#777; font-style:italic;">Sin datos de contacto.</p>';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

// 8. LISTENERS
searchInput.addEventListener('input', applyFilters);
monthSelect.addEventListener('change', applyFilters);
continentSelect.addEventListener('change', applyFilters); // NUEVO
countrySelect.addEventListener('change', applyFilters);
levelSelect.addEventListener('change', applyFilters);
disciplineSelect.addEventListener('change', applyFilters);

genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        genderButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGender = btn.dataset.gender; 
        applyFilters();
    });
});

if(clearDateBtn) {
    clearDateBtn.onclick = () => {
        fp.clear();
        dateStart = null;
        dateEnd = null;
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

loadData();