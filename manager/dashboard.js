const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'TU_ANON_KEY_AQUI'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function loadDashboard() {
    // 1. Comprobar si el usuario está logueado
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Si no hay usuario, fuera al login
        window.location.href = '../index.html';
        return;
    }

    // 2. Traer los atletas de este mánager
    const { data: atletas, error } = await supabase
        .from('atletas')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error("Error cargando atletas:", error);
        return;
    }

    renderAtletas(atletas);
}

function renderAtletas(lista) {
    const grid = document.getElementById('athlete-grid');
    grid.innerHTML = '';

    if (lista.length === 0) {
        grid.innerHTML = `<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 50px;">Aún no tienes atletas registrados.</p>`;
        return;
    }

    lista.forEach(atleta => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        card.innerHTML = `
            <div class="athlete-info-main">
                <div class="athlete-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="atleta-details">
                    <h3>${atleta.name}</h3>
                    <span class="atleta-spec">${atleta.discipline}</span>
                </div>
            </div>
            <div class="atleta-stats-mini">
                <div class="mini-stat">
                    <span class="label">PB</span>
                    <span class="val">${atleta.pb || '--'}</span>
                </div>
            </div>
            <button class="btn-view-profile">Ver Perfil</button>
        `;
        grid.appendChild(card);
    });
}

// Botón de cerrar sesión
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../index.html';
});

loadDashboard();