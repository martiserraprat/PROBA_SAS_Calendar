// --- NUEVA LÓGICA DE VERIFICACIÓN Y CÓDIGOS ---

const sectionVerificacion = document.getElementById('section-verificacion');
const sectionCodigo = document.getElementById('section-codigo');
const currentCodeEl = document.getElementById('current-code');
const btnGenerateCode = document.getElementById('btn-generate-code');
const btnCopyCode = document.getElementById('btn-copy-code');
const codeMessage = document.getElementById('code-message');

function mostrarMsgCodigo(texto, tipo) {
    codeMessage.style.display = 'block';
    codeMessage.style.backgroundColor = tipo === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
    codeMessage.style.color = tipo === 'success' ? '#10b981' : '#ef4444';
    codeMessage.style.border = `1px solid ${tipo === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`;
    codeMessage.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${texto}`;
    setTimeout(() => { codeMessage.style.display = 'none'; }, 4000);
}

// Verificar sesión actual y estado de verificación
async function checkCurrentSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            // Traer el perfil completo
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('full_name, is_verified, id')
                .eq('id', session.user.id)
                .single();
            
            if (profile) {
                // Actualizar Sidebar
                const userNameEl = document.querySelector('.user-name');
                const userRoleEl = document.querySelector('.user-role');
                if (userNameEl) userNameEl.textContent = profile.full_name || 'Usuario';
                if (userRoleEl) userRoleEl.textContent = profile.is_verified ? 'Manager Oficial' : 'Pendiente';

                // Mostrar una sección u otra
                if (profile.is_verified) {
                    sectionVerificacion.style.display = 'none';
                    sectionCodigo.style.display = 'block';
                    await cargarCodigoActivo(profile.id);
                } else {
                    sectionVerificacion.style.display = 'block';
                    sectionCodigo.style.display = 'none';
                }
            }
        } else {
            // Sin sesión -> por seguridad, redirigir al login
            window.location.href = '../index.html';
        }
    } catch (error) {
        console.log('Error comprobando sesión:', error);
    }
}

async function cargarCodigoActivo(managerId) {
    try {
        const { data, error } = await supabaseClient
            .from('codigos_vinculacion')
            .select('codigo')
            .eq('manager_id', managerId)
            //.eq('usado', false)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            currentCodeEl.innerText = data[0].codigo;
        } else {
            currentCodeEl.innerText = 'NO HAY CÓDIGO';
        }
    } catch (err) {
        currentCodeEl.innerText = 'ERROR';
        console.error(err);
    }
}

// Generar un código nuevo en Supabase
btnGenerateCode.addEventListener('click', async () => {
    btnGenerateCode.disabled = true;
    btnGenerateCode.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const managerId = session.user.id;

        // Generar string alfanumérico aleatorio (ej. APEX-A4F9K)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Quitadas O, 0, 1, I para evitar confusiones
        let randomPart = '';
        for(let i=0; i<5; i++) randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        const nuevoCodigo = `APEX-${randomPart}`;

        const { error } = await supabaseClient
            .from('codigos_vinculacion')
            .insert([{ manager_id: managerId, codigo: nuevoCodigo, usado: false }]);

        if (error) throw error;

        currentCodeEl.innerText = nuevoCodigo;
        mostrarMsgCodigo('Nuevo código generado con éxito.', 'success');

    } catch (err) {
        console.error(err);
        mostrarMsgCodigo('Error al generar código.', 'error');
    } finally {
        btnGenerateCode.disabled = false;
        btnGenerateCode.innerHTML = '<i class="fas fa-sync-alt"></i> Generar Nuevo Código';
    }
});

// Copiar al portapapeles
btnCopyCode.addEventListener('click', () => {
    const code = currentCodeEl.innerText;
    if (code === 'CARGANDO...' || code === 'ERROR' || code === 'NO HAY CÓDIGO') return;
    
    navigator.clipboard.writeText(code).then(() => {
        mostrarMsgCodigo('Código copiado al portapapeles.', 'success');
    });
});

// Ejecutar al cargar
checkCurrentSession();