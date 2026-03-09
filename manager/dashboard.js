let supabaseClient;

try {
    const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
    
    // Inicializamos el cliente usando el objeto global de la librería
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log("🚀 Cliente de Supabase listo");
} catch (e) {
    console.error("❌ Error inicializando Supabase:", e);
}

async function comprobarSesion() {
    // Esto detecta automáticamente el código del Magic Link en la URL
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Error recuperando sesión:", error.message);
        return;
    }

    if (session) {
        console.log("✅ ¡SESIÓN ACTIVA!", session.user.email);
        
        // CAMBIO VISUAL: Ponemos el nombre del representante en la interfaz
        const nombreGuardado = localStorage.getItem('nombreRepresentante');
        document.querySelector('.user-name').innerText = nombreGuardado || session.user.email;
        document.querySelector('.user-role').innerText = "Representante Verificado";
        
        // Aquí llamarías a tu función de cargarAtletas()
        // cargarAtletas(session.user.email); 
    } else {
        console.log("❌ No hay sesión activa. Redirigiendo a ajustes...");
        // Opcional: window.location.href = 'ajustes.html';
    }
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', comprobarSesion);


const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function toggleMenu() {
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
if (overlay) overlay.addEventListener('click', toggleMenu);


// ==========================================
// 2. VARIABLES GLOBALES PARA LOS FILTROS
// ==========================================
let todosLosAtletas = [];
let filtroGeneroActual = 'all';
let filtroPruebaActual = 'all';


// ==========================================
// 3. CARGA DE DATOS (JSON)
// ==========================================
async function loadDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
    return;
    }

    document.querySelector('.user-name').innerText = 'Admin Local';
    document.querySelector('.user-role').innerText = 'Visor de Datos';

    // 1. LEER EL NOMBRE GUARDADO EN AJUSTES
    const nombreRepresentante = localStorage.getItem('nombreRepresentante');
    const grid = document.getElementById('athlete-grid');

    // Si no hay nombre guardado o está vacío, paramos aquí
    if (!nombreRepresentante) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 15px;">
                    <i class="fas fa-id-badge" style="font-size: 3rem; color: #444; margin-bottom: 15px;"></i>
                    <h3 style="color: #fff; margin-bottom: 5px;">Representante no configurado</h3>
                    <p style="color: #888; margin-bottom: 20px;">No sabemos de quién mostrar los datos.</p>
                    <a href="ajustes.html" class="btn-primary" style="display: inline-flex; width: auto; text-decoration: none; margin: 0 auto; padding: 10px 20px;">
                        Ir a Ajustes
                    </a>
                </div>
            `;
        document.getElementById('stat-count').innerText = "0";
        return; 
    }

    try {
        const response = await fetch('./datos_world_athletics.json');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const agentes = await response.json();

        let todasLasDisciplinas = new Set(); 

        // 2. FILTRAR POR EL REPRESENTANTE GUARDADO
        agentes.forEach(agente => {
            // Comparamos los nombres pasándolo todo a minúsculas por si hay fallos de mayúsculas
            if (agente.name.toLowerCase() === nombreRepresentante.toLowerCase()) {
                
                if (agente.athletes && agente.athletes.length > 0) {
                    const atletasConRepre = agente.athletes.map(a => {
                        if (a.personal_bests) {
                            a.personal_bests.forEach(pb => todasLasDisciplinas.add(pb.discipline));
                        }
                        return { ...a, representative_name: agente.name };
                    });
                    todosLosAtletas = todosLosAtletas.concat(atletasConRepre);
                }
            }
        });

        // Ordenar alfabéticamente
        todosLosAtletas.sort((a, b) => a.name.localeCompare(b.name));

        // Rellenar el selector de pruebas
        const selectPruebas = document.getElementById('discipline-filter');
        if (selectPruebas) {
            Array.from(todasLasDisciplinas).sort().forEach(disc => {
                if(disc) {
                    const option = document.createElement('option');
                    option.value = disc;
                    option.textContent = disc;
                    selectPruebas.appendChild(option);
                }
            });
        }

        // Renderizar y activar filtros
        renderAtletas(todosLosAtletas);
        activarFiltros();

    } catch (error) {
        console.error("Error cargando el JSON:", error);
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px; border: 1px solid #ff4d4d; border-radius: 10px; background: rgba(255,0,0,0.1);">
                    <h3 style="color: #ff4d4d;">Error al cargar los datos</h3>
                    <p style="color: #ccc;">Asegúrate de estar usando un servidor local (Live Server).</p>
                </div>
            `;
        }
    }
}

