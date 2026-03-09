// --- CONFIGURACIÓN SUPABASE ---
const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function initDashboard() {
    console.log("🚀 Iniciando Dashboard...");
    
    // 1. OBTENER SESIÓN ACTUAL
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (!session) {
        console.log("Nadie logueado");
        mostrarEstadoVacio("No hay sesión activa. Por favor, verifica tu identidad en Ajustes.", true);
        return;
    }

    const user = session.user;
    console.log("👤 Usuario logueado:", user.email);

    // 2. VINCULAR PERFIL (IMPORTANTE)
    // Si entramos por primera vez, necesitamos decirle a la tabla 'profiles' quiénes somos
    const waIdPendiente = localStorage.getItem('wa_id_pendiente');
    const nombrePendiente = localStorage.getItem('nombreRepresentante');

    if (waIdPendiente) {
        console.log("🔄 Actualizando perfil en la BD con ID:", waIdPendiente);
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .upsert({ 
                id: user.id, 
                is_verified: true, 
                wa_id: parseInt(waIdPendiente),
                full_name: nombrePendiente,
                official_email: user.email,
                role: 'manager'
            });

        if (!updateError) {
            console.log("✅ Perfil vinculado en la BD.");
            localStorage.removeItem('wa_id_pendiente');
        } else {
            console.error("❌ Error upsert profile:", updateError.message);
        }
    }

    // 3. CONSULTAR ATLETAS
    const { data: misAtletasDB, error: dbError } = await supabaseClient
        .from('atletas')
        .select('wa_id')
        .eq('manager_id', user.id);

    // 4. CARGAR JSON Y FILTRAR
    try {
        const response = await fetch('./datos_world_athletics.json');
        const infoWA = await response.json();

        let listaFinalAtletas = [];
        
        // Si tenemos atletas en la BD, los filtramos del JSON
        if (misAtletasDB && misAtletasDB.length > 0) {
            const idsEnBD = misAtletasDB.map(a => parseInt(a.wa_id));
            
            infoWA.forEach(repre => {
                repre.athletes.forEach(atleta => {
                    // Extraer ID de la URL si no viene directo
                    const idUrl = parseInt(atleta.url.split('/').pop());
                    if (idsEnBD.includes(idUrl)) {
                        listaFinalAtletas.push(atleta);
                    }
                });
            });
        }

        if (listaFinalAtletas.length > 0) {
            renderizarAtletas(listaFinalAtletas);
        } else {
            // MENSAJE SI NO HAY ATLETAS ASIGNADOS EN LA BD
            mostrarEstadoVacio("No tienes atletas asignados a tu cuenta todavía.", false);
        }

        actualizarInterfazUsuario(user.email);

    } catch (err) {
        console.error("❌ Error:", err);
        mostrarEstadoVacio("Error al conectar con el servidor de datos.", false);
    }
}

// --- FUNCIONES DE INTERFAZ ---

function mostrarEstadoVacio(mensaje, mostrarBotonAjustes) {
    const grid = document.getElementById('athlete-grid');
    if(!grid) return;
    
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 15px; width: 100%; box-sizing: border-box;">
            <i class="fas fa-user-friends" style="font-size: 3rem; color: #333; margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin-bottom: 10px;">Tu Lista de Atletas</h3>
            <p style="color: #888; margin-bottom: 25px; max-width: 300px; margin-left: auto; margin-right: auto;">${mensaje}</p>
            ${mostrarBotonAjustes ? 
                `<a href="ajustes.html" class="btn-primary" style="display: inline-flex; width: auto; text-decoration: none; margin: 0 auto; padding: 12px 25px;">Ir a Ajustes</a>` 
                : ''}
        </div>
    `;
}

// --- LÓGICA DEL MENÚ MÓVIL (HAMBURGUESA) ---
function initMobileMenu() {
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
}

function renderizarAtletas(atletas) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = '';
    atletas.forEach(atleta => {
        const card = document.createElement('div');
        card.className = `athlete-card ${atleta.gender === 'Man' ? 'card-man' : 'card-woman'}`;
        const pb = atleta.personal_bests[0] || { mark: '-', discipline: '-' };
        card.innerHTML = `
            <div class="gender-badge">${atleta.gender === 'Man' ? '♂ Man' : '♀ Woman'}</div>
            <h3 class="athlete-name">${atleta.name}</h3>
            <p style="color: #666; font-size: 0.8rem;">${atleta.country}</p>
            <div style="margin-top: 15px;">
                <span class="stat-label">${pb.discipline}</span>
                <span class="stat-value">${pb.mark}</span>
            </div>
        `;
        grid.appendChild(card);
    });
    document.getElementById('stat-count').innerText = atletas.length;
}

function actualizarInterfazUsuario(email) {
    const nombre = localStorage.getItem('nombreRepresentante') || email;
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    if(nameEl) nameEl.innerText = nombre;
    if(roleEl) roleEl.innerText = "Manager Verificado";
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initMobileMenu();
});

const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = 'ajustes.html';
    };
}