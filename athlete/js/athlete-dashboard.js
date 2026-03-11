// ========================================
// athlete-dashboard.js - VERSIÓN SIN CACHÉ (Siempre actualizado)
// ========================================

async function cargarDatosAtleta() {
    const client = window.supabaseClient || window.supabase;

    if (!client) {
        console.error("No se encontró window.supabaseClient.");
        return;
    }

    const btnCargar = document.getElementById('btn-cargar-datos');
    const iconOriginal = btnCargar ? btnCargar.innerHTML : '';
    
    try {
        if(btnCargar) btnCargar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        console.log("☁️ Consultando a Supabase para el Dashboard (Datos en vivo)...");

        // 1. Obtener usuario actual
        const { data: { user }, error: authError } = await client.auth.getUser();
        
        if (authError || !user) {
            console.error("Error de sesión:", authError);
            return;
        }

        // 2. CONSULTA 1: Traer el FULL NAME
        const { data: profile } = await client
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        actualizarNombresUI(profile);

        // 3. CONSULTA 2: Traer datos deportivos
        const { data: atleta, error: dbError } = await client
            .from('atletas')
            .select('*')
            .eq('atleta_user_id', user.id)
            .single();

        // 4. CONSULTA 3: Traer próximas 3 competiciones confirmadas
        const hoy = new Date().toISOString().split('T')[0];
        const { data: competiciones } = await client
            .from('calendario_atletas')
            .select('titulo_personalizado, fecha_inicio, lugar')
            .eq('atleta_user_id', user.id)
            .eq('estado', 'confirmado')
            .gte('fecha_inicio', hoy)
            .order('fecha_inicio', { ascending: true })
            .limit(3);

        if (dbError || !atleta) {
            console.warn("No hay ficha técnica en la tabla 'atletas'.");
            mostrarEstadosVacios();
            return;
        }

        renderizarDashboard(atleta, competiciones || []);

    } catch (error) {
        console.error("Error crítico:", error);
    } finally {
        if(btnCargar) btnCargar.innerHTML = iconOriginal;
    }
}

// Función auxiliar
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

