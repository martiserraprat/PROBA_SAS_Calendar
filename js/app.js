// 1. CONFIGURACIÓN Y REFERENCIAS
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
const eventCountText = document.getElementById('event-count');
const clearDateBtn = document.getElementById('clear-date');

const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let allEvents = [];
let currentGender = 'all';
let dateStart = null;
let dateEnd = null;
let fp = null;
let eventoAbiertoActual = null;

const levelMap = { 'OW': 'OLYMPIC/WORLD', 'DF': 'DL FINAL', 'GW': 'DIAMOND', 'GL': 'CHAMPIONSHIP', 'A': 'GOLD', 'B': 'SILVER', 'C': 'BRONZE', 'D': 'CHALLENGER' };
const regexSub = /\b(U14|U16|U18|U20|U23|Junior|Youth)\b/gi;

function getOnlyCountryCode(venue) {
    if (!venue) return "INT";
    const match = venue.match(/\(([^)]+)\)$/);
    return match ? match[1].toUpperCase() : "INT";
}

// 2. COMBOBOX REFS Y VALORES
const continentInput  = document.getElementById('cb-continent-input');
const continentList   = document.getElementById('cb-continent-list');
const countryInput    = document.getElementById('cb-country-input');
const countryList     = document.getElementById('cb-country-list');
const levelInput      = document.getElementById('cb-level-input');
const levelList       = document.getElementById('cb-level-list');
const disciplineInput = document.getElementById('cb-discipline-input');
const disciplineList  = document.getElementById('cb-discipline-list');

const selectedValues = {
    continent: 'all',
    country: 'all',
    level: 'all',
    discipline: 'all',
};

// 3. SETUP COMBOBOX
function setupCombobox(inputEl, listEl, key, placeholder) {
    if (!inputEl || !listEl) return;
    let allOptions = [];

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
                e.preventDefault();
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

    inputEl.addEventListener('input', () => {
        if (inputEl.value === '') {
            selectedValues[key] = 'all';
            applyFilters();
        }
        renderList(inputEl.value);
    });

    inputEl.addEventListener('focus', () => renderList(inputEl.value));
    inputEl.addEventListener('blur', () => { setTimeout(() => { listEl.style.display = 'none'; }, 150); });

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
            if (current) selectOption(current.dataset.value, current.textContent);
        } else if (e.key === 'Escape') {
            listEl.style.display = 'none';
        }
    });

    inputEl._setOptions = function(options) {
        allOptions = [{ value: 'all', label: placeholder }, ...options];
    };
}

setupCombobox(continentInput, continentList, 'continent', 'Continentes');
setupCombobox(countryInput,   countryList,   'country',   'Países');
setupCombobox(levelInput,     levelList,     'level',     'Nivel');
setupCombobox(disciplineInput,disciplineList,'discipline','Prueba');

// 4. INICIALIZAR FLATPICKR
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
                if (clearDateBtn) clearDateBtn.style.display = "inline-block";
            } else {
                dateStart = null;
                dateEnd = null;
            }
            applyFilters();
        }
    });
}

// 5. CARGA DE DATOS
async function loadData() {
    try {
        const cacheKey = 'events_data_2026';
        const cacheTimeKey = 'events_data_time';
        const cachedData = localStorage.getItem(cacheKey);
        const lastFetch = localStorage.getItem(cacheTimeKey);
        const oneHour = 60 * 60 * 1000;

        if (cachedData && lastFetch && (Date.now() - lastFetch < oneHour)) {
            processAndRender(JSON.parse(cachedData));
            return;
        }

        const { data, error } = await supabase
            .from('eventos')
            .select('id, name, venue, startDate, area, category, disciplines');

        if (error) throw error;

        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, Date.now());
        processAndRender(data);

    } catch (error) {
        console.error("❌ Error:", error);
        eventGrid.innerHTML = `<p style="color: red; padding: 20px;">Error al cargar datos.</p>`;
    }
}

function processAndRender(data) {
    allEvents = data
        .filter(ev => !regexSub.test(ev.name))
        .map(ev => ({ ...ev, parsedDate: new Date(ev.startDate) }));
    allEvents.sort((a, b) => a.parsedDate - b.parsedDate);
    updateFilterOptions(allEvents);
    applyFilters();
}