// ==========================================
// 4. RENDERIZADO DE TARJETAS
// ==========================================
function renderAtletas(lista) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const countEl = document.getElementById('stat-count');
    if (countEl) countEl.innerText = lista.length;

    if (!lista || lista.length === 0) {
        grid.innerHTML = `<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 50px;">No hay atletas que coincidan con los filtros.</p>`;
        return;
    }

    lista.forEach(atleta => {
        let pruebas = "Sin pruebas";
        if (atleta.personal_bests && atleta.personal_bests.length > 0) {
            const disciplinasUnicas = [...new Set(atleta.personal_bests.map(pb => pb.discipline))];
            pruebas = disciplinasUnicas.slice(0, 3).join(', ');
            if (disciplinasUnicas.length > 3) pruebas += '...';
        }

        const isMan = atleta.gender === "Man";
        const cardColorClass = isMan ? "card-man" : "card-woman";
        const genderIcon = isMan ? "fa-mars" : "fa-venus";
        const genderText = isMan ? "Hombre" : "Mujer";

        const card = document.createElement('div');
        card.className = `athlete-card ${cardColorClass}`;
        card.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
                <div class="gender-badge"><i class="fas ${genderIcon}"></i> ${genderText}</div>
                <span style="color: #888; font-size: 0.75rem;"><i class="fas fa-flag"></i> ${atleta.country || '--'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="flex-grow: 1; overflow: hidden;">
                    <h3 class="athlete-name" onclick="abrirFichaCompleta('${atleta.url}')" style="margin: 0; font-size: 1.15rem; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${atleta.name}">
                        ${atleta.name}
                    </h3>
                    <span style="display: block; color: var(--text-gray); font-size: 0.8rem; margin-top: 4px;">${pruebas}</span>
                </div>
            </div>
            <button class="btn-primary" style="width: 100%; font-size: 0.8rem; padding: 8px; background: #1a1a1a; color: #fff; border: 1px solid #333;" onclick="abrirFichaCompleta('${atleta.url}')">
                Ver Ficha Completa
            </button>
        `;
        grid.appendChild(card);
    });
}


// ==========================================
// 5. LÓGICA DE FILTROS COMBINADOS
// ==========================================
function aplicarFiltros() {
    let filtrados = todosLosAtletas;

    // Filtro por género
    if (filtroGeneroActual !== 'all') {
        filtrados = filtrados.filter(a => a.gender === filtroGeneroActual);
    }

    // Filtro por prueba
    if (filtroPruebaActual !== 'all') {
        filtrados = filtrados.filter(a => {
            if (!a.personal_bests) return false;
            return a.personal_bests.some(pb => pb.discipline === filtroPruebaActual);
        });
    }

    renderAtletas(filtrados);
}

function activarFiltros() {
    const pills = document.querySelectorAll('#gender-filters .pill');
    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            
            filtroGeneroActual = e.target.getAttribute('data-gender'); 
            aplicarFiltros();
        });
    });

    const selectPruebas = document.getElementById('discipline-filter');
    if (selectPruebas) {
        selectPruebas.addEventListener('change', (e) => {
            filtroPruebaActual = e.target.value;
            e.target.style.color = e.target.value === 'all' ? '#666' : '#fff';
            e.target.style.borderColor = e.target.value === 'all' ? 'var(--border-color)' : 'var(--accent-blue)';
            aplicarFiltros();
        });
    }
}


// ==========================================
// 6. UTILIDADES
// ==========================================
window.abrirFichaCompleta = function(urlAtleta) {
    if (urlAtleta && urlAtleta !== 'undefined') {
        window.open(urlAtleta, '_blank');
    } else {
        alert("Enlace no disponible para este atleta.");
    }
}

// INICIALIZAR DASHBOARD
loadDashboard();