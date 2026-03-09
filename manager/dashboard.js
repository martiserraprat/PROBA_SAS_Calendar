const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let todosLosAtletas = [];
let filtroGeneroActual = 'all';
let filtroPruebaActual = 'all';
let validacionEnCurso = false; 

// --- 1. INICIALIZACIÓN ---
async function loadDashboard() {
    console.log("🚀 Iniciando panel...");
    mostrarCargando(true);
    
    try {
        // 🔥 IMPORTANTE: Obtener la sesión actual inmediatamente
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            console.log("✅ Sesión activa encontrada:", session.user.email);
            await ejecutarVerificacionPendiente(session.user);
        } else {
            console.log("🚫 No hay sesión activa.");
            renderEstadoVacio("No hay sesión activa. Por favor, inicia sesión.", true);
        }

        // Escuchar cambios de autenticación (para futuros eventos)
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("🔔 Evento de Auth detectado:", event);
            
            if (event === 'SIGNED_IN' && session) {
                console.log("✅ Nuevo inicio de sesión:", session.user.email);
                await ejecutarVerificacionPendiente(session.user);
            } else if (event === 'SIGNED_OUT') {
                renderEstadoVacio("Sesión cerrada.", true);
            }
        });
        
    } catch (error) {
        console.error("❌ Error en inicialización:", error);
        renderEstadoVacio("Error al conectar con el servidor.", false);
    }
}

// --- 2. MOSTRAR CARGANDO ---
function mostrarCargando(activo) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    
    if (activo) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #666;"><i class="fas fa-spinner fa-spin"></i> Cargando panel...</div>';
    }
}

// --- 3. VALIDACIÓN RPC (Si viene de Ajustes) ---
async function ejecutarVerificacionPendiente(user) {
    if (validacionEnCurso) {
        console.log("⏳ Validación ya en curso...");
        return;
    }

    const waId = localStorage.getItem('wa_id_pendiente');
    const nombre = localStorage.getItem('nombreRepresentante');

    if (waId && nombre) {
        validacionEnCurso = true; 
        const numeroWaId = parseInt(waId);
        
        console.log(`🛡️ Ejecutando RPC para verificar: ID ${numeroWaId} | Nombre: ${nombre}`);
        
        try {
            const { error } = await supabaseClient.rpc('verificar_manager', {
                id_wa_input: numeroWaId,
                nombre_input: nombre
            });

            if (error) throw error;

            console.log("🎉 PERFIL ACTUALIZADO EN BD. Recargando...");
            localStorage.removeItem('wa_id_pendiente');
            localStorage.removeItem('nombreRepresentante');
            
            setTimeout(() => { window.location.reload(); }, 500);

        } catch (err) {
            console.error("❌ ERROR EN LA VERIFICACIÓN:", err);
            renderEstadoVacio("Error al vincular tu cuenta: " + err.message, true);
            validacionEnCurso = false; 
        }
    } else {
        // Si no hay nada pendiente, cargamos los datos normalmente
        await cargarAtletasVerificados(user);
    }
}

