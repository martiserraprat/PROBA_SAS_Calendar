const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "ajustes.html";
        return;
    }

    // 1. Miramos si está verificado en la tabla de Supabase
    const { data: perfil, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (perfil && perfil.is_verified) {
        // 2. Buscamos sus atletas en el JSON usando su wa_id
        const res = await fetch('./datos_world_athletics.json');
        const agentes = await res.json();
        const yo = agentes.find(a => a.wa_id === perfil.wa_id);

        if (yo) {
            renderizarCards(yo.athletes);
            actualizarUIUsuario(yo.name);
        }
    } else {
        renderEstadoVacio("Tu cuenta no está vinculada. Ve a Ajustes.", true);
    }
}

async function cargarDatosDashboard(user) {
    // 1. Miramos el perfil del usuario logueado
    const { data: perfil } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!perfil || !perfil.is_verified) {
        renderEstadoVacio("Tu cuenta no está verificada o no tienes permisos.", true);
        return;
    }

    try {
        const response = await fetch('./datos_world_athletics.json');
        const infoWA = await response.json();

        // 2. Buscamos al manager en el JSON usando su wa_id guardado
        const misDatos = infoWA.find(agente => agente.wa_id === perfil.wa_id);

        if (misDatos && misDatos.athletes) {
            renderizarCards(misDatos.athletes);
            actualizarUIUsuario(misDatos.name);
        } else {
            renderEstadoVacio("No se han encontrado atletas asociados a tu licencia.", false);
        }

    } catch (err) {
        console.error("Error cargando JSON:", err);
    }
}

function renderizarCards(atletas) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = '';
    
    atletas.forEach(atleta => {
        const pb = (atleta.personal_bests && atleta.personal_bests[0]) || { mark: '-', discipline: '-' };
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
            <i class="fas fa-user-lock" style="font-size: 3rem; color: #222; margin-bottom: 15px;"></i>
            <h3 style="margin-bottom: 10px;">Acceso Restringido</h3>
            <p style="color: #666; margin-bottom: 20px;">${mensaje}</p>
            ${conBoton ? '<a href="ajustes.html" class="btn-primary" style="text-decoration:none; display:inline-flex; margin: 0 auto;">Ir a Ajustes</a>' : ''}
        </div>
    `;
}

function actualizarUIUsuario(nombre) {
    document.querySelector('.user-name').innerText = nombre;
    document.querySelector('.user-role').innerText = "Manager Verificado";
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${nombre}&background=0070f3&color=fff`;
}

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
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = 'ajustes.html';
    };
}

document.addEventListener('DOMContentLoaded', init);