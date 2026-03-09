// ========================================
// menu-movil.js - Funcionalidad del menú hamburguesa
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && sidebar && overlay) {
        console.log("🍔 Menú móvil inicializado");
        
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.className = sidebar.classList.contains('active') 
                    ? 'fas fa-times' 
                    : 'fas fa-bars';
            }
        });

        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            if (icon) icon.className = 'fas fa-bars';
        });

        // Cerrar al hacer click en enlaces
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

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });
    }
});