// --- 4. COMPROBAR VERIFICACIÓN Y CARGAR ATLETAS (CON CACHÉ) ---
async function cargarAtletasVerificados(user) {
    try {
        console.log("📥 Iniciando carga de atletas...");
        mostrarCargando(true);
        
        // 🔥 PRIMERO: Verificar si ya tenemos los atletas en caché
        const atletasCache = sessionStorage.getItem('misAtletas');
        const managerNombre = sessionStorage.getItem('managerNombre');
        
        if (atletasCache && managerNombre) {
            console.log("📦 Usando datos desde caché (sessionStorage)");
            todosLosAtletas = JSON.parse(atletasCache);
            
            // Actualizar nombre en UI
            const nameEl = document.querySelector('.user-name');
            const roleEl = document.querySelector('.user-role');
            if (nameEl) nameEl.innerText = managerNombre;
            if (roleEl) roleEl.innerText = 'Manager Oficial';
            
            // Cargar disciplinas y renderizar
            await cargarDisciplinasYRenderizar();
            return;
        }
        
        // Si no hay caché, obtener datos de Supabase
        console.log("🔄 No hay caché, obteniendo datos de Supabase...");
        
        // 1. Miramos si el usuario está verificado en la BD
        const { data: perfil, error: perfilErr } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (perfilErr) {
            console.error("❌ Error leyendo tu perfil:", perfilErr);
            
            if (perfilErr.code === 'PGRST116') {
                renderEstadoVacio("Perfil no encontrado. Debes registrarte primero.", true);
            } else {
                renderEstadoVacio("Error de seguridad: No se pudo leer tu perfil en la base de datos.", false);
            }
            return;
        }

        console.log("👤 Datos obtenidos del perfil:", perfil);

        // 2. Si NO está verificado
        if (!perfil || perfil.is_verified !== true) {
            console.log("⚠️ Usuario NO verificado.");
            renderEstadoVacio("Tu perfil no está verificado. Ve a Ajustes para vincular tu cuenta oficial.", true);
            return;
        }

        console.log("✅ Usuario VERIFICADO. Buscando atletas para:", perfil.full_name);

        // 3. Guardar nombre en caché
        sessionStorage.setItem('managerNombre', perfil.full_name);
        
        // Actualizamos su nombre en la interfaz
        const nameEl = document.querySelector('.user-name');
        const roleEl = document.querySelector('.user-role');
        if (nameEl && perfil.full_name) nameEl.innerText = perfil.full_name;
        if (roleEl) roleEl.innerText = 'Manager Oficial';

        // 4. Buscamos a sus atletas en el JSON
        const response = await fetch('./datos_world_athletics.json');
        if (!response.ok) {
            throw new Error("No se encontró el archivo JSON.");
        }
        
        const agentes = await response.json();
        console.log(`📊 Total de agentes en JSON: ${agentes.length}`);
        
        // Limpiamos espacios y mayúsculas
        const nombreManagerBD = perfil.full_name.trim().toLowerCase();
        
        // Buscar TODAS las coincidencias (por si hay duplicados)
        const agentesEncontrados = agentes.filter(ag => {
            const nombreAgenteJSON = ag.name.trim().toLowerCase();
            return nombreAgenteJSON === nombreManagerBD;
        });

        if (agentesEncontrados.length > 0) {
            // Combinar atletas de todas las entradas del manager
            let todosAtletasCombinados = [];
            
            agentesEncontrados.forEach(agente => {
                if (agente.athletes && agente.athletes.length > 0) {
                    todosAtletasCombinados = [...todosAtletasCombinados, ...agente.athletes];
                }
            });
            
            console.log(`🏅 Se encontraron ${agentesEncontrados.length} entradas con ${todosAtletasCombinados.length} atletas en total.`);
            
            // Guardar en variable global
            todosLosAtletas = todosAtletasCombinados.map(a => {
                // Asegurar que todos los atletas tengan personal_bests como array
                if (!a.personal_bests) a.personal_bests = [];
                return a;
            });

            // Guardar en caché (sessionStorage)
            sessionStorage.setItem('misAtletas', JSON.stringify(todosLosAtletas));
            
            // Cargar disciplinas y renderizar
            await cargarDisciplinasYRenderizar();
            
        } else {
            console.log("⚠️ Nombre verificado, pero no se encontró en el JSON.");
            renderEstadoVacio("Eres mánager verificado, pero no tienes atletas registrados en nuestra base de datos.", false);
        }

    } catch (error) {
        console.error("❌ Error cargando atletas:", error);
        renderEstadoVacio("Hubo un error al cargar la lista de atletas: " + error.message, false);
    } finally {
        mostrarCargando(false);
    }
}