function renderizarDashboard(atleta, competiciones) {
    const paisEl = document.getElementById('stat-pais');
    if(paisEl) paisEl.textContent = atleta.codigo_pais || atleta.pais || 'N/D';
    
    let marcas = parsearDatos(atleta.marcas_personales);
    let recientes = parsearDatos(atleta.resultados_recientes);
    
    // 1. Tarjeta Mejor Marca
    if (marcas.length > 0) {
        marcas.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
        const laMejor = marcas[0];
        const mejorM = document.getElementById('stat-mejor-marca');
        const mejorP = document.getElementById('stat-mejor-marca-prueba');
        
        if(mejorM) mejorM.textContent = laMejor.marca || '-';
        if(mejorP) mejorP.textContent = laMejor.disciplina || '';
    }

    // 2. Tarjeta Competiciones Registradas
    const compEl = document.getElementById('stat-competiciones');
    if(compEl) compEl.textContent = recientes.length;

    // 🔥 3. NUEVO: Tarjeta Próxima Cita
    const proximaCitaEl = document.getElementById('stat-proxima-cita');
    // Buscamos la etiqueta que dice "días" que está justo debajo del número
    const proximaCitaLabel = proximaCitaEl ? proximaCitaEl.nextElementSibling : null;

    if (competiciones && competiciones.length > 0) {
        // Cogemos la primera competición (la más cercana)
        const fechaProxima = new Date(competiciones[0].fecha_inicio);
        fechaProxima.setHours(0,0,0,0); // Reseteamos la hora para que el cálculo sea exacto
        
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
        // Calculamos la diferencia en milisegundos y lo pasamos a días
        const diffTime = fechaProxima - hoy;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (proximaCitaEl && proximaCitaLabel) {
            proximaCitaEl.style.fontSize = "1.8rem"; // Reseteamos tamaño por si acaso
            
            if (diffDays === 0) {
                proximaCitaEl.textContent = "HOY";
                proximaCitaEl.style.fontSize = "1.4rem"; // Letra más pequeña para que quepa
                proximaCitaLabel.textContent = "¡A por todas!";
            } else if (diffDays === 1) {
                proximaCitaEl.textContent = "1";
                proximaCitaLabel.textContent = "día (Mañana)";
            } else if (diffDays > 1) {
                proximaCitaEl.textContent = diffDays;
                proximaCitaLabel.textContent = "días";
            } else {
                // Por si se quedó alguna en el pasado sin borrar
                proximaCitaEl.textContent = "-";
                proximaCitaLabel.textContent = "Sin planificar";
            }
        }
    } else {
        // Si no hay competiciones en el calendario
        if (proximaCitaEl) proximaCitaEl.textContent = "-";
        if (proximaCitaLabel) proximaCitaLabel.textContent = "Sin planificar";
    }

    // 4. Renderizar Listas Inferiores
    renderizarMarcasTop(marcas);
    renderizarResultados(recientes);
    renderizarProximasCompeticiones(competiciones);
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
    if(!contenedor) return;

    if (!eventos || eventos.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <i class="fas fa-calendar-times" style="font-size: 2.5rem; color: #333; margin-bottom: 10px;"></i>
                <p style="color: #888; font-size: 0.9rem;">No hay competiciones próximas confirmadas en tu calendario.</p>
                <a href="calendario.html" style="display: inline-block; margin-top: 15px; color: #00d1ff; text-decoration: none; font-size: 0.9rem;"><i class="fas fa-plus"></i> Añadir una</a>
            </div>`;
        return;
    }

    contenedor.innerHTML = eventos.map(ev => {
        const fechaObj = new Date(ev.fecha_inicio);
        const dia = fechaObj.getDate().toString().padStart(2, '0');
        const mes = fechaObj.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
        
        return `
        <div class="next-event-card" style="display: flex; gap: 15px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border-left: 4px solid #00d1ff; margin-bottom: 10px;">
            <div class="date-box" style="text-align: center; min-width: 50px;">
                <span style="display: block; font-size: 1.2rem; font-weight: bold; color: #fff;">${dia}</span>
                <span style="display: block; font-size: 0.8rem; color: #00d1ff;">${mes}</span>
            </div>
            <div class="info-box" style="display: flex; flex-direction: column; justify-content: center;">
                <h4 style="margin: 0 0 5px 0; color: #fff; font-size: 1rem;">${ev.titulo_personalizado}</h4>
                <p style="margin: 0; color: #888; font-size: 0.85rem;"><i class="fas fa-map-marker-alt"></i> ${ev.lugar || 'Lugar por determinar'}</p>
            </div>
        </div>
        `;
    }).join('');
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
    // 1. Cargar datos al iniciar la página
    setTimeout(() => cargarDatosAtleta(), 200);

    // --- Referencias a los elementos del DOM ---
    const btnCargar = document.getElementById('btn-cargar-datos');
    const menuCargar = document.getElementById('menu-cargar-datos');
    const btnManual = document.getElementById('btn-carga-manual');
    
    const btnNotis = document.getElementById('btn-notificaciones');
    const menuNotis = document.getElementById('noti-dropdown');

    // --- Lógica del botón "Cargar Datos" ---
    if (btnCargar && menuCargar) {
        btnCargar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            menuCargar.classList.toggle('show');
            
            // Si abrimos "Cargar", cerramos "Notificaciones" para que no se solapen
            if (menuNotis) menuNotis.classList.remove('show');
        });

        // Botón interno de "Carga Manual"
        if (btnManual) {
            btnManual.addEventListener('click', (e) => {
                e.preventDefault();
                menuCargar.classList.remove('show'); 
                cargarDatosAtleta(); // Vuelve a ejecutar la función limpia
            });
        }
    }

    // --- Lógica del botón "Notificaciones" ---
    if (btnNotis && menuNotis) {
        btnNotis.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            menuNotis.classList.toggle('show');
            
            // Si abrimos "Notificaciones", cerramos "Cargar"
            if (menuCargar) menuCargar.classList.remove('show');
        });
    }

    // --- Lógica global: Cerrar menús al hacer clic fuera ---
    document.addEventListener('click', (e) => {
        // Comprobar click fuera del menú de carga
        if (menuCargar && menuCargar.classList.contains('show')) {
            if (!menuCargar.contains(e.target) && !btnCargar.contains(e.target)) {
                menuCargar.classList.remove('show');
            }
        }
        
        // Comprobar click fuera del menú de notificaciones
        if (menuNotis && menuNotis.classList.contains('show')) {
            if (!menuNotis.contains(e.target) && !btnNotis.contains(e.target)) {
                menuNotis.classList.remove('show');
            }
        }
    });
});

