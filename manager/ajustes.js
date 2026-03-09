let supabaseClient;

try {
    const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
    console.error("❌ Error inicializando Supabase:", e);
}

window.addEventListener('DOMContentLoaded', () => {
    const verifyBtn = document.getElementById('verify-btn');
    const repreInput = document.getElementById('repre-name');

    if (!verifyBtn) return;

    verifyBtn.onclick = async function() {
        const nombreBuscado = repreInput.value.trim();
        
        if (!nombreBuscado) {
            alert("Por favor, introduce tu nombre oficial.");
            return;
        }

        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
        verifyBtn.disabled = true;

        try {
            const response = await fetch('./datos_world_athletics.json');
            const agentes = await response.json();
            
            // Buscamos coincidencia exacta (ignorando mayúsculas/minúsculas)
            const agenteEncontrado = agentes.find(a => a.name.toLowerCase() === nombreBuscado.toLowerCase());

            if (!agenteEncontrado) {
                alert("No se ha encontrado ningún representante con ese nombre en los registros.");
                resetBtn();
                return;
            }

            // GUARDAMOS EL NOMBRE: Esto es clave para que el dashboard lo reconozca al volver
            localStorage.setItem('nombreRepresentante', agenteEncontrado.name);

            const { error } = await supabaseClient.auth.signInWithOtp({
                email: agenteEncontrado.email,
                options: {
                    emailRedirectTo: 'https://martiserraprat.github.io/PROBA_SAS_Calendar/manager/dashboard.html'
                }
            });

            if (error) throw error;

            alert("¡Enlace enviado! Revisa el correo oficial: " + agenteEncontrado.email);

        } catch (err) {
            console.error("❌ Error:", err);
            alert("Hubo un problema: " + err.message);
        } finally {
            resetBtn();
        }
    };

    function resetBtn() {
        verifyBtn.innerHTML = '<i class="fas fa-envelope"></i> Enviar Enlace de Verificación';
        verifyBtn.disabled = false;
    }
});