// ============================================================
// FILTROS COMBOBOX — Reemplaza la sección de filtros en app.js
// ============================================================

// Sustituye las referencias a los <select> por los nuevos inputs
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');          // Este queda como <select> normal
const clearDateBtn = document.getElementById('clear-date');
const genderButtons = document.querySelectorAll('.g-btn');

// Combobox refs (los nuevos inputs)
const continentInput  = document.getElementById('cb-continent-input');
const continentList   = document.getElementById('cb-continent-list');

const countryInput    = document.getElementById('cb-country-input');
const countryList     = document.getElementById('cb-country-list');

const levelInput      = document.getElementById('cb-level-input');
const levelList       = document.getElementById('cb-level-list');

const disciplineInput = document.getElementById('cb-discipline-input');
const disciplineList  = document.getElementById('cb-discipline-list');

// Valores seleccionados actualmente
const selectedValues = {
    continent: 'all',
    country: 'all',
    level: 'all',
    discipline: 'all',
};

// ---- Helper genérico para crear un combobox ----
function setupCombobox(inputEl, listEl, key, placeholder) {
    if (!inputEl || !listEl) return;

    let allOptions = []; // {value, label}

    // Rellena el dropdown con las opciones, filtradas por lo que escribe el user
    function renderList(query = '') {
        const q = query.toLowerCase().trim();
        const filtered = allOptions.filter(o => o.label.toLowerCase().includes(q));

        listEl.innerHTML = '';
        filtered.forEach(o => {
            const li = document.createElement('li');
            li.textContent = o.label;
            li.dataset.value = o.value;
            if (o.value === selectedValues[key]) li.classList.add('cb-active');
            li.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Evita que el input pierda focus antes del click
                selectOption(o.value, o.label);
            });
            listEl.appendChild(li);
        });

        listEl.style.display = filtered.length ? 'block' : 'none';
    }

    function selectOption(value, label) {
        selectedValues[key] = value;
        inputEl.value = value === 'all' ? '' : label;
        listEl.style.display = 'none';
        inputEl.placeholder = placeholder;
        applyFilters();
    }

    // Al escribir → filtra la lista
    inputEl.addEventListener('input', () => {
        if (inputEl.value === '') {
            selectedValues[key] = 'all';
            applyFilters();
        }
        renderList(inputEl.value);
    });

    // Al hacer focus → muestra la lista
    inputEl.addEventListener('focus', () => renderList(inputEl.value));

    // Al perder focus → oculta la lista (con pequeño delay para que el mousedown funcione)
    inputEl.addEventListener('blur', () => {
        setTimeout(() => { listEl.style.display = 'none'; }, 150);
    });

    // Navegar con teclado (↓ ↑ Enter Escape)
    inputEl.addEventListener('keydown', (e) => {
        const items = [...listEl.querySelectorAll('li')];
        const current = listEl.querySelector('li.cb-hover');
        let idx = items.indexOf(current);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (current) current.classList.remove('cb-hover');
            idx = Math.min(idx + 1, items.length - 1);
            items[idx]?.classList.add('cb-hover');
            items[idx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (current) current.classList.remove('cb-hover');
            idx = Math.max(idx - 1, 0);
            items[idx]?.classList.add('cb-hover');
            items[idx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            if (current) {
                selectOption(current.dataset.value, current.textContent);
            }
        } else if (e.key === 'Escape') {
            listEl.style.display = 'none';
        }
    });

    // Exponer función para actualizar las opciones desde fuera
    inputEl._setOptions = function(options) {
        allOptions = [{ value: 'all', label: placeholder }, ...options];
    };
}

// ---- Inicializar los 4 comboboxes ----
setupCombobox(continentInput,  continentList,  'continent',  'Continentes');
setupCombobox(countryInput,    countryList,    'country',    'Países');
setupCombobox(levelInput,      levelList,      'level',      'Nivel');
setupCombobox(disciplineInput, disciplineList, 'discipline', 'Prueba');

// ---- Actualizar opciones cuando llegan los datos ----
// Llama a esto DENTRO de tu función updateFilterOptions() existente,
// reemplazando las líneas que hacen .innerHTML en los <select>:

function updateFilterOptions(events) {
    const validEvents = events.filter(e => e.parsedDate.getFullYear() === 2026);

    // Continentes
    const continents = [...new Set(validEvents.map(e => e.area).filter(Boolean))].sort();
    continentInput?._setOptions(continents.map(c => ({ value: c, label: c })));

    // Países
    const countries = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countryInput?._setOptions(countries.map(c => ({ value: c, label: c })));

    // Niveles
    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelInput?._setOptions(levels.map(l => ({ value: l, label: levelMap[l] || l })));

    // Disciplinas
    let allDiscs = [];
    validEvents.forEach(ev => ev.disciplines?.forEach(d => allDiscs.push(d.name)));
    const uniqueDiscs = [...new Set(allDiscs)].sort();
    disciplineInput?._setOptions(uniqueDiscs.map(d => ({ value: d, label: d })));

    // Mes sigue siendo un <select> normal, no necesita cambios
}

// ---- applyFilters actualizado ----
// Reemplaza tu función applyFilters() con esta versión que usa selectedValues:

function applyFilters() {
    const search   = (searchInput.value || "").toLowerCase();
    const month    = monthSelect.value;
    const continent = selectedValues.continent;
    const selectedCode = selectedValues.country;
    const level    = selectedValues.level;
    const disc     = selectedValues.discipline;

    const filtered = allEvents.filter(ev => {
        const m = (ev.parsedDate.getMonth() + 1).toString().padStart(2, '0');
        const matchesSearch    = ev.name.toLowerCase().includes(search) || ev.venue.toLowerCase().includes(search);
        const matchesMonth     = month === 'all' || m === month;
        const matchesContinent = continent === 'all' || ev.area === continent;
        const matchesCountry   = selectedCode === 'all' || getOnlyCountryCode(ev.venue) === selectedCode;
        const matchesLevel     = level === 'all' || ev.category === level;
        
        const hasNoDiscs = !ev.disciplines || ev.disciplines.length === 0;
        const matchesDisc = disc === 'all' || hasNoDiscs || ev.disciplines.some(d => d.name === disc);
        
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = hasNoDiscs || ev.disciplines.some(d =>
                (disc === 'all' || d.name === disc) && (d.gender === target || d.gender === 'Both')
            );
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(ev.parsedDate).setHours(0,0,0,0);
            matchesDateRange = evTime >= new Date(dateStart).setHours(0,0,0,0) &&
                               evTime <= new Date(dateEnd).setHours(0,0,0,0);
        }

        return matchesSearch && matchesMonth && matchesContinent && matchesCountry &&
               matchesLevel && matchesDisc && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}
