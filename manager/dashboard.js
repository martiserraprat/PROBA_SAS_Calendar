// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Función principal que arranca el Dashboard
async function init() {
    console.log("🚀 Dashboard iniciado");
    
    // Comprobar si hay sesión activa
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        console.warn("⚠️ No hay sesión activa");
        renderEstadoVacio("Debes verificar tu identidad en Ajustes para acceder.", true);
        return;
    }

    const user = session.user;
    console.log("👤 Usuario detectado:", user.email);

    // --- 2. LÓGICA DE VERIFICACIÓN (PASAR A TRUE EN BD) ---
    const waIdPendiente = localStorage.getItem('wa_id_pendiente');
    const nombrePendiente = localStorage.getItem('nombreRepresentante');

    if (waIdPendiente) {
        console.log("🔄 Detectado registro pendiente. Actualizando base de datos...");
        
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
            console.log("✅ Perfil verificado con éxito en la BD.");
            localStorage.removeItem('wa_id_pendiente');
            // Recargamos para limpiar la URL de tokens y aplicar cambios
            window.location.reload(); 
            return;
        } else {
            console.error("❌ Error actualizando is_verified:", updateError.message);
        }
    }

    // --- 3. CARGAR ATLETAS DEL MANAGER ---
    cargarDatosDashboard(user);
    initMenuMovil();
}

async function cargarDatosDashboard(user) {
    // Consultar IDs de atletas asociados en Supabase
    const { data: misAtletasDB, error: dbError } = await supabaseClient
        .from('atletas')
        .select('wa_id')
        .eq('manager_id', user.id);

    if (dbError) {
        console.error("Error consultando atletas:", dbError.message);
    }

    try {
        const response = await fetch('./datos_world_athletics.json');
        const infoWA = await response.json();
        let listaAtletasFinal = [];

        // Filtrar el JSON usando los IDs de la base de datos
        if (misAtletasDB && misAtletasDB.length > 0) {
            const idsPermitidos = misAtletasDB.map(a => parseInt(a.wa_id));
            
            infoWA.forEach(repre => {
                repre.athletes.forEach(atleta => {
                    const idAtleta = parseInt(atleta.url.split('/').pop());
                    if (idsPermitidos.includes(idAtleta)) {
                        listaAtletasFinal.push(atleta);
                    }
                });
            });
        }

        // Renderizar resultados
        if (listaAtletasFinal.length > 0) {
            renderizarCards(listaAtletasFinal);
        } else {
            renderEstadoVacio("No tienes atletas asignados actualmente.", false);
        }

        actualizarUIUsuario(user.email);

    } catch (err) {
        console.error("Error cargando JSON:", err);
    }
}

// --- 4. FUNCIONES DE INTERFAZ Y UI ---

function renderizarCards(atletas) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = '';
    
    atletas.forEach(atleta => {
        const pb = atleta.personal_bests[0] || { mark: '-', discipline: '-' };
        const card = document.createElement('div');
        card.className = `athlete-card ${atleta.gender === 'Man' ? 'card-man' : 'card-woman'}`;
        card.innerHTML = `
            <div class="gender-badge">${atleta.gender === 'Man' ? '♂ HOMBRE' : '♀ MUJER'}</div>
            <h3 class="athlete-name">${atleta.name}</h3>
            <p style="color: #666; font-size: 0.8rem; margin-bottom: 10px;">${atleta.country}</p>
            <div class="stat-row">
                <span class="stat-label">${pb.discipline}</span>
                <span class="stat-value" style="font-size: 1.1rem; display:block;">${pb.mark}</span>
            </div>
            <a href="${atleta.url}" target="_blank" style="font-size: 0.7rem; color: #0070f3; text-decoration: none; display: block; margin-top: 10px;">Ficha World Athletics →</a>
        `;
        grid.appendChild(card);
    });
    document.getElementById('stat-count').innerText = atletas.length;
}

function renderEstadoVacio(mensaje, conBoton) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 18px; width: 100%;">
            <i class="fas fa-user-friends" style="font-size: 3rem; color: #222; margin-bottom: 15px;"></i>
            <h3 style="margin-bottom: 10px;">Panel de Atletas</h3>
            <p style="color: #666; margin-bottom: 20px;">${mensaje}</p>
            ${conBoton ? '<a href="ajustes.html" class="btn-primary" style="text-decoration:none; display:inline-flex; margin: 0 auto;">Ir a Ajustes</a>' : ''}
        </div>
    `;
}

function actualizarUIUsuario(email) {
    const nombre = localStorage.getItem('nombreRepresentante') || email;
    document.querySelector('.user-name').innerText = nombre;
    document.querySelector('.user-role').innerText = "Manager Verificado";
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nombre}&background=0070f3&color=fff`;
}

// Lógica para la Hamburguesa (Menú Móvil)
function initMenuMovil() {
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggle) {
        toggle.onclick = () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        };
    }
    
    if (overlay) {
        overlay.onclick = () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        };
    }
}

// Cerrar sesión
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = 'ajustes.html';
    };
}

// Disparar inicio
document.addEventListener('DOMContentLoaded', init);