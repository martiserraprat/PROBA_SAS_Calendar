// --- CONFIGURACIÓN SUPABASE ---
const emailInput = document.getElementById('repre-email');
const saveBtn = document.getElementById('save-settings-btn');
const saveMsg = document.getElementById('save-message');

// Función para mostrar mensajes visuales
function mostrarNotificacion(texto, tipo) {
    saveMsg.style.display = 'block';
    saveMsg.innerHTML = texto;
    if (tipo === 'error') {
        saveMsg.style.background = 'rgba(255, 77, 77, 0.1)';
        saveMsg.style.color = '#ff4d4d';
        saveMsg.style.border = '1px solid #ff4d4d';
    } else {
        saveMsg.style.background = 'rgba(16, 185, 129, 0.1)';
        saveMsg.style.color = '#10b981';
        saveMsg.style.border = '1px solid #10b981';
    }
}

saveBtn.addEventListener('click', async () => {
    const emailBuscado = emailInput.value.trim().toLowerCase();
    
    if (!emailBuscado) {
        mostrarNotificacion('<i class="fas fa-exclamation-triangle"></i> Por favor, introduce un correo.', 'error');
        return;
    }

    // Bloquear botón y mostrar carga
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Comprobando...';

    try {
        // 1. Cargar el JSON (Ajusta la ruta si es necesario)
        const response = await fetch('datos_world_athletics.json');
        const agentes = await response.json();
        
        // 2. Buscar si el correo existe en el JSON
        const agenteEncontrado = agentes.find(a => a.email && a.email.toLowerCase() === emailBuscado);

        if (!agenteEncontrado) {
            mostrarNotificacion('<i class="fas fa-times-circle"></i> Este correo no figura como mánager oficial en nuestra base de datos.', 'error');
            resetBtn();
            return;
        }

        // 3. Si existe, guardar datos temporalmente para el Dashboard
        localStorage.setItem('wa_id_pendiente', agenteEncontrado.id);
        localStorage.setItem('nombreRepresentante', agenteEncontrado.name);

        // 4. Enviar Magic Link de Supabase
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: emailBuscado,
            options: {
                // Ruta a donde irá el manager al pulsar el link del email
                emailRedirectTo: 'https://martiserraprat.github.io/PROBA_SAS_Calendar/manager/dashboard.html'
            }
        });

        if (error) throw error;

        mostrarNotificacion('<i class="fas fa-check-circle"></i> ¡Correo encontrado! Hemos enviado un enlace de acceso a tu bandeja de entrada.', 'success');
        
    } catch (err) {
        console.error(err);
        mostrarNotificacion('<i class="fas fa-exclamation-triangle"></i> Error al procesar la solicitud.', 'error');
    } finally {
        resetBtn();
    }
});

function resetBtn() {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Verificar y Enviar Enlace';
}