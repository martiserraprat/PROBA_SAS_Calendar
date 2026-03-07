// CONFIGURACIÓN DE UI
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
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

// 1. REINSTALAR CALENDARIO FLATPICKR
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

// 2. CARGA DE DATOS DESDE GITHUB JSON
async function loadEvents() {
    try {
        const response = await fetch('eventos_2026.json');
        const data = await response.json();
        
        allEvents = data.map(ev => ({
            ...ev,
            startDate: new Date(ev.startDate),
        }));

        allEvents.sort((a, b) => a.startDate - b.startDate);
        
        updateFilterOptions(allEvents);
        applyFilters();
    } catch (error) {
        console.error("Error cargando el calendario:", error);
        eventCountText.innerText = "Error 404. Vuelva mas tarde";
    }
}

// 3. ACTUALIZAR SELECTORES
function updateFilterOptions(events) {
    const countries = [...new Set(events.map(e => {
        const match = e.venue.match(/\(([^)]+)\)$/);
        return match ? match[1] : "INT";
    }))].sort();
    countrySelect.innerHTML = '<option value="all">🌍 Países</option>' + 
        countries.map(c => `<option value="${c}">${c}</option>`).join('');

    const disciplines = new Set();
    events.forEach(e => e.disciplines.forEach(d => disciplines.add(d.name)));
    const sortedDiscs = [...disciplines].sort();
    disciplineSelect.innerHTML = '<option value="all">🏃 Todas las Pruebas</option>' + 
        sortedDiscs.map(d => `<option value="${d}">${d}</option>`).join('');

    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const activeMonths = [...new Set(events.map(e => e.startDate.getMonth()))].sort((a,b)=>a-b);
    monthSelect.innerHTML = '<option value="all">📅 Meses</option>' + 
        activeMonths.map(m => `<option value="${(m+1).toString().padStart(2,'0')}">${months[m]}</option>`).join('');
}

// 4. FILTRADO MAESTRO (CON CALENDARIO CORREGIDO)
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const disc = disciplineSelect.value;
    const month = monthSelect.value;
    const country = countrySelect.value;
    const level = levelSelect.value;

    const filtered = allEvents.filter(ev => {
        const m = (ev.startDate.getMonth() + 1).toString().padStart(2, '0');
        const venueCountry = ev.venue.match(/\(([^)]+)\)$/)?.[1] || "INT";

        const matchesSearch = ev.name.toLowerCase().includes(search) || ev.venue.toLowerCase().includes(search);
        const matchesMonth = month === 'all' || m === month;
        const matchesCountry = country === 'all' || venueCountry === country;
        const matchesLevel = level === 'all' || ev.category === level;

        // Filtro de Disciplina + Género
        const matchesDiscAndGender = ev.disciplines.some(d => {
            const discMatch = disc === 'all' || d.name === disc;
            const genderMatch = currentGender === 'all' || d.gender === currentGender || d.gender === 'Both';
            return discMatch && genderMatch;
        });

        // Filtro de Rango de Fechas
        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = ev.startDate.setHours(0,0,0,0);
            const start = dateStart.setHours(0,0,0,0);
            const end = dateEnd.setHours(0,0,0,0);
            matchesDateRange = evTime >= start && evTime <= end;
        }

        return matchesSearch && matchesMonth && matchesCountry && matchesLevel && matchesDiscAndGender && matchesDateRange;
    });

    renderEvents(filtered);
}

// 5. DIBUJAR TARJETAS
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones en 2026`;

    events.forEach(ev => {
        const dateStr = ev.startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <span class="card-date"><i class="far fa-calendar"></i> ${dateStr}</span>
            <h3>${ev.name}</h3>
            <div class="location-info"><i class="fas fa-map-marker-alt"></i> ${ev.venue}</div>
            <div class="card-tags">
                <span class="tag cat-${ev.category}">${ev.category}</span>
                <span class="tag-count">${ev.disciplines.length} Pruebas</span>
            </div>
        `;
        card.onclick = () => openModal(ev);
        eventGrid.appendChild(card);
    });
}

// 6. MODAL
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-area').innerText = ev.area;
    document.getElementById('modal-cat').innerText = ev.category;
    document.getElementById('modal-date-tag').innerText = ev.startDate.toLocaleDateString('es-ES', { dateStyle: 'full' });

    const discCont = document.getElementById('modal-disciplines');
    discCont.innerHTML = ev.disciplines.map(d => `
        <span class="tag ${d.gender === 'Men' ? 'tag-m' : 'tag-f'}">${d.name} (${d.gender === 'Men' ? 'M' : 'F'})</span>
    `).join('');

    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.links.web) linksCont.innerHTML += `<a href="${ev.links.web}" target="_blank" class="link-btn">🌐 Web</a>`;
    if (ev.links.results) linksCont.innerHTML += `<a href="${ev.links.results}" target="_blank" class="link-btn">📊 Resultados</a>`;

    const contactCont = document.getElementById('modal-contacts');
    contactCont.innerHTML = ev.contact.length > 0 
        ? ev.contact.map(c => `<div class="contact-box"><strong>${c.name}</strong><br>${c.email}</div>`).join('')
        : 'Sin contacto.';

    modal.style.display = 'flex';
}

// LISTENERS
searchInput.addEventListener('input', applyFilters);
disciplineSelect.addEventListener('change', applyFilters);
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

if(clearDateBtn) {
    clearDateBtn.onclick = () => {
        fp.clear();
        dateStart = null;
        dateEnd = null;
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
};

// INICIO
loadEvents();