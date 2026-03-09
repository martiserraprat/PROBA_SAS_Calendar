// ========================================
// auth-guard.js - Protección de rutas
// ========================================

const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';

// Crear cliente Supabase global (para que todos los scripts lo usen)
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ========================================
// PROTECCIÓN DE RUTAS - EJECUTAR INMEDIATAMENTE
// ========================================

(async function protegerRuta() {
    console.log("🔒 Verificando acceso a página protegida...");
    
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) throw error;
        
        if (!session) {
            console.log("🚫 Acceso denegado - Redirigiendo...");
            
            // Determinar qué mensaje mostrar según la página
            const paginaActual = window.location.pathname.split('/').pop();
            let mensaje = 'acceso_restringido';
            
            if (paginaActual === 'dashboard.html') {
                mensaje = 'dashboard_protegido';
            } else if (paginaActual === 'ajustes.html') {
                mensaje = 'ajustes_protegido';
            }
            
            sessionStorage.setItem('auth_message', mensaje);
            window.location.href = '../index.html';
            return;
        }
        
        console.log("✅ Acceso permitido para:", session.user.email);
        
        // Guardar sesión en variable global para otros scripts
        window.currentSession = session;
        
    } catch (error) {
        console.error("❌ Error de autenticación:", error);
        sessionStorage.setItem('auth_message', 'error_verificacion');
        window.location.href = '../index.html';
    }
})();