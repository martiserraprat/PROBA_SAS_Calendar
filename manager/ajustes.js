// Usamos un nombre de variable distinto para evitar el error de "already declared"
let supabaseClient;

try {
    const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
    
    // Inicializamos el cliente usando el objeto global de la librería
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log("🚀 Cliente de Supabase listo");
} catch (e) {
    console.error("❌ Error inicializando Supabase:", e);
}

// Esperamos a que el HTML esté cargado
window.addEventListener('DOMContentLoaded', () => {
    console.log("✅ DOM cargado");

    const verifyBtn = document.getElementById('verify-btn');
    const repreInput = document.getElementById('repre-name');
    const statusMsg = document.getElementById('status-message');

    if (!verifyBtn) {
        console.error("❌ No se encontró el botón con ID 'verify-btn'");
        return;
    }

    // Usamos onclick directamente para asegurar que solo haya un evento
    verifyBtn.onclick = async function() {
        console.log("🖱️ Botón pulsado");
        
        const nombreBuscado = repreInput.value.trim().toLowerCase();
        
        if (!nombreBuscado) {
            alert("Por favor, introduce un nombre.");
            return;
        }

        // Estado visual de carga
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        verifyBtn.disabled = true;

        try {
            // 1. Cargar el JSON
            const response = await fetch('./datos_world_athletics.json');
            if (!response.ok) throw new Error("No se pudo cargar el JSON");
            
            const agentes = await response.json();
            
            // 2. Buscar al representante
            const agenteEncontrado = agentes.find(a => a.name.toLowerCase() === nombreBuscado);

            if (!agenteEncontrado) {
                alert("No se ha encontrado ningún representante con ese nombre.");
                resetBtn();
                return;
            }

            console.log("📧 Enviando link a:", agenteEncontrado.email);

            // 3. Enviar Magic Link con Supabase
            const { error } = await supabaseClient.auth.signInWithOtp({
                email: agenteEncontrado.email,
                options: {
                    emailRedirectTo: window.location.origin + '/dashboard.html'
                }
            });

            if (error) throw error;

            // Éxito
            alert("¡Enlace enviado! Revisa el correo: " + agenteEncontrado.email);
            localStorage.setItem('nombreRepresentante', agenteEncontrado.name);

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