import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDIuhQ-RFhe0aNRUqT1GyRFJijapGvigK4",
    authDomain: "calendario-be5f3.firebaseapp.com",
    projectId: "calendario-be5f3",
    storageBucket: "calendario-be5f3.firebasestorage.app",
    messagingSenderId: "1036945948634",
    appId: "1:1036945948634:web:9fa3cd02b4f52946590ae3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. REFERENCIAS HTML
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

// FUNCIÓN PARA EL FILTRO (EXTRAE CÓDIGO)
function getOnlyCountryCode(venue) {
    const match = venue.match(/\(([^)]+)\)$/); 
    return match ? match[1].toUpperCase() : "INT";
}

// 3. INICIALIZAR CALENDARIO (LUNES)
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

// 4. ESCUCHAR FIREBASE
onSnapshot(collection(db, "eventos_pertiga"), (snapshot) => {
    allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allEvents.sort((a, b) => a.startDate.seconds - b.startDate.seconds);
    updateFilterOptions(allEvents);
    applyFilters();
});

function updateFilterOptions(events) {
    // Filtramos primero los eventos válidos para 2026 y niveles permitidos
    const validEvents = events.filter(e => {
        const year = e.startDate.toDate().getFullYear();
        return e.rankingCategory !== 'F' && e.rankingCategory !== 'E' && year === 2026;
    });

    // --- LÓGICA DE PAÍSES ---
    const countryCodes = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    const currentC = countrySelect.value;
    countrySelect.innerHTML = '<option value="all">Países</option>';
    countryCodes.forEach(code => {
        countrySelect.innerHTML += `<option value="${code}">${code}</option>`;
    });
    countrySelect.value = countryCodes.includes(currentC) ? currentC : 'all';

    // --- LÓGICA DE NIVELES ---
    const levels = [...new Set(validEvents.map(e => e.rankingCategory))].filter(Boolean).sort();
    const currentL = levelSelect.value;
    levelSelect.innerHTML = '<option value="all">Niveles</option>';
    levels.forEach(l => levelSelect.innerHTML += `<option value="${l}">${l}</option>`);
    levelSelect.value = levels.includes(currentL) ? currentL : 'all';

    // --- LÓGICA DE MESES (DINÁMICA) ---
    const monthNames = {
        "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
        "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
        "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    };

    // Extraemos los números de mes (01, 02...) presentes en los eventos
    const availableMonths = [...new Set(validEvents.map(e => {
        return (e.startDate.toDate().getMonth() + 1).toString().padStart(2, '0');
    }))].sort();

    const currentM = monthSelect.value;
    monthSelect.innerHTML = '<option value="all">Meses</option>';
    availableMonths.forEach(m => {
        monthSelect.innerHTML += `<option value="${m}">${monthNames[m]}</option>`;
    });
    monthSelect.value = availableMonths.includes(currentM) ? currentM : 'all';
}

// 6. FILTRADO MAESTRO
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;

    const filtered = allEvents.filter(ev => {
        const eventDate = ev.startDate.toDate();
        const year = eventDate.getFullYear();
        const m = (eventDate.getMonth() + 1).toString().padStart(2, '0');
        
        const is2026 = year === 2026;
        const isNotLowLevel = ev.rankingCategory !== 'F' && ev.rankingCategory !== 'E';

        const matchesSearch = ev.name.toLowerCase().includes(search) || 
                              ev.venue.toLowerCase().includes(search);
        
        const matchesMonth = month === 'all' || m === month;
        
        const eventCode = getOnlyCountryCode(ev.venue);
        const matchesCountry = selectedCode === 'all' || eventCode === selectedCode;
        
        const matchesLevel = level === 'all' || ev.rankingCategory === level;
        
        let matchesGender = true;
        if (currentGender !== 'all') {
            matchesGender = ev.poleVault === 'Both' || ev.poleVault.includes(currentGender === '🚹' ? 'Men' : 'Women');
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

// 7. DIBUJAR TARJETAS (AQUÍ SE MUESTRA EL TEXTO COMPLETO)
// ... (resto del código igual hasta llegar a renderEvents)

function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.startDate.toDate().toLocaleDateString('es-ES', { 
            day: '2-digit', month: 'short', year: '2-digit' 
        });

        // 1. Lógica de Nombres y Colores para Niveles
        let levelName = ev.rankingCategory;
        let levelClass = "";
        
        switch(ev.rankingCategory) {
            case 'A': levelName = "GOLD"; levelClass = "level-gold"; break;
            case 'B': levelName = "SILVER"; levelClass = "level-silver"; break;
            case 'C': levelName = "BRONZE"; levelClass = "level-bronze"; break;
            case 'D': levelName = "CHALLENGER"; levelClass = "level-challenger"; break;
            default: levelName = ev.rankingCategory; levelClass = "level-silver";
        }

        // 2. Lógica de Colores para Género
        let genderLabel = "";
        let genderClass = "";
        
        if (ev.poleVault === 'Both') {
            genderLabel = "M / F";
            genderClass = "tag-both";
        } else if (ev.poleVault.includes('Men')) {
            genderLabel = "MASCULINO";
            genderClass = "tag-m";
        } else {
            genderLabel = "FEMENINO";
            genderClass = "tag-f";
        }

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

// 8. MODAL
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    const date = ev.startDate.toDate();
    
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-area').innerText = ev.area;
    document.getElementById('modal-cat').innerText = ev.rankingCategory;
    document.getElementById('modal-vault').innerText = ev.poleVault;
    document.getElementById('modal-date-tag').innerText = date.toLocaleDateString('es-ES', { dateStyle: 'long' });

    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.extraInfo.websiteUrl) linksCont.innerHTML += `<a href="${ev.extraInfo.websiteUrl}" target="_blank" class="link-btn">Web</a>`;
    if (ev.extraInfo.resultsPageUrl) linksCont.innerHTML += `<a href="${ev.extraInfo.resultsPageUrl}" target="_blank" class="link-btn">Resultados</a>`;

    const contactCont = document.getElementById('modal-contacts');
    contactCont.innerHTML = ev.extraInfo.contactPersons.length > 0 
        ? ev.extraInfo.contactPersons.map(p => `<div class="contact-box"><strong>${p.name}</strong><br>${p.email}</div>`).join('')
        : '<p>Sin contacto.</p>';

    modal.style.display = 'flex';
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

// 9. LISTENERS
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