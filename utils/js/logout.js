// ========================================
// logout.js - Función de cierre de sesión global
// ========================================

window.logout = async function logout(redirectTo = '../index.html') {
    try {
        console.log("🚪 Cerrando sesión...");
        
        // Mostrar indicador visual si existe el elemento
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            const originalHTML = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            logoutBtn.style.pointerEvents = 'none';
        }
        
        // Cerrar sesión en Supabase
        await window.supabaseClient.auth.signOut();
        
        // Limpiar todos los almacenamientos
        localStorage.clear();
        sessionStorage.clear();
        
        // Mensaje personalizado
        sessionStorage.setItem('auth_message', 'sesion_cerrada');
        
        // Redirigir
        window.location.href = redirectTo;
        
    } catch (error) {
        console.error("❌ Error en logout:", error);
        
        // Forzar redirección incluso con error
        sessionStorage.setItem('auth_message', 'error_logout');
        window.location.href = redirectTo;
    }
};

// Auto-asignar evento a botones de logout si existen
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.logout();
        });
    }
});