// --- NUEVA FUNCIÓN: Cargar disciplinas y renderizar ---
async function cargarDisciplinasYRenderizar() {
    if (!todosLosAtletas || todosLosAtletas.length === 0) return;
    
    // Ordenar atletas alfabéticamente
    todosLosAtletas.sort((a, b) => a.name.localeCompare(b.name));
    
    // Recopilar todas las disciplinas
    let todasLasDisciplinas = new Set();
    todosLosAtletas.forEach(atleta => {
        if (atleta.personal_bests && Array.isArray(atleta.personal_bests)) {
            atleta.personal_bests.forEach(pb => {
                if (pb.discipline) todasLasDisciplinas.add(pb.discipline);
            });
        }
    });

    // Rellenar los filtros de pruebas
    const selectPruebas = document.getElementById('discipline-filter');
    if (selectPruebas) {
        selectPruebas.innerHTML = '<option value="all">Todas las pruebas</option>';
        Array.from(todasLasDisciplinas).sort().forEach(disc => {
            const option = document.createElement('option');
            option.value = disc;
            option.textContent = disc;
            selectPruebas.appendChild(option);
        });
    }

    // Dibujar las tarjetas
    renderAtletas(todosLosAtletas);
    activarFiltros();
}

// --- 5. RENDERIZADO Y UI ---
function renderEstadoVacio(mensaje, mostrarBoton) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #0f0f0f; border: 1px dashed #333; border-radius: 15px;">
            <i class="fas fa-user-shield" style="font-size: 3rem; color: #444; margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin-bottom: 5px;">Panel de Atletas</h3>
            <p style="color: #888; margin-bottom: 20px;">${mensaje}</p>
            ${mostrarBoton ? `<a href="ajustes.html" class="btn-primary" style="display:inline-block; text-decoration:none;">Ir a Ajustes</a>` : ''}
        </div>
    `;
    
    const count = document.getElementById('stat-count');
    if (count) count.innerText = "0";
    
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    if (nameEl) nameEl.innerText = 'Invitado';
    if (roleEl) roleEl.innerText = 'No autenticado';
}

function renderAtletas(lista) {
    const grid = document.getElementById('athlete-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const count = document.getElementById('stat-count');
    if (count) count.innerText = lista.length;

    if (lista.length === 0) {
        grid.innerHTML = `<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 50px;">No se encontraron atletas con estos filtros.</p>`;
        return;
    }

    lista.forEach(atleta => {
        const isMan = atleta.gender === "Man";
        const card = document.createElement('div');
        card.className = `athlete-card ${isMan ? "card-man" : "card-woman"}`;
        
        // Tarjeta simple: solo nombre y país
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <div class="gender-badge"><i class="fas ${isMan ? 'fa-mars' : 'fa-venus'}"></i> ${isMan ? 'Hombre' : 'Mujer'}</div>
                <span style="color: #888; font-size: 0.75rem;"><i class="fas fa-map-marker-alt"></i> ${atleta.country || 'N/A'}</span>
            </div>
            <h3 class="athlete-name" style="margin-bottom: 5px; font-size: 1.2rem; cursor: pointer;" 
                onclick='abrirModal(${JSON.stringify(atleta).replace(/'/g, "\\'")})'>
                ${atleta.name}
            </h3>
            <div style="margin-top: 15px; display: flex; gap: 8px;">
                <span style="color: #666; font-size: 0.7rem;"><i class="fas fa-calendar-alt"></i> ${atleta.birthdate || '?'}</span>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// --- 6. FILTROS ---
function aplicarFiltros() {
    let filtrados = todosLosAtletas;
    if (filtroGeneroActual !== 'all') filtrados = filtrados.filter(a => a.gender === filtroGeneroActual);
    if (filtroPruebaActual !== 'all') {
        filtrados = filtrados.filter(a => a.personal_bests && a.personal_bests.some(pb => pb.discipline === filtroPruebaActual));
    }
    renderAtletas(filtrados);
}

function activarFiltros() {
    const pills = document.querySelectorAll('#gender-filters .pill');
    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            filtroGeneroActual = e.target.getAttribute('data-gender'); 
            aplicarFiltros();
        });
    });

    const selectPruebas = document.getElementById('discipline-filter');
    if (selectPruebas) {
        selectPruebas.addEventListener('change', (e) => {
            filtroPruebaActual = e.target.value;
            aplicarFiltros();
        });
    }
}

// --- 7. EVENTOS DE INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();

    // Menú móvil
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Botón Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("Cerrando sesión...");
            await supabaseClient.auth.signOut();
            localStorage.clear();
            window.location.href = '../index.html'; 
        });
    }
});

