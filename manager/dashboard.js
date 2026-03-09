// --- CONFIGURACIÓN SUPABASE ---
const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'TU_CLAVE_ANON_AQUÍ'; // <-- Pon tu clave Real
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function initDashboard() {
    console.log("🚀 Iniciando Dashboard...");
    
    // 1. OBTENER SESIÓN ACTUAL
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        mostrarEstadoVacio("No hay sesión activa. Por favor, verifica tu identidad en Ajustes.", true);
        return;
    }

    const user = session.user;
    console.log("👤 Usuario logueado:", user.email);

    // 2. VERIFICAR SI HAY UNA ACTUALIZACIÓN DE PERFIL PENDIENTE (Viene de Ajustes)
    const waIdPendiente = localStorage.getItem('wa_id_pendiente');
    const nombrePendiente = localStorage.getItem('nombreRepresentante');

    if (waIdPendiente) {
        console.log("🔄 Actualizando perfil en la BD...");
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
            console.log("✅ Perfil actualizado correctamente.");
            localStorage.removeItem('wa_id_pendiente');
        } else {
            console.error("❌ Error actualizando perfil:", updateError.message);
        }
    }

    // 3. CONSULTAR ATLETAS EN SUPABASE (Los IDs que gestionas)
    const { data: misAtletasDB, error: dbError } = await supabaseClient
        .from('atletas')
        .select('wa_id')
        .eq('manager_id', user.id);

    if (dbError) {
        console.error("❌ Error al leer atletas de la BD:", dbError.message);
        return;
    }

    // 4. CARGAR DATOS PESADOS DEL JSON Y FILTRAR
    try {
        const response = await fetch('./datos_world_athletics.json');
        const infoWA = await response.json();

        // Buscamos los datos de los atletas cuyos IDs están en nuestra BD
        const listaFinalAtletas = [];
        
        if (misAtletasDB && misAtletasDB.length > 0) {
            misAtletasDB.forEach(atletaDB => {
                // Buscamos en el JSON global
                infoWA.forEach(representante => {
                    const encontrado = representante.athletes.find(a => a.url.includes(atletaDB.wa_id) || a.wa_id === atletaDB.wa_id);
                    if (encontrado) listaFinalAtletas.push(encontrado);
                });
            });
        }

        // 5. RENDERIZAR O MOSTRAR VACÍO
        if (listaFinalAtletas.length > 0) {
            renderizarAtletas(listaFinalAtletas);
        } else {
            mostrarEstadoVacio("Actualmente no tienes atletas asignados en la base de datos.", false);
        }

        // Actualizar UI del usuario
        actualizarInterfazUsuario(user.email);

    } catch (err) {
        console.error("❌ Error cargando el JSON:", err);
        mostrarEstadoVacio("Error al cargar los datos de los atletas.", false);
    }
}

function renderizarAtletas(atletas) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = '';
    
    atletas.forEach(atleta => {
        const card = document.createElement('div');
        card.className = `athlete-card ${atleta.gender === 'Man' ? 'card-man' : 'card-woman'}`;
        
        // Sacamos la mejor marca (la primera de la lista)
        const pb = atleta.personal_bests[0] || { mark: 'N/A', discipline: 'N/A' };
        
        card.innerHTML = `
            <div class="gender-badge">${atleta.gender === 'Man' ? '♂ HOMBRE' : '♀ MUJER'}</div>
            <h3 class="athlete-name">${atleta.name}</h3>
            <p style="color: #888; font-size: 0.8rem;">${atleta.country}</p>
            <div style="margin-top: 15px;">
                <span class="stat-label">${pb.discipline}</span>
                <span class="stat-value" style="font-size: 1.2rem;">${pb.mark}</span>
            </div>
            <a href="${atleta.url}" target="_blank" style="color: var(--accent-blue); font-size: 0.7rem; text-decoration: none; margin-top: 10px; display: block;">
                Ver ficha oficial →
            </a>
        `;
        grid.appendChild(card);
    });
    
    document.getElementById('stat-count').innerText = atletas.length;
}

function mostrarEstadoVacio(mensaje, mostrarBotonAjustes) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 15px;">
            <i class="fas fa-user-slash" style="font-size: 3rem; color: #444; margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin-bottom: 5px;">Atletas</h3>
            <p style="color: #888; margin-bottom: 20px;">${mensaje}</p>
            ${mostrarBotonAjustes ? 
                `<a href="ajustes.html" class="btn-primary" style="display: inline-flex; width: auto; text-decoration: none; margin: 0 auto; padding: 10px 20px;">Ir a Ajustes</a>` 
                : ''}
        </div>
    `;
}

function actualizarInterfazUsuario(email) {
    const nombre = localStorage.getItem('nombreRepresentante') || email;
    document.querySelector('.user-name').innerText = nombre;
    document.querySelector('.user-role').innerText = "Manager Verificado";
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${nombre}&background=0070f3&color=fff`;
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', initDashboard);

// Lógica para cerrar sesión
document.getElementById('logout-btn').onclick = async () => {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = 'ajustes.html';
};