const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Elementos del DOM
const emailInput = document.getElementById('repre-email');
const saveBtn = document.getElementById('save-settings-btn');
const saveMsg = document.getElementById('save-message');

// Función mejorada para mostrar notificaciones
function mostrarNotificacion(texto, tipo) {
    saveMsg.style.display = 'block';
    saveMsg.className = tipo; // 'success' o 'error'
    saveMsg.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${texto}`;
    
    // Scroll suave hasta el mensaje
    saveMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Validación de email mejorada
function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

saveBtn.addEventListener('click', async () => {
    const emailBuscado = emailInput.value.trim().toLowerCase();
    
    // Validaciones
    if (!emailBuscado) {
        mostrarNotificacion('Por favor, introduce un correo electrónico.', 'error');
        emailInput.focus();
        return;
    }

    if (!validarEmail(emailBuscado)) {
        mostrarNotificacion('Por favor, introduce un correo electrónico válido.', 'error');
        emailInput.focus();
        return;
    }

    // Bloquear botón y mostrar carga
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    try {
        // 1. Cargar el JSON con manejo de errores
        const response = await fetch('datos_world_athletics.json');
        
        if (!response.ok) {
            throw new Error('No se pudo cargar la base de datos de managers');
        }
        
        const agentes = await response.json();
        
        // 2. Buscar si el correo existe en el JSON
        const agenteEncontrado = agentes.find(a => 
            a.email && a.email.toLowerCase() === emailBuscado
        );

        if (!agenteEncontrado) {
            mostrarNotificacion('Este correo no está registrado como manager oficial en nuestra base de datos.', 'error');
            resetBtn();
            return;
        }

        // 3. Guardar datos temporalmente para el Dashboard
        localStorage.setItem('wa_id_pendiente', agenteEncontrado.id);
        localStorage.setItem('nombreRepresentante', agenteEncontrado.name);
        
        // Guardar también para saber que venimos de ajustes
        sessionStorage.setItem('paginaAnterior', 'ajustes');

        // 4. Enviar Magic Link de Supabase
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: emailBuscado,
            options: {
                emailRedirectTo: 'https://martiserraprat.github.io/PROBA_SAS_Calendar/manager/dashboard.html'
            }
        });

        if (error) throw error;

        // 5. Mostrar éxito y limpiar campo
        mostrarNotificacion(
            `✅ ¡Correo verificado! Hemos enviado un enlace de acceso a <strong>${emailBuscado}</strong>. Revisa tu bandeja de entrada.`, 
            'success'
        );
        emailInput.value = '';
        
    } catch (err) {
        console.error('Error detallado:', err);
        mostrarNotificacion('Error al procesar la solicitud. Por favor, inténtalo de nuevo.', 'error');
    } finally {
        resetBtn();
    }
});

function resetBtn() {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Verificar y Enviar Enlace';
}

// Permitir enviar con Enter
emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
    }
});

// Logout mejorado
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            // Cambiar icono a loading
            const originalHTML = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            logoutBtn.style.pointerEvents = 'none';
            
            // 1. Cerramos la sesión oficial en Supabase
            await supabaseClient.auth.signOut();
            
            // 2. Limpiamos cualquier dato guardado
            localStorage.clear();
            sessionStorage.clear();
            
            // 3. Redirigimos
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            // Forzar redirección incluso si hay error
            window.location.href = '../index.html';
        }
    });
}

// Verificar sesión actual al cargar la página
async function checkCurrentSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            // Si hay sesión activa, mostrar info del usuario
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('full_name')
                .eq('id', session.user.id)
                .single();
            
            if (profile) {
                // Actualizar nombre en el sidebar si existe
                const userNameEl = document.querySelector('.user-name');
                const userRoleEl = document.querySelector('.user-role');
                if (userNameEl) userNameEl.textContent = profile.full_name || 'Usuario';
                if (userRoleEl) userRoleEl.textContent = 'Sesión Activa';
            }
        }
    } catch (error) {
        console.log('No hay sesión activa');
    }
}

// ========================================
// FUNCIONALIDAD DEL MENÚ MÓVIL (HAMBURGUESA)
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && overlay) {
        console.log("✅ Menú móvil inicializado");
        
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            
            // Cambiar icono (opcional)
            const icon = menuToggle.querySelector('i');
            if (icon) {
                if (sidebar.classList.contains('active')) {
                    icon.className = 'fas fa-times';
                } else {
                    icon.className = 'fas fa-bars';
                }
            }
        });

        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            
            // Restaurar icono
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-bars';
            }
        });

        // Cerrar menú al hacer click en un enlace (opcional)
        const navLinks = sidebar.querySelectorAll('.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                    const icon = menuToggle.querySelector('i');
                    if (icon) icon.className = 'fas fa-bars';
                }
            });
        });

        // Cerrar con tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });
    } else {
        console.warn("⚠️ No se encontraron elementos del menú móvil");
    }
});

// Ejecutar al cargar
checkCurrentSession();