// 6. ACTUALIZAR OPCIONES FILTROS
function updateFilterOptions(events) {
    const validEvents = events.filter(e => e.parsedDate.getFullYear() === 2026);

    const continents = [...new Set(validEvents.map(e => e.area).filter(Boolean))].sort();
    continentInput?._setOptions(continents.map(c => ({ value: c, label: c })));

    const countries = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countryInput?._setOptions(countries.map(c => ({ value: c, label: c })));

    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelInput?._setOptions(levels.map(l => ({ value: l, label: levelMap[l] || l })));

    let allDiscs = [];
    validEvents.forEach(ev => ev.disciplines?.forEach(d => allDiscs.push(d.name)));
    const uniqueDiscs = [...new Set(allDiscs)].sort();
    disciplineInput?._setOptions(uniqueDiscs.map(d => ({ value: d, label: d })));
}

// 7. APPLY FILTERS — única versión, con género arreglado y sin pasados
function applyFilters() {
    const search       = (searchInput.value || "").toLowerCase();
    const month        = monthSelect.value;
    const continent    = selectedValues.continent;
    const selectedCode = selectedValues.country;
    const level        = selectedValues.level;
    const disc         = selectedValues.discipline;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const filtered = allEvents.filter(ev => {
        // Ocultar pasados
        const evMidnight = new Date(ev.parsedDate);
        evMidnight.setHours(0, 0, 0, 0);
        if (evMidnight < todayMidnight) return false;

        const m = (ev.parsedDate.getMonth() + 1).toString().padStart(2, '0');
        const matchesSearch    = ev.name.toLowerCase().includes(search) || ev.venue.toLowerCase().includes(search);
        const matchesMonth     = month === 'all' || m === month;
        const matchesContinent = continent === 'all' || ev.area === continent;
        const matchesCountry   = selectedCode === 'all' || getOnlyCountryCode(ev.venue) === selectedCode;
        const matchesLevel     = level === 'all' || ev.category === level;

        const hasNoDiscs = !ev.disciplines || ev.disciplines.length === 0;
        const matchesDisc = disc === 'all' || hasNoDiscs || ev.disciplines.some(d => d.name === disc);

        // Género: currentGender es 'all', '🚹' o '🚺'
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            if (!hasNoDiscs) {
                matchesGender = ev.disciplines.some(d =>
                    (disc === 'all' || d.name === disc) &&
                    (d.gender === target || d.gender === 'Both')
                );
            }
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = evMidnight.getTime();
            matchesDateRange =
                evTime >= new Date(dateStart).setHours(0, 0, 0, 0) &&
                evTime <= new Date(dateEnd).setHours(0, 0, 0, 0);
        }

        return matchesSearch && matchesMonth && matchesContinent && matchesCountry &&
               matchesLevel && matchesDisc && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}

// 8. RENDER TARJETAS
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.parsedDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });

        let levelName = levelMap[ev.category] || ev.category;
        let levelClass = "level-silver";
        if (['OW','DF','GW'].includes(ev.category)) levelClass = "level-diamond";
        else if (['GL','A'].includes(ev.category)) levelClass = "level-gold";
        else if (ev.category === 'B') levelClass = "level-silver";
        else if (ev.category === 'C') levelClass = "level-bronze";
        else if (ev.category === 'D') levelClass = "level-challenger";

        let genderLabel = "M / F";
        let genderClass = "tag-both";
        if (ev.disciplines && ev.disciplines.length > 0) {
            const hasMen   = ev.disciplines.some(d => d.gender === 'Men'   || d.gender === 'Both');
            const hasWomen = ev.disciplines.some(d => d.gender === 'Women' || d.gender === 'Both');
            genderLabel = (hasMen && hasWomen) ? "M / F" : (hasMen ? "MASCULINO" : "FEMENINO");
            genderClass = (hasMen && hasWomen) ? "tag-both" : (hasMen ? "tag-m" : "tag-f");
        } else {
            genderLabel = "TBD / INFO";
            genderClass = "level-silver";
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

// 9. MODAL DETALLES
async function openModal(simpleEv) {
    eventoAbiertoActual = simpleEv;
    const btnAddCal = document.getElementById('btn-add-calendar');
    if (btnAddCal) {
        btnAddCal.innerHTML = '<i class="fas fa-calendar-plus"></i> Añadir al Calendario';
        btnAddCal.disabled = false;
        btnAddCal.style.opacity = '1';
        btnAddCal.style.background = 'transparent';
    }

    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').innerText = simpleEv.name;
    document.getElementById('modal-location').innerText = simpleEv.venue;
    document.getElementById('modal-date-tag').innerText = simpleEv.parsedDate.toLocaleDateString('es-ES', { dateStyle: 'long' });
    document.getElementById('modal-area').innerText = simpleEv.area || "-";
    document.getElementById('modal-cat').innerText = levelMap[simpleEv.category] || simpleEv.category || "-";

    const vaultContainer = document.getElementById('modal-vault');
    vaultContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando detalles...';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        const { data, error } = await supabase
            .from('eventos')
            .select('links, contact, disciplines')
            .eq('id', simpleEv.id)
            .single();

        if (error) throw error;

        if (data.disciplines && data.disciplines.length > 0) {
            vaultContainer.innerHTML = data.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');
        } else {
            vaultContainer.innerHTML = '<span style="color: #ffcc00; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Pruebas por confirmar.</span>';
        }

        const linksCont = document.getElementById('modal-links');
        linksCont.innerHTML = '';
        if (data.links?.web)     linksCont.innerHTML += `<a href="${ensureAbsoluteUrl(data.links.web)}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web Oficial</a>`;
        if (data.links?.results) linksCont.innerHTML += `<a href="${ensureAbsoluteUrl(data.links.results)}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;

        const contactCont = document.getElementById('modal-contacts');
        contactCont.innerHTML = data.contact?.length > 0
            ? data.contact.map(c => `
                <div class="contact-box" style="border-left:4px solid #0070f3; padding:12px; margin-bottom:12px; background:rgba(255,255,255,0.05);">
                    <p style="color:#0070f3; font-size:0.75rem; font-weight:bold; margin:0;">${c.title || 'ORGANIZER'}</p>
                    <p style="margin:2px 0; font-weight:bold; color:#fff;"><i class="fas fa-user-circle"></i> ${c.name || 'N/A'}</p>
                    ${c.email ? `<p style="margin:5px 0 0 0; font-size:0.9rem;"><i class="fas fa-envelope"></i> <a href="mailto:${c.email}" style="color:#fff; opacity:0.8;">${c.email}</a></p>` : ''}
                </div>`).join('')
            : '<p style="color:#777; font-style:italic;">Contacto no publicado.</p>';

        const tripBtn = document.getElementById('btn-manage-trip');
        tripBtn.onclick = () => {
            const dateStr = simpleEv.parsedDate.toISOString().split('T')[0];
            window.location.href = `utils/travel.html?destino=${encodeURIComponent(simpleEv.venue)}&fecha=${dateStr}`;
        };

    } catch (e) {
        vaultContainer.innerHTML = "Error al conectar con el servidor.";
    }
}

// 10. CERRAR MODALES
document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

const closeLoginBtn = document.getElementById('close-login');
if (closeLoginBtn) {
    closeLoginBtn.onclick = () => {
        document.getElementById('login-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    };
}

// 11. BOTÓN CLEAR DATE
if (clearDateBtn) {
    clearDateBtn.onclick = () => {
        fp.clear();
        dateStart = null;
        dateEnd = null;
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

// 12. GÉNERO — único bloque de listeners
document.querySelectorAll('.g-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.g-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGender = btn.dataset.gender; // 'all', '🚹' o '🚺'
        applyFilters();
    });
});

// 13. LISTENERS GENERALES
[searchInput, monthSelect].forEach(el => {
    if (el) {
        el.addEventListener('change', applyFilters);
        el.addEventListener('input', applyFilters);
    }
});

// 14. AUTH
const profileBtn  = document.getElementById('profile-btn');
const loginModal  = document.getElementById('login-modal');
const loginView   = document.getElementById('login-view');
const signupView  = document.getElementById('signup-view');
const authError   = document.getElementById('auth-error');

if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const role = session.user.user_metadata?.role || 'athlete';
            window.location.href = role === 'manager' ? 'manager/dashboard.html' : 'athlete/athlete.html';
        } else {
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    });
}

document.getElementById('go-to-signup').onclick = (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    signupView.style.display = 'block';
    if (authError) authError.style.display = 'none';
};

document.getElementById('go-to-login').onclick = (e) => {
    e.preventDefault();
    signupView.style.display = 'none';
    loginView.style.display = 'block';
    if (authError) authError.style.display = 'none';
};

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = e.target.querySelector('button');
        btn.innerText = "Verificando...";
        btn.disabled = true;
        if (authError) authError.style.display = 'none';
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user) {
                const role = data.user.user_metadata?.role || 'manager';
                window.location.href = role === 'manager' ? 'manager/dashboard.html' : 'athlete/athlete.html';
            }
        } catch (error) {
            if (authError) { authError.innerText = "Email o contraseña incorrectos."; authError.style.display = 'block'; }
            btn.innerText = "Iniciar Sesión";
            btn.disabled = false;
        }
    });
}

const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name     = document.getElementById('signup-name').value;
        const email    = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const role     = document.getElementById('signup-role').value;
        const btn = e.target.querySelector('button');
        btn.innerText = "Creando cuenta...";
        btn.disabled = true;
        if (authError) authError.style.display = 'none';
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: name, role } }
        });
        if (error) {
            if (authError) { authError.innerText = error.message; authError.style.display = 'block'; }
            btn.innerText = "Crear Cuenta";
            btn.disabled = false;
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
            if (authError) { authError.innerText = "Este correo ya está registrado. Por favor, inicia sesión."; authError.style.display = 'block'; }
            btn.innerText = "Crear Cuenta";
            btn.disabled = false;
        } else {
            Swal.fire({ title: '¡Bienvenido!', text: 'Tu registro ha sido un éxito.', icon: 'success', confirmButtonText: '¡Genial!', confirmButtonColor: '#3085d6' });
            window.location.href = role === 'manager' ? 'manager/dashboard.html' : 'athlete/carga-datos.html';
        }
    });
}

async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const profileText = document.querySelector('.profile-text');
        if (profileText) profileText.innerText = "Mi Dashboard";
    }
}

// 15. MENSAJES DE AUTH
document.addEventListener('DOMContentLoaded', function() {
    const mensaje = sessionStorage.getItem('auth_message');
    const msgContainer = document.getElementById('auth-message');
    if (mensaje && msgContainer) {
        const map = {
            sesion_cerrada:    { texto: 'Sesión cerrada correctamente',                          icono: 'fa-check-circle' },
            sesion_expirada:   { texto: 'Tu sesión ha expirado. Por favor, inicia sesión.',      icono: 'fa-clock' },
            acceso_restringido:{ texto: 'Acceso restringido. Debes iniciar sesión.',             icono: 'fa-shield-alt' },
            error_verificacion:{ texto: 'Error de verificación. Por favor, inicia sesión.',     icono: 'fa-exclamation-triangle' },
        };
        const { texto, icono } = map[mensaje] || { texto: 'Por favor, inicia sesión para continuar', icono: 'fa-info-circle' };
        msgContainer.style.display = 'flex';
        msgContainer.innerHTML = `<i class="fas ${icono}"></i><span>${texto}</span>`;
        setTimeout(() => { msgContainer.style.opacity = '0'; setTimeout(() => { msgContainer.style.display = 'none'; }, 300); }, 5000);
        sessionStorage.removeItem('auth_message');
    }

    // Fix flatpickr fondo blanco
    setTimeout(() => {
        document.querySelectorAll('#date-range, .flatpickr-input').forEach(el => {
            el.style.background = 'transparent';
            el.style.backgroundColor = 'transparent';
            el.style.color = 'white';
            el.style.border = 'none';
            el.style.boxShadow = 'none';
        });
    }, 300);
});

// 16. AVISO LOGIN
const authWarningModal = document.getElementById('auth-warning-modal');

document.getElementById('btn-close-warning')?.addEventListener('click', () => {
    authWarningModal.style.display = 'none';
    document.getElementById('event-modal').style.display = 'flex';
});

document.getElementById('btn-warning-to-login')?.addEventListener('click', () => {
    authWarningModal.style.display = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
});

// 17. AÑADIR AL CALENDARIO
const btnAddCalendar = document.getElementById('btn-add-calendar');
if (btnAddCalendar) {
    btnAddCalendar.addEventListener('click', async () => {
        if (!eventoAbiertoActual) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            document.getElementById('event-modal').style.display = 'none';
            authWarningModal.style.display = 'flex';
            return;
        }
        btnAddCalendar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btnAddCalendar.disabled = true;
        const fechaFormat = eventoAbiertoActual.startDate || eventoAbiertoActual.parsedDate.toISOString().split('T')[0];
        const payload = {
            atleta_user_id: session.user.id,
            evento_oficial_id: eventoAbiertoActual.id,
            titulo_personalizado: eventoAbiertoActual.name,
            fecha_inicio: fechaFormat,
            lugar: eventoAbiertoActual.venue,
            estado: 'planeado',
            observaciones: 'Añadido desde el buscador oficial de APEX.'
        };
        const { error } = await supabase.from('calendario_atletas').insert([payload]);
        if (error) {
            console.error("Error al guardar:", error);
            alert("Error al añadir al calendario: " + error.message);
            btnAddCalendar.innerHTML = '<i class="fas fa-calendar-plus"></i> Añadir al Calendario';
            btnAddCalendar.disabled = false;
        } else {
            btnAddCalendar.innerHTML = '<i class="fas fa-check"></i> Añadido a tu calendario';
            btnAddCalendar.style.background = 'rgba(0, 209, 255, 0.15)';
            btnAddCalendar.style.border = '1px solid transparent';
            localStorage.removeItem('apex_calendario');
        }
    });
}

// 18. AUTO-FLIP DROPDOWNS
function checkDropdownFlip(wrapperEl, listEl) {
    if (!wrapperEl || !listEl) return;
    const rect = wrapperEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropHeight = Math.min(listEl.scrollHeight, 240);
    if (spaceBelow < dropHeight + 20) wrapperEl.classList.add('drop-up');
    else wrapperEl.classList.remove('drop-up');
}

[
    ['cb-continent-wrapper', 'cb-continent-list', 'cb-continent-input'],
    ['cb-country-wrapper',   'cb-country-list',   'cb-country-input'],
    ['cb-level-wrapper',     'cb-level-list',     'cb-level-input'],
    ['cb-discipline-wrapper','cb-discipline-list','cb-discipline-input'],
].forEach(([wrapperId, listId, inputId]) => {
    const wrapper = document.getElementById(wrapperId);
    const list    = document.getElementById(listId);
    const input   = document.getElementById(inputId);
    if (input && wrapper && list) input.addEventListener('focus', () => checkDropdownFlip(wrapper, list));
});

// 19. SCROLL HINT MÓVIL
(function() {
    const wrapper = document.getElementById('filter-wrapper');
    const hint    = document.getElementById('filter-scroll-hint');
    if (!wrapper || !hint) return;
    wrapper.addEventListener('scroll', function() {
        hint.classList.toggle('hidden', wrapper.scrollLeft > 30);
    }, { passive: true });
})();

// ARRANCAR
function ensureAbsoluteUrl(url) {
    if (!url) return '';
    return (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;
}

loadData();
checkCurrentSession();

// Hamburguesa filtros (solo móvil)
const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filterWrapper   = document.getElementById('filter-wrapper');
const filterBadge     = document.getElementById('filter-badge');

if (filterToggleBtn) {
    filterToggleBtn.addEventListener('click', () => {
        filterWrapper.classList.toggle('open');
        filterToggleBtn.classList.toggle('active');
    });
}

// Badge: cuenta filtros activos
function updateFilterBadge() {
    if (!filterBadge) return;
    let count = 0;
    if (selectedValues.continent !== 'all') count++;
    if (selectedValues.country   !== 'all') count++;
    if (selectedValues.level     !== 'all') count++;
    if (selectedValues.discipline!== 'all') count++;
    if (monthSelect?.value !== 'all') count++;
    if (currentGender !== 'all') count++;
    filterBadge.textContent = count;
    filterBadge.classList.toggle('visible', count > 0);
}