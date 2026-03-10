// ========================================
// athlete-dashboard.js - Datos To Guapo Fino
// ========================================

async function cargarDatosAtleta() {
    const client = window.supabaseClient;

    if (!client) {
        console.error("No se encontró window.supabaseClient.");
        return;
    }

    const btnCargar = document.getElementById('btn-cargar-datos');
    const iconOriginal = btnCargar ? btnCargar.innerHTML : '';
    
    try {
        if(btnCargar) btnCargar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';

        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError || !user) return;

        // Nombre de usuario desde profiles
        const { data: profile } = await client.from('profiles').select('full_name').eq('id', user.id).single();
        const nombreCompleto = profile?.full_name || "Atleta";
        const primerNombre = nombreCompleto.split(' ')[0];

        if(document.getElementById('header-user-name')) document.getElementById('header-user-name').textContent = primerNombre;
        if(document.getElementById('sidebar-user-name')) document.getElementById('sidebar-user-name').textContent = nombreCompleto;

        // Datos deportivos
        const { data: atleta, error: dbError } = await client.from('atletas').select('*').eq('atleta_user_id', user.id).single();

        if (dbError || !atleta) {
            mostrarEstadosVacios();
            return;
        }

        renderizarDashboard(atleta);

    } catch (error) {
        console.error("Error crítico:", error);
    } finally {
        if(btnCargar) btnCargar.innerHTML = iconOriginal;
    }
}

// Función segura para leer el JSONB (por si viene como string o como objeto)
function parsearDatos(campo) {
    if (!campo) return [];
    if (typeof campo === 'string') {
        try { return JSON.parse(campo); } catch(e) { return []; }
    }
    return campo;
}

function renderizarDashboard(atleta) {
    // 1. País
    const paisEl = document.getElementById('stat-pais');
    if(paisEl) paisEl.textContent = atleta.codigo_pais || atleta.pais || 'N/D';
    
    // 2. Extraer arrays
    let marcas = parsearDatos(atleta.marcas_personales);
    let recientes = parsearDatos(atleta.resultados_recientes);
    
    // 3. ENCONTRAR LA MEJOR MARCA ABSOLUTA (Por puntuación WA)
    if (marcas.length > 0) {
        // Ordenamos de mayor a menor puntuación WA
        marcas.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
        
        const laMejor = marcas[0];
        const mejorM = document.getElementById('stat-mejor-marca');
        const mejorP = document.getElementById('stat-mejor-marca-prueba');
        
        if(mejorM) mejorM.textContent = laMejor.marca || '-';
        if(mejorP) mejorP.textContent = laMejor.disciplina || '';
    }

    // 4. Conteo de competiciones (usamos resultados recientes)
    const compEl = document.getElementById('stat-competiciones');
    if(compEl) compEl.textContent = recientes.length;

    // Renderizados de tablas
    renderizarMarcasTop(marcas);
    renderizarResultados(recientes);
    renderizarProximasCompeticiones([]); 
}

function renderizarMarcasTop(marcasOrdenadas) {
    const contenedor = document.getElementById('lista-marcas-personales');
    if (!contenedor) return;
    
    if (!marcasOrdenadas || marcasOrdenadas.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg" style="padding: 15px; color: #888;">No hay marcas personales guardadas.</p>';
        return;
    }

    // Cogemos solo el Top 3 de sus mejores marcas por puntos WA
    contenedor.innerHTML = marcasOrdenadas.slice(0, 3).map(m => `
        <div class="pb-item" style="display: flex; flex-direction: column; gap: 4px;">
            <div class="pb-discipline" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="discipline" style="font-weight: 600; font-size: 1rem; color: #fff;">${m.disciplina}</span>
                <span class="pb-value" style="font-weight: 800; font-size: 1.2rem; color: var(--accent-athlete, #00d1ff);">${m.marca}</span>
            </div>
            <div class="pb-details" style="font-size: 0.8rem; color: #888; display: flex; gap: 15px;">
                <span><i class="fas fa-calendar" style="margin-right: 4px;"></i> ${m.fecha}</span>
                <span title="Puntos World Athletics"><i class="fas fa-star" style="margin-right: 4px;"></i> ${m.puntuacion || 0} pts</span>
            </div>
        </div>
    `).join('');
}

function renderizarResultados(resultados) {
    const contenedor = document.getElementById('lista-resultados-recientes');
    if (!contenedor) return;

    if (!resultados || resultados.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg" style="grid-column: 1/-1; padding: 15px; color: #888;">No hay resultados recientes guardados.</p>';
        return;
    }

    // Mostrar los últimos 4 resultados
    contenedor.innerHTML = resultados.slice(0, 4).map(r => {
        let puestoNum = parseInt(r.puesto) || 0;
        let iconClass = '';
        let iconHtml = '<i class="fas fa-running"></i>'; 
        
        if (puestoNum === 1) { iconClass = 'gold'; iconHtml = '<i class="fas fa-medal"></i>'; }
        else if (puestoNum === 2) { iconClass = 'silver'; iconHtml = '<i class="fas fa-medal"></i>'; }
        else if (puestoNum === 3) { iconClass = 'bronze'; iconHtml = '<i class="fas fa-medal"></i>'; }

        let puestoTexto = puestoNum > 0 ? `${puestoNum}º puesto` : 'Sin marca';

        return `
            <div class="highlight-card">
                <div class="highlight-icon ${iconClass}">
                    ${iconHtml}
                </div>
                <div class="highlight-info">
                    <h4 title="${r.competicion || r.lugar}">${r.competicion || r.lugar}</h4>
                    <p><strong>${r.marca}</strong> · ${puestoTexto} · ${r.disciplina}</p>
                    <span class="highlight-date"><i class="fas fa-clock"></i> ${r.fecha}</span>
                </div>
            </div>
        `;
    }).join('');
}
function renderizarProximasCompeticiones(eventos) {
    const contenedor = document.getElementById('lista-proximas-competiciones');
    if(contenedor) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <i class="fas fa-calendar-times" style="font-size: 2.5rem; color: #333; margin-bottom: 10px;"></i>
                <p style="color: #888; font-size: 0.9rem;">No hay competiciones próximas en tu calendario.</p>
            </div>`;
    }
}

function mostrarEstadosVacios() {
    ['lista-marcas-personales', 'lista-resultados-recientes', 'lista-proximas-competiciones'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '<p class="empty-msg" style="padding: 15px; color: #888;">Aún no hay datos disponibles.</p>';
    });
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(cargarDatosAtleta, 200);

    const btnCargar = document.getElementById('btn-cargar-datos');
    const menuCargar = document.getElementById('menu-cargar-datos');

    if (btnCargar && menuCargar) {
        btnCargar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            menuCargar.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!menuCargar.contains(e.target) && !btnCargar.contains(e.target)) {
                menuCargar.classList.remove('show');
            }
        });

        const btnManual = document.getElementById('btn-carga-manual');
        if (btnManual) {
            btnManual.addEventListener('click', (e) => {
                e.preventDefault();
                menuCargar.classList.remove('show'); 
            });
        }
    }
});