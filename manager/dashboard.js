const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Lógica de Interfaz ---
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function toggleMenu() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
if (overlay) overlay.addEventListener('click', toggleMenu);

// --- Lógica de Datos ---
async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Actualizar Perfil
    const userName = user.user_metadata?.full_name || 'Mánager';
    const userRole = user.user_metadata?.role === 'manager' ? 'Representante' : 'Atleta';
    
    document.querySelector('.user-name').innerText = userName;
    document.querySelector('.user-role').innerText = userRole;
    
    const initials = userName.charAt(0).toUpperCase();
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${initials}&background=0070f3&color=fff`;

    // Cargar Atletas
    const { data: atletas, error } = await supabase
        .from('atletas')
        .select('*')
        .order('name', { ascending: true });

    if (!error) {
        renderAtletas(atletas);
        document.getElementById('stat-count').innerText = atletas.length;
    }
}

function renderAtletas(lista) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = '';

    if (lista.length === 0) {
        grid.innerHTML = `<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 50px;">No hay atletas registrados.</p>`;
        return;
    }

    lista.forEach(atleta => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 45px; height: 45px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-user" style="color: #444;"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 1rem;">${atleta.name}</h3>
                    <span style="color: #0070f3; font-size: 0.8rem; font-weight: 600;">${atleta.discipline}</span>
                </div>
            </div>
            <div style="border-top: 1px solid #1a1a1a; padding-top: 15px; margin-bottom: 15px; display: flex; gap: 20px;">
                <div>
                    <span style="display: block; font-size: 0.65rem; color: #666; text-transform: uppercase;">PB</span>
                    <span style="font-weight: 700;">${atleta.pb || '--'}</span>
                </div>
            </div>
            <button class="btn-primary" style="width: 100%; font-size: 0.8rem; padding: 8px;">Ver Perfil</button>
        `;
        grid.appendChild(card);
    });
}

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../index.html';
});

loadDashboard();