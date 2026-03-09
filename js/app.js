// 1. CONFIGURACIÓN Y REFERENCIAS
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

const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let allEvents = [];
let currentGender = 'all';
let dateStart = null;
let dateEnd = null;
let fp = null;

const levelMap = { 'OW': 'OLYMPIC/WORLD', 'DF': 'DL FINAL', 'GW': 'DIAMOND', 'GL': 'CHAMPIONSHIP', 'A': 'GOLD', 'B': 'SILVER', 'C': 'BRONZE', 'D': 'CHALLENGER' };
const regexSub = /\b(U14|U16|U18|U20|U23|Junior|Youth)\b/gi;

function getOnlyCountryCode(venue) {
    if (!venue) return "INT";
    const match = venue.match(/\(([^)]+)\)$/);
    return match ? match[1].toUpperCase() : "INT";
}

// 2. INICIALIZAR CALENDARIO
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

// 3. CARGA DE DATOS OPTIMIZADA
async function loadData() {
    try {
        const cacheKey = 'events_data_2026';
        const cacheTimeKey = 'events_data_time';
        const cachedData = localStorage.getItem(cacheKey);
        const lastFetch = localStorage.getItem(cacheTimeKey);
        const oneHour = 60 * 60 * 1000;

        if (cachedData && lastFetch && (Date.now() - lastFetch < oneHour)) {
            console.log("🚀 Cargando desde caché local");
            processAndRender(JSON.parse(cachedData));
            return;
        }

        console.log("⏳ Descargando de Supabase...");
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
        .map(ev => ({
            ...ev,
            parsedDate: new Date(ev.startDate)
        }));
    allEvents.sort((a, b) => a.parsedDate - b.parsedDate);
    updateFilterOptions(allEvents);
    applyFilters();
}

// 4. MODAL DETALLES
async function openModal(simpleEv) {
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

        // Disciplinas
        if (data.disciplines && data.disciplines.length > 0) {
            vaultContainer.innerHTML = data.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');
        } else {
            vaultContainer.innerHTML = '<span style="color: #ffcc00; font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> Pruebas por confirmar.</span>';
        }

        // Links
        const linksCont = document.getElementById('modal-links');
        linksCont.innerHTML = '';
        if (data.links?.web) linksCont.innerHTML += `<a href="${ensureAbsoluteUrl(data.links.web)}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web Oficial</a>`;
        if (data.links?.results) linksCont.innerHTML += `<a href="${ensureAbsoluteUrl(data.links.results)}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;

        // Contactos
        const contactCont = document.getElementById('modal-contacts');
        contactCont.innerHTML = data.contact?.length > 0 
            ? data.contact.map(c => `
                <div class="contact-box" style="border-left:4px solid #0070f3; padding:12px; margin-bottom:12px; background:rgba(255,255,255,0.05);">
                    <p style="color:#0070f3; font-size:0.75rem; font-weight:bold; margin:0;">${c.title || 'ORGANIZER'}</p>
                    <p style="margin:2px 0; font-weight:bold; color:#fff;"><i class="fas fa-user-circle"></i> ${c.name || 'N/A'}</p>
                    ${c.email ? `<p style="margin:5px 0 0 0; font-size:0.9rem;"><i class="fas fa-envelope"></i> <a href="mailto:${c.email}" style="color:#fff; opacity:0.8;">${c.email}</a></p>` : ''}
                </div>`).join('')
            : '<p style="color:#777; font-style:italic;">Contacto no publicado.</p>';

        // Viaje
        const tripBtn = document.getElementById('btn-manage-trip');
        tripBtn.onclick = () => {
            const dateStr = simpleEv.parsedDate.toISOString().split('T')[0];
            window.location.href = `utils/travel.html?destino=${encodeURIComponent(simpleEv.venue)}&fecha=${dateStr}`;
        };

    } catch (e) {
        vaultContainer.innerHTML = "Error al conectar con el servidor.";
    }
}

// 5. CERRAR MODALES
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

// 6. FILTROS Y RENDER (ETIQUETAS RECUPERADAS)
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const continent = continentSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;
    const disc = disciplineSelect.value;

    const filtered = allEvents.filter(ev => {
        const m = (ev.parsedDate.getMonth() + 1).toString().padStart(2, '0');
        const matchesSearch = ev.name.toLowerCase().includes(search) || ev.venue.toLowerCase().includes(search);
        const matchesMonth = month === 'all' || m === month;
        const matchesContinent = continent === 'all' || ev.area === continent;
        const matchesCountry = selectedCode === 'all' || getOnlyCountryCode(ev.venue) === selectedCode;
        const matchesLevel = level === 'all' || ev.category === level;
        
        const hasNoDiscs = !ev.disciplines || ev.disciplines.length === 0;
        const matchesDisc = disc === 'all' || hasNoDiscs || ev.disciplines.some(d => d.name === disc);
        
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = hasNoDiscs || ev.disciplines.some(d => (disc === 'all' || d.name === disc) && (d.gender === target || d.gender === 'Both'));
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(ev.parsedDate).setHours(0,0,0,0);
            matchesDateRange = evTime >= new Date(dateStart).setHours(0,0,0,0) && evTime <= new Date(dateEnd).setHours(0,0,0,0);
        }

        return matchesSearch && matchesMonth && matchesContinent && matchesCountry && matchesLevel && matchesDisc && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}

function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.parsedDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
        
        // Estética del nivel
        let levelName = levelMap[ev.category] || ev.category;
        let levelClass = "level-silver";
        if (['OW','DF','GW'].includes(ev.category)) levelClass = "level-diamond";
        else if (['GL','A'].includes(ev.category)) levelClass = "level-gold";
        else if (ev.category === 'B') levelClass = "level-silver";
        else if (ev.category === 'C') levelClass = "level-bronze";
        else if (ev.category === 'D') levelClass = "level-challenger";

        // RECUPERADO: Lógica de la etiqueta de género
        let genderLabel = "M / F";
        let genderClass = "tag-both";
        
        if (ev.disciplines && ev.disciplines.length > 0) {
            const hasMen = ev.disciplines.some(d => d.gender === 'Men' || d.gender === 'Both');
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

// BOTÓN CLEAR DATE
if(clearDateBtn) {
    clearDateBtn.onclick = () => {
        fp.clear();
        dateStart = null;
        dateEnd = null;
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

// HELPERS
function updateFilterOptions(events) {
    const validEvents = events.filter(e => e.parsedDate.getFullYear() === 2026);
    continentSelect.innerHTML = '<option value="all">Continentes</option>' + [...new Set(validEvents.map(e => e.area).filter(Boolean))].sort().map(c => `<option value="${c}">${c}</option>`).join('');
    countrySelect.innerHTML = '<option value="all">Países</option>' + [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort().map(code => `<option value="${code}">${code}</option>`).join('');
    levelSelect.innerHTML = '<option value="all">Niveles</option>' + [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort().map(l => `<option value="${l}">${levelMap[l] || l}</option>`).join('');
    
    let allDiscs = [];
    validEvents.forEach(ev => ev.disciplines?.forEach(d => allDiscs.push(d.name)));
    disciplineSelect.innerHTML = '<option value="all">Todas las pruebas</option>' + [...new Set(allDiscs)].sort().map(d => `<option value="${d}">${d}</option>`).join('');
}

function ensureAbsoluteUrl(url) {
    if (!url) return '';
    return (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;
}


// --- LÓGICA DE AUTH (LOGIN / REGISTRO / DASHBOARD) ---

const profileBtn = document.getElementById('profile-btn');
const loginModal = document.getElementById('login-modal');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const authError = document.getElementById('auth-error');

// Abrir modal O ir al dashboard si ya hay sesión
if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            const role = session.user.user_metadata?.role || 'athlete';
            if (role === 'manager') {
                window.location.href = 'manager/dashboard.html';
            } else {
                window.location.href = 'athlete/profile.html';
            }
        } else {
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    });
}

// Intercambio Login/Registro
document.getElementById('go-to-signup').onclick = (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    signupView.style.display = 'block';
    if(authError) authError.style.display = 'none';
};

document.getElementById('go-to-login').onclick = (e) => {
    e.preventDefault();
    signupView.style.display = 'none';
    loginView.style.display = 'block';
    if(authError) authError.style.display = 'none';
};

// Formulario de Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = e.target.querySelector('button');

        btn.innerText = "Verificando...";
        btn.disabled = true;
        if(authError) authError.style.display = 'none';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            if (data.user) {
                const role = data.user.user_metadata?.role || 'manager';
                window.location.href = role === 'manager' ? 'manager/dashboard.html' : 'athlete/profile.html';
            }
        } catch (error) {
            if(authError) {
                authError.innerText = "Email o contraseña incorrectos.";
                authError.style.display = 'block';
            }
            btn.innerText = "Iniciar Sesión";
            btn.disabled = false;
        }
    });
}

// Formulario de Registro
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const role = document.getElementById('signup-role').value; 

        const btn = e.target.querySelector('button');
        btn.innerText = "Creando cuenta...";
        btn.disabled = true;
        if(authError) authError.style.display = 'none';

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { 
                    full_name: name,
                    role: role 
                }
            }
        });

        if (error) {
            if(authError) {
                authError.innerText = error.message;
                authError.style.display = 'block';
            }
            btn.innerText = "Crear Cuenta";
            btn.disabled = false;
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
            if(authError) {
                authError.innerText = "Este correo ya está registrado. Por favor, inicia sesión.";
                authError.style.display = 'block';
            }
            btn.innerText = "Crear Cuenta";
            btn.disabled = false;
        } else {
            alert("¡Registro exitoso! Revisa tu correo o inicia sesión directamente.");
            window.location.href = role === 'manager' ? 'manager/dashboard.html' : 'athlete/profile.html';
        }
    });
}

// Chequeo inicial de sesión para cambiar texto del botón
async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const profileText = document.querySelector('.profile-text');
        if (profileText) profileText.innerText = "Mi Dashboard";
    }
}

// Inicializar datos y sesión
loadData();
checkCurrentSession();

// Listeners
[searchInput, monthSelect, continentSelect, countrySelect, levelSelect, disciplineSelect].forEach(el => {
    el.addEventListener('change', applyFilters);
    el.addEventListener('input', applyFilters);
});

genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        genderButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGender = btn.dataset.gender;
        applyFilters();
    });
});