// --- FUNCIONES PARA EL MODAL ---
function abrirModal(atleta) {
    const modal = document.getElementById('athleteModal');
    const modalName = document.getElementById('modalAthleteName');
    const modalContent = document.getElementById('modalContent');
    
    // Determinar género para estilos
    const isMan = atleta.gender === "Man";
    const genderClass = isMan ? "man" : "woman";
    const genderIcon = isMan ? "fa-mars" : "fa-venus";
    const genderText = isMan ? "Hombre" : "Mujer";
    
    // Formatear fecha de nacimiento
    const birthdate = atleta.birthdate || 'No disponible';
    
    // Construir HTML de información personal
    let infoPersonalHTML = `
        <div class="athlete-info-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin:0; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-id-card"></i> Información Personal
                </h3>
                <span class="modal-gender-badge ${genderClass}">
                    <i class="fas ${genderIcon}"></i> ${genderText}
                </span>
            </div>
            <div class="athlete-info-grid">
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-globe"></i> PAÍS</span>
                    <span class="info-value">${atleta.country || 'No especificado'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-calendar-alt"></i> FECHA NAC.</span>
                    <span class="info-value">${birthdate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-star"></i> EDAD</span>
                    <span class="info-value">${calcularEdad(atleta.birthdate)} años</span>
                </div>
            </div>
        </div>
    `;
    
    // Construir HTML de marcas personales
    let pbHTML = `
        <div class="pb-section">
            <h3><i class="fas fa-trophy"></i> Marcas Personales (${atleta.personal_bests?.length || 0})</h3>
            <div class="pb-grid">
    `;
    
    if (atleta.personal_bests && atleta.personal_bests.length > 0) {
        // Ordenar disciplinas alfabéticamente
        const sortedPB = [...atleta.personal_bests].sort((a, b) => 
            a.discipline.localeCompare(b.discipline)
        );
        
        sortedPB.forEach(pb => {
            pbHTML += `
                <div class="pb-card">
                    <div class="pb-discipline">
                        ${pb.discipline}
                        <i class="fas fa-running"></i>
                    </div>
                    <div class="pb-mark">${pb.mark}</div>
                    <div class="pb-venue">
                        <i class="fas fa-map-marker-alt"></i> ${pb.venue || 'Lugar no especificado'}
                    </div>
                    <div class="pb-date">
                        <i class="fas fa-clock"></i> ${pb.date || 'Fecha no disponible'}
                    </div>
                </div>
            `;
        });
    } else {
        pbHTML += `<p style="color: #666; grid-column: 1/-1; text-align: center;">No hay marcas personales registradas</p>`;
    }
    
    pbHTML += `
            </div>
            <a href="${atleta.url}" target="_blank" class="modal-wa-btn">
                <i class="fas fa-external-link-alt"></i> Ver perfil completo en World Athletics
            </a>
        </div>
    `;
    
    // Combinar todo
    modalContent.innerHTML = infoPersonalHTML + pbHTML;
    modalName.textContent = atleta.name;
    
    // Mostrar modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevenir scroll del body
}

function cerrarModal() {
    const modal = document.getElementById('athleteModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restaurar scroll
}

// Función para calcular edad
function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return '?';
    
    try {
        // Formato esperado: "07 JUL 1996"
        const partes = fechaNacimiento.split(' ');
        if (partes.length !== 3) return '?';
        
        const meses = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };
        
        const dia = parseInt(partes[0]);
        const mes = meses[partes[1]];
        const año = parseInt(partes[2]);
        
        if (isNaN(dia) || mes === undefined || isNaN(año)) return '?';
        
        const nacimiento = new Date(año, mes, dia);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    } catch (e) {
        return '?';
    }
}

// Cerrar modal con tecla ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cerrarModal();
    }
});

// Cerrar modal al hacer clic fuera
document.getElementById('athleteModal').addEventListener('click', function(e) {
    if (e.target === this) {
        cerrarModal();
    }
});

// --- FUNCIÓN PARA FORZAR RECARGA DE DATOS ---
async function recargarDatos() {
    // Limpiar caché
    sessionStorage.removeItem('misAtletas');
    sessionStorage.removeItem('managerNombre');
    
    // Recargar página
    window.location.reload();
}

// Puedes añadir un botón en algún lado para esto si quieres