const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function loadDashboard() {
    // 1. Comprobar si el usuario está logueado
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Si no hay usuario, fuera al login
        window.location.href = '../index.html';
        return;
    }

    // --- ¡NUEVO! 2. Actualizar el perfil del usuario en la barra lateral ---
    const userName = user.user_metadata?.full_name || 'Mánager';
    const userRole = user.user_metadata?.role === 'manager' ? 'Representante' : 'Atleta';
    
    // Cambiamos el nombre y el rol en el HTML
    document.querySelector('.user-name').innerText = userName;
    document.querySelector('.user-role').innerText = userRole;

    // (Opcional) Cambiar la imagen del avatar con la inicial del nombre
    const avatarImg = document.querySelector('.user-pill img');
    if (avatarImg) {
        // Generamos un avatar bonito con la primera letra del nombre
        const initials = userName.charAt(0).toUpperCase();
        avatarImg.src = `https://ui-avatars.com/api/?name=${initials}&background=0070f3&color=fff`;
    }
    // ----------------------------------------------------------------------

    // 3. Traer los atletas de este mánager (de tu tabla "atletas")
    // OJO: Esta parte fallará si aún no has creado la tabla "atletas" en Supabase
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