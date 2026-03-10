// ========================================
// athlete-dashboard.js - Ajustado a window.supabaseClient
// ========================================

async function cargarDatosAtleta() {
    // 1. Usar el nombre exacto que definiste en auth-guard.js
    const client = window.supabaseClient;

    if (!client) {
        console.error("No se encontró window.supabaseClient. Asegúrate de que auth-guard.js cargue primero.");
        return;
    }

    const btnCargar = document.getElementById('btn-cargar-datos');
    const iconOriginal = btnCargar ? btnCargar.innerHTML : '';
    
    try {
        if(btnCargar) btnCargar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // 2. Obtener usuario actual
        const { data: { user }, error: authError } = await client.auth.getUser();
        
        if (authError || !user) {
            console.error("Error de sesión:", authError);
            return;
        }

        // 3. CONSULTA 1: Traer el FULL NAME de la tabla PROFILES
        const { data: profile, error: profileError } = await client
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        if (profileError) console.error("Error en profiles:", profileError);

        // Extraer nombres (Prioridad al nombre de profiles)
        const nombreCompleto = profile?.full_name || "Atleta";
        const primerNombre = nombreCompleto.split(' ')[0];

        // Inyectar en HTML
        const headerName = document.getElementById('header-user-name');
        const sidebarName = document.getElementById('sidebar-user-name');
        if(headerName) headerName.textContent = primerNombre;
        if(sidebarName) sidebarName.textContent = nombreCompleto;

        // 4. CONSULTA 2: Traer datos deportivos de ATLETAS
        const { data: atleta, error: dbError } = await client
            .from('atletas')
            .select('*')
            .eq('atleta_user_id', user.id)
            .single();

        if (dbError || !atleta) {
            console.warn("No hay ficha técnica en la tabla 'atletas' para este ID.");
            mostrarEstadosVacios();
            return;
        }

        // Si existe el atleta, llenamos el resto del dashboard
        renderizarDashboard(atleta);

    } catch (error) {
        console.error("Error crítico:", error);
    } finally {
        if(btnCargar) btnCargar.innerHTML = iconOriginal;
    }
}

function renderizarDashboard(atleta) {
    // País
    const paisEl = document.getElementById('stat-pais');
    if(paisEl) paisEl.textContent = atleta.codigo_pais || atleta.pais || 'N/D';
    
    // Parsear Marcas (JSONB)
    let marcas = [];
    try { 
        marcas = typeof atleta.marcas_personales === 'string' 
            ? JSON.parse(atleta.marcas_personales) 
            : (atleta.marcas_personales || []); 
    } catch(e) { console.error("Error parseando marcas"); }
    
    if (marcas.length > 0) {
        const mejorM = document.getElementById('stat-mejor-marca');
        const mejorP = document.getElementById('stat-mejor-marca-prueba');
        if(mejorM) mejorM.textContent = marcas[0].mark || marcas[0].marca || '-';
        if(mejorP) mejorP.textContent = marcas[0].discipline || marcas[0].prueba || '';
    }

    // Resultados (JSONB)
    let resultados = [];
    try { 
        resultados = typeof atleta.resultados_recientes === 'string' 
            ? JSON.parse(atleta.resultados_recientes) 
            : (atleta.resultados_recientes || []); 
    } catch(e) { }
    
    const compEl = document.getElementById('stat-competiciones');
    if(compEl) compEl.textContent = resultados.length;

    renderizarMarcas(marcas);
    renderizarResultados(resultados);
    renderizarProximasCompeticiones([]); 
}

function renderizarMarcas(marcas) {
    const contenedor = document.getElementById('lista-marcas-personales');
    if (!contenedor) return;
    
    if (!marcas || marcas.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg">Sin marcas registradas.</p>';
        return;
    }

    contenedor.innerHTML = marcas.slice(0, 3).map(m => `
        <div class="pb-item">
            <div class="pb-discipline">
                <span class="discipline">${m.discipline || m.prueba || 'Prueba'}</span>
                <span class="pb-value">${m.mark || m.marca || '-'}</span>
            </div>
            <div class="pb-details">
                <span><i class="fas fa-calendar"></i> ${m.date || m.fecha || ''}</span>
            </div>
        </div>
    `).join('');
}

function renderizarResultados(resultados) {
    const contenedor = document.getElementById('lista-resultados-recientes');
    if (!contenedor) return;

    if (!resultados || resultados.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg" style="grid-column: 1/-1;">Sin resultados recientes.</p>';
        return;
    }

    contenedor.innerHTML = resultados.slice(0, 3).map(r => {
        let iconClass = r.place == "1" || r.place == "1." ? "" : (r.place == "2" || r.place == "2." ? "silver" : "bronze");
        return `
            <div class="highlight-card">
                <div class="highlight-icon ${iconClass}">
                    <i class="fas fa-medal"></i>
                </div>
                <div class="highlight-info">
                    <h4>${r.competition || r.evento || 'Competición'}</h4>
                    <p>${r.place || '-'} · ${r.discipline || ''}</p>
                    <span class="highlight-date">${r.date || ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarProximasCompeticiones(eventos) {
    const contenedor = document.getElementById('lista-proximas-competiciones');
    if(contenedor) {
        contenedor.innerHTML = '<p class="empty-msg">No hay competiciones próximas.</p>';
    }
}

function mostrarEstadosVacios() {
    const ids = ['lista-marcas-personales', 'lista-resultados-recientes', 'lista-proximas-competiciones'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '<p class="empty-msg">Aún no hay datos disponibles.</p>';
    });
}

// Iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Un pequeño respiro para que window.supabaseClient exista
    setTimeout(cargarDatosAtleta, 200);

    const btn = document.getElementById('btn-cargar-datos');
    if(btn) btn.addEventListener('click', cargarDatosAtleta);
});