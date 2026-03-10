// ========================================
// athlete-dashboard.js - Optimizado con Caché (sessionStorage)
// ========================================

async function cargarDatosAtleta(forceRefresh = false) {
    const client = window.supabaseClient || window.supabase;

    if (!client) {
        console.error("No se encontró window.supabaseClient.");
        return;
    }

    const btnCargar = document.getElementById('btn-cargar-datos');
    const iconOriginal = btnCargar ? btnCargar.innerHTML : '';
    
    try {
        if(btnCargar && forceRefresh) btnCargar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // 1. INTENTAR LEER DE LA CACHÉ (Si no estamos forzando la recarga)
        if (!forceRefresh) {
            const cacheGuardada = sessionStorage.getItem('apex_dashboard_atleta');
            if (cacheGuardada) {
                console.log("⚡ Cargando Dashboard desde la caché local");
                const datosCacheados = JSON.parse(cacheGuardada);
                
                // Pintar datos cacheados
                actualizarNombresUI(datosCacheados.profile);
                if (datosCacheados.atleta) {
                    renderizarDashboard(datosCacheados.atleta);
                } else {
                    mostrarEstadosVacios();
                }
                return; // Cortamos aquí, ¡0 consultas a la base de datos!
            }
        }

        console.log("☁️ Consultando a Supabase para el Dashboard...");

        // 2. Obtener usuario actual
        const { data: { user }, error: authError } = await client.auth.getUser();
        
        if (authError || !user) {
            console.error("Error de sesión:", authError);
            return;
        }

        // 3. CONSULTA 1: Traer el FULL NAME
        const { data: profile, error: profileError } = await client
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        if (profileError) console.error("Error en profiles:", profileError);

        actualizarNombresUI(profile);

        // 4. CONSULTA 2: Traer datos deportivos
        const { data: atleta, error: dbError } = await client
            .from('atletas')
            .select('*')
            .eq('atleta_user_id', user.id)
            .single();

        // 5. GUARDAR EN CACHÉ PARA LA PRÓXIMA VEZ
        const datosParaGuardar = {
            profile: profile,
            atleta: atleta || null
        };
        sessionStorage.setItem('apex_dashboard_atleta', JSON.stringify(datosParaGuardar));

        if (dbError || !atleta) {
            console.warn("No hay ficha técnica en la tabla 'atletas'.");
            mostrarEstadosVacios();
            return;
        }

        renderizarDashboard(atleta);

    } catch (error) {
        console.error("Error crítico:", error);
    } finally {
        if(btnCargar && forceRefresh) btnCargar.innerHTML = iconOriginal;
    }
}

// Función auxiliar para no repetir código
function actualizarNombresUI(profile) {
    const nombreCompleto = profile?.full_name || "Atleta";
    const primerNombre = nombreCompleto.split(' ')[0];

    const headerName = document.getElementById('header-user-name');
    const sidebarName = document.getElementById('sidebar-user-name');
    if(headerName) headerName.textContent = primerNombre;
    if(sidebarName) sidebarName.textContent = nombreCompleto;
}

function parsearDatos(campo) {
    if (!campo) return [];
    if (typeof campo === 'string') {
        try { return JSON.parse(campo); } catch(e) { return []; }
    }
    return campo;
}

function renderizarDashboard(atleta) {
    const paisEl = document.getElementById('stat-pais');
    if(paisEl) paisEl.textContent = atleta.codigo_pais || atleta.pais || 'N/D';
    
    let marcas = parsearDatos(atleta.marcas_personales);
    let recientes = parsearDatos(atleta.resultados_recientes);
    
    if (marcas.length > 0) {
        marcas.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
        const laMejor = marcas[0];
        const mejorM = document.getElementById('stat-mejor-marca');
        const mejorP = document.getElementById('stat-mejor-marca-prueba');
        
        if(mejorM) mejorM.textContent = laMejor.marca || '-';
        if(mejorP) mejorP.textContent = laMejor.disciplina || '';
    }

    const compEl = document.getElementById('stat-competiciones');
    if(compEl) compEl.textContent = recientes.length;

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
    // Carga normal (intentará leer de la caché primero)
    setTimeout(() => cargarDatosAtleta(false), 200);

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
                
                // 🚨 MAGIA: Si el usuario le da a "Carga Manual", forzamos refresco saltando la caché
                cargarDatosAtleta(true);
            });
        }
    }
});