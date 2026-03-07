// 1. REFERENCIAS HTML
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
const continentSelect = document.getElementById('filter-continent');
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

// AÑADIDO: Mapeo de categorías correcto (Incluyendo Diamond League y Mundiales)
const levelMap = { 
    'OW': 'OLYMPIC/WORLD',
    'DF': 'DL FINAL', 
    'GW': 'DIAMOND', 
    'GL': 'CHAMPIONSHIP', 
    'A': 'GOLD', 
    'B': 'SILVER', 
    'C': 'BRONZE', 
    'D': 'CHALLENGER'
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

// 3. CARGA DE DATOS
async function loadData() {
    try {
        const response = await fetch(`eventos_2026.json?t=${new Date().getTime()}`);
        const data = await response.json();
        
        const regexSub = /\b(U14|U16|U18|U20|U23|Junior|Youth|Boys|Girls)\b/gi;

        allEvents = data
            .filter(ev => !regexSub.test(ev.name))
            .map(ev => {
                let cleanDisciplines = [];
                // Nos aseguramos de que disciplines exista
                if (ev.disciplines && ev.disciplines.length > 0) {
                    const uniqueD = new Set();
                    ev.disciplines.forEach(d => {
                        let cleanName = d.name.replace(regexSub, '').trim();
                        let key = cleanName + '|' + d.gender;
                        if(!uniqueD.has(key)) {
                            uniqueD.add(key);
                            cleanDisciplines.push({ name: cleanName, gender: d.gender });
                        }
                    });
                }
                
                return {
                    ...ev,
                    disciplines: cleanDisciplines, // Quedará vacío [] si el JSON no traía nada
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

    const continents = [...new Set(validEvents.map(e => e.area).filter(Boolean))].sort();
    continentSelect.innerHTML = '<option value="all">Continentes</option>';
    continents.forEach(c => continentSelect.innerHTML += `<option value="${c}">${c}</option>`);

    const countryCodes = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countrySelect.innerHTML = '<option value="all">Países</option>';
    countryCodes.forEach(code => countrySelect.innerHTML += `<option value="${code}">${code}</option>`);

    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelSelect.innerHTML = '<option value="all">Niveles</option>';
    levels.forEach(l => {
        const displayName = levelMap[l] || l;
        levelSelect.innerHTML += `<option value="${l}">${displayName}</option>`;
    });

    let allDiscs = [];
    validEvents.forEach(ev => {
        if(ev.disciplines) ev.disciplines.forEach(d => allDiscs.push(d.name));
    });
    const uniqueDiscs = [...new Set(allDiscs)].sort();
    disciplineSelect.innerHTML = '<option value="all">Todas las pruebas</option>';
    uniqueDiscs.forEach(d => disciplineSelect.innerHTML += `<option value="${d}">${d}</option>`);
}

// 5. FILTRADO MAESTRO (Permite pasar a los que NO tienen info confirmada)
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const continent = continentSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;
    const disc = disciplineSelect.value; 

    const filtered = allEvents.filter(ev => {
        const eventDate = ev.parsedDate;
        const m = (eventDate.getMonth() + 1).toString().padStart(2, '0');
        
        const matchesSearch = ev.name.toLowerCase().includes(search) || ev.venue.toLowerCase().includes(search);
        const matchesMonth = month === 'all' || m === month;
        const matchesContinent = continent === 'all' || ev.area === continent;
        const matchesCountry = selectedCode === 'all' || getOnlyCountryCode(ev.venue) === selectedCode;
        const matchesLevel = level === 'all' || ev.category === level;
        
        // Magia aquí: Si ev.disciplines está VACÍO (0), se da por VÁLIDO el filtro para que no desaparezca
        const hasNoDiscs = !ev.disciplines || ev.disciplines.length === 0;
        
        const matchesDisc = disc === 'all' || hasNoDiscs || ev.disciplines.some(d => d.name === disc);
        
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = hasNoDiscs || ev.disciplines.some(d => (disc === 'all' || d.name === disc) && (d.gender === target || d.gender === 'Both'));
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(eventDate).setHours(0,0,0,0);
            const start = new Date(dateStart).setHours(0,0,0,0);
            const end = new Date(dateEnd).setHours(0,0,0,0);
            matchesDateRange = evTime >= start && evTime <= end;
        }

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
            case 'OW': levelClass = "level-diamond"; break;
            case 'DF': levelClass = "level-diamond"; break;
            case 'GW': levelClass = "level-diamond"; break;
            case 'GL': levelClass = "level-gold"; break;
            case 'A': levelClass = "level-gold"; break;
            case 'B': levelClass = "level-silver"; break;
            case 'C': levelClass = "level-bronze"; break;
            case 'D': levelClass = "level-challenger"; break;
            default: levelClass = "level-silver";
        }

        // Determinar qué etiqueta poner si NO hay disciplinas
        let genderLabel = "M / F";
        let genderClass = "tag-both";
        
        if (ev.disciplines && ev.disciplines.length > 0) {
            const hasMen = ev.disciplines.some(d => d.gender === 'Men' || d.gender === 'Both');
            const hasWomen = ev.disciplines.some(d => d.gender === 'Women' || d.gender === 'Both');
            genderLabel = (hasMen && hasWomen) ? "M / F" : (hasMen ? "MASCULINO" : "FEMENINO");
            genderClass = (hasMen && hasWomen) ? "tag-both" : (hasMen ? "tag-m" : "tag-f");
        } else {
            // Etiqueta si no hay info
            genderLabel = "TBD / INFO";
            genderClass = "level-silver"; // Usamos el fondo gris neutro
        }

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

// 7. MODAL CON AVISO DE "POR CONFIRMAR"
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-date-tag').innerText = ev.parsedDate.toLocaleDateString('es-ES', { dateStyle: 'long' });
    document.getElementById('modal-area').innerText = ev.area || "-";
    document.getElementById('modal-cat').innerText = levelMap[ev.category] || ev.category || "-";
    
    // AQUÍ ESTÁ EL AVISO
    const vaultContainer = document.getElementById('modal-vault');
    if (ev.disciplines && ev.disciplines.length > 0) {
        vaultContainer.innerHTML = ev.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');
    } else {
        vaultContainer.innerHTML = '<span style="color: #ffcc00; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Pruebas por confirmar. Buscar en la web oficial.</span>';
    }

    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.links && ev.links.web) linksCont.innerHTML += `<a href="${ev.links.web}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web Oficial</a>`;
    if (ev.links && ev.links.results) linksCont.innerHTML += `<a href="${ev.links.results}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;

    const contactCont = document.getElementById('modal-contacts');
    if (ev.contact && ev.contact.length > 0) {
        contactCont.innerHTML = ev.contact.map(c => `
            <div class="contact-box" style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; margin-bottom:12px; border-left:4px solid rgb(0, 112, 243);">
                <p style="margin:0 0 5px 0; font-size:0.75rem; text-transform:uppercase; color:#0070f3; font-weight:bold;">${c.title || 'ORGANIZER'}</p>
                <p style="margin:0; font-weight:bold; color:#fff;"><i class="fas fa-user-circle"></i> ${c.name || 'N/A'}</p>
                ${c.email ? `<p style="margin:5px 0 0 0; font-size:0.9rem;"><i class="fas fa-envelope"></i> <a href="mailto:${c.email}" style="color:#fff; opacity:0.8; text-decoration:none;">${c.email}</a></p>` : ''}
                ${c.phoneNumber ? `<p style="margin:5px 0 0 0; font-size:0.9rem; color:#aaa;"><i class="fas fa-phone"></i> ${c.phoneNumber}</p>` : ''}
            </div>
        `).join('');
    } else {
        contactCont.innerHTML = '<p style="color:#777; font-style:italic;"><i class="fas fa-clock"></i> Contacto no publicado aún. Revisa la web oficial.</p>';
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
continentSelect.addEventListener('change', applyFilters);
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

// Activa el scroll lateral con la rueda del ratón en PC (Si lo dejaste puesto)
const scrollContainer = document.querySelector('.filter-wrapper');
if (scrollContainer) {
    scrollContainer.addEventListener('wheel', (evt) => {
        evt.preventDefault();
        scrollContainer.scrollLeft += evt.deltaY;
    });
}

loadData();