const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);


const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        console.log("Cerrando sesión...");
        
        // 1. Cerramos la sesión oficial en Supabase
        await supabaseClient.auth.signOut();
        
        // 2. Limpiamos cualquier dato o ID guardado en el navegador
        localStorage.clear();
        
        // 3. Redirigimos de vuelta a Ajustes
        window.location.href = '../index.html'; 
    });
}