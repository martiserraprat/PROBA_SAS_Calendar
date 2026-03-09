// --- 1. CONFIGURACIÓN SUPABASE ---
const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. VARIABLES GLOBALES ---
let todosLosAtletas = [];
let filtroGeneroActual = 'all';
let filtroPruebaActual = 'all';

// --- 3. CARGA DE DATOS Y VERIFICACIÓN ---
async function loadDashboard() {
    console.log("🚀 Iniciando Dashboard Seguro...");
    const grid = document.getElementById('athlete-grid');
    
    // 1. Ponemos un spinner o mensaje de carga inicial
    if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #666;"><i class="fas fa-spinner fa-spin"></i> Verificando credenciales...</div>';

    try {
        // A. Obtener sesión
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError || !session) {
            console.warn("⚠️ No hay sesión activa");
            renderEstadoVacio("No hay sesión activa. Por favor, verifica tu identidad en Ajustes.", true);
            return;
        }

        // B. Procesar verificación pendiente (RPC)
        const waIdPendiente = localStorage.getItem('wa_id_pendiente');
        const nombrePendiente = localStorage.getItem('nombreRepresentante');

        if (waIdPendiente && nombrePendiente) {
            const { error } = await supabaseClient.rpc('verificar_manager', {
                id_wa_input: parseInt(waIdPendiente),
                nombre_input: nombrePendiente
            });
            if (!error) {
                localStorage.removeItem('wa_id_pendiente');
                localStorage.removeItem('nombreRepresentante');
                window.location.reload(); 
                return;
            }
        }

        // C. Obtener perfil verificado
        const { data: perfil, error: perfilErr } = await supabaseClient
            .from('profiles')
            .select('*')
            .single();

        // IMPORTANTE: Si el perfil no existe o no está verificado, MOSTRAR EL MENSAJE
        if (perfilErr || !perfil || !perfil.is_verified) {
            console.log("🚫 Perfil no verificado o error de perfil");
            renderEstadoVacio("Tu perfil no está verificado en la base de datos oficial.", true);
            return;
        }

        // Si llegamos aquí, el usuario es válido. Actualizamos UI.
        document.querySelector('.user-name').innerText = perfil.full_name;
        document.querySelector('.user-role').innerText = 'Manager Oficial';

        // D. Cargar y filtrar JSON
        const response = await fetch('../datos_world_athletics.json');
        const agentes = await response.json();
        
        const agenteEncontrado = agentes.find(ag => ag.name.toLowerCase() === perfil.full_name.toLowerCase());

        if (agenteEncontrado && agenteEncontrado.athletes) {
            todosLosAtletas = agenteEncontrado.athletes;
            renderAtletas(todosLosAtletas);
            activarFiltros();
        } else {
            renderEstadoVacio("Eres mánager verificado, pero no tienes atletas asignados en el JSON.", false);
        }

    } catch (error) {
        console.error("❌ Error crítico:", error);
        renderEstadoVacio("Hubo un error al conectar con Supabase. Revisa tu conexión.", true);
    }
}

// --- 4. RENDERIZADO ---
function renderEstadoVacio(mensaje, mostrarBoton) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 15px;">
            <i class="fas fa-user-shield" style="font-size: 3rem; color: #444; margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin-bottom: 5px;">Acceso Restringido</h3>
            <p style="color: #888; margin-bottom: 20px;">${mensaje}</p>
            ${mostrarBoton ? `<a href="ajustes.html" class="btn-primary" style="display:inline-block; text-decoration:none;">Ir a Ajustes</a>` : ''}
        </div>
    `;
    const count = document.getElementById('stat-count');
    if (count) count.innerText = "0";
}

function renderAtletas(lista) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const count = document.getElementById('stat-count');
    if (count) count.innerText = lista.length;

    if (lista.length === 0) {
        grid.innerHTML = `<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 50px;">No se encontraron atletas.</p>`;
        return;
    }

    lista.forEach(atleta => {
        const isMan = atleta.gender === "Man";
        const card = document.createElement('div');
        card.className = `athlete-card ${isMan ? "card-man" : "card-woman"}`;
        
        let pbHTML = '';
        if (atleta.personal_bests && atleta.personal_bests.length > 0) {
            const principal = atleta.personal_bests[0];
            pbHTML = `<div style="margin-top:10px;"><span class="stat-label">${principal.discipline}</span><span class="stat-value">${principal.mark}</span></div>`;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <div class="gender-badge"><i class="fas ${isMan ? 'fa-mars' : 'fa-venus'}"></i> ${isMan ? 'Hombre' : 'Mujer'}</div>
                <span style="color: #888; font-size: 0.75rem;">${atleta.country || ''}</span>
            </div>
            <h3 class="athlete-name" style="margin-bottom: 5px;">${atleta.name}</h3>
            ${pbHTML}
            <button class="btn-primary" style="width:100%; margin-top:15px; font-size:0.8rem;" onclick="window.open('${atleta.url}', '_blank')">Ver Ficha WA</button>
        `;
        grid.appendChild(card);
    });
}

// --- 5. FILTROS ---
function aplicarFiltros() {
    let filtrados = todosLosAtletas;
    if (filtroGeneroActual !== 'all') filtrados = filtrados.filter(a => a.gender === filtroGeneroActual);
    if (filtroPruebaActual !== 'all') {
        filtrados = filtrados.filter(a => a.personal_bests && a.personal_bests.some(pb => pb.discipline === filtroPruebaActual));
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
            aplicarFiltros();
        });
    }
}

// --- 6. INICIALIZACIÓN Y EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos
    loadDashboard();

    // Menú móvil
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Botón Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabaseClient.auth.signOut();
            if (!error) {
                localStorage.clear();
                window.location.href = '../index.html';
            } else {
                alert("Error al cerrar sesión");
            }
        });
    }
});