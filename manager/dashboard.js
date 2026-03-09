let todosLosAtletas = [];
let filtroGeneroActual = 'all';
let filtroPruebaActual = 'all';

// --- 3. CARGA DE DATOS Y VERIFICACIÓN ---
async function loadDashboard() {
    console.log("🚀 Esperando confirmación de sesión...");
    const grid = document.getElementById('athlete-grid');
    if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #666;"><i class="fas fa-spinner fa-spin"></i> Cargando panel...</div>';

    // 1. ESCUCHADOR DE CAMBIO DE ESTADO
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log("🔔 Evento de Auth detectado:", event);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session) {
                console.log("✅ Sesión confirmada para:", session.user.email);
                await ejecutarVerificacionPendiente(session.user);
            } else {
                console.log("🚫 No hay sesión activa.");
                renderEstadoVacio("No hay sesión activa. Por favor, verifica tu identidad en Ajustes.", true);
            }
        } else if (event === 'SIGNED_OUT') {
            renderEstadoVacio("Sesión cerrada.", true);
        }
    });
}

async function ejecutarVerificacionPendiente(user) {
    const waId = localStorage.getItem('wa_id_pendiente');
    const nombre = localStorage.getItem('nombreRepresentante');

    if (waId && nombre) {
        console.log("🛡️ DATOS DETECTADOS. Lanzando validación RPC...");
        
        const { error } = await supabaseClient.rpc('verificar_manager', {
            id_wa_input: parseInt(waId),
            nombre_input: nombre
        });

        if (!error) {
            console.log("🎉 PERFIL ACTUALIZADO EN BD.");
            localStorage.removeItem('wa_id_pendiente');
            localStorage.removeItem('nombreRepresentante');
            
            setTimeout(() => { window.location.reload(); }, 500);
        } else {
            console.error("❌ ERROR EN RPC:", error.message);
            renderEstadoVacio("Hubo un error al verificar tu cuenta.", true);
        }
    } else {
        // AQUÍ ESTABA EL FALLO: LLAMÁBAMOS A UNA FUNCIÓN QUE NO EXISTÍA
        await cargarAtletasVerificados(user);
    }
}

// ESTA ES LA FUNCIÓN QUE FALTABA
async function cargarAtletasVerificados(user) {
    try {
        console.log("📥 Obteniendo datos oficiales del manager...");
        
        // 1. Miramos si el usuario está verificado en la BD
        const { data: perfil, error: perfilErr } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (perfilErr || !perfil || !perfil.is_verified) {
            renderEstadoVacio("Tu perfil no está verificado. Ve a Ajustes para vincular tu cuenta oficial.", true);
            return;
        }

        // 2. Actualizamos su nombre en la interfaz
        const nameEl = document.querySelector('.user-name');
        const roleEl = document.querySelector('.user-role');
        if (nameEl) nameEl.innerText = perfil.full_name;
        if (roleEl) roleEl.innerText = 'Manager Oficial';

        // 3. Buscamos a sus atletas en el JSON
        const response = await fetch('../datos_world_athletics.json');
        const agentes = await response.json();
        let todasLasDisciplinas = new Set();

        const agenteEncontrado = agentes.find(ag => ag.name.toLowerCase() === perfil.full_name.toLowerCase());

        if (agenteEncontrado && agenteEncontrado.athletes && agenteEncontrado.athletes.length > 0) {
            todosLosAtletas = agenteEncontrado.athletes.map(a => {
                if (a.personal_bests) {
                    a.personal_bests.forEach(pb => todasLasDisciplinas.add(pb.discipline));
                }
                return a;
            });

            todosLosAtletas.sort((a, b) => a.name.localeCompare(b.name));

            // 4. Rellenar los filtros de pruebas
            const selectPruebas = document.getElementById('discipline-filter');
            if (selectPruebas) {
                selectPruebas.innerHTML = '<option value="all">Todas las pruebas</option>';
                Array.from(todasLasDisciplinas).sort().forEach(disc => {
                    const option = document.createElement('option');
                    option.value = disc;
                    option.textContent = disc;
                    selectPruebas.appendChild(option);
                });
            }

            renderAtletas(todosLosAtletas);
            activarFiltros();
        } else {
            renderEstadoVacio("Eres mánager verificado, pero no tienes atletas registrados en nuestra base de datos.", false);
        }

    } catch (error) {
        console.error("❌ Error cargando atletas:", error);
        renderEstadoVacio("Hubo un error al cargar la lista de atletas.", false);
    }
}

// --- 4. RENDERIZADO ---
function renderEstadoVacio(mensaje, mostrarBoton) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 15px;">
            <i class="fas fa-user-shield" style="font-size: 3rem; color: #444; margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin-bottom: 5px;">Panel de Atletas</h3>
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