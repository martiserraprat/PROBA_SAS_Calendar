const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variables para guardar el código en la memoria de la página
let codigoGenerado = null;
let datosAgenteTemp = null;

window.addEventListener('DOMContentLoaded', () => {
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const verifyBtn = document.getElementById('verify-btn');
    const confirmBtn = document.getElementById('confirm-otp-btn');
    const repreInput = document.getElementById('repre-name');
    const otpInput = document.getElementById('otp-code');

    // PASO 1: Generar el código (Sustituye al envío de mail)
    verifyBtn.onclick = async function() {
        const nombre = repreInput.value.trim().toLowerCase();
        if (!nombre) return alert("Escribe el nombre del mánager.");

        try {
            const res = await fetch('./datos_world_athletics.json');
            const agentes = await res.json();
            const agente = agentes.find(a => a.name.toLowerCase() === nombre);

            if (!agente) return alert("Mánager no encontrado en el JSON.");

            // --- AQUÍ ESTÁ EL CAMBIO ---
            // 1. Inventamos el código nosotros
            codigoGenerado = Math.floor(100000 + Math.random() * 900000).toString();
            datosAgenteTemp = agente;

            // 2. LO MOSTRAMOS EN UN ALERT (Para que lo veas sin el mail)
            // En el futuro, aquí es donde llamarías a una función para enviar el mail de verdad.
            alert(`SISTEMA: El código para ${agente.email} es: ${codigoGenerado}`);
            console.log("Código generado:", codigoGenerado);

            // 3. Cambiamos la interfaz al paso 2
            step1.style.display = 'none';
            step2.style.display = 'block';
            
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    // PASO 2: Verificar el código introducido
    confirmBtn.onclick = async function() {
        const codigoIntroducido = otpInput.value.trim();

        if (codigoIntroducido === codigoGenerado) {
            // ¡CÓDIGO CORRECTO! Ahora actualizamos la base de datos
            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (!session) return alert("Debes haber iniciado sesión antes.");

            const { error } = await supabaseClient
                .from('profiles')
                .upsert({
                    id: session.user.id,
                    wa_id: datosAgenteTemp.wa_id,
                    full_name: datosAgenteTemp.name,
                    is_verified: true,
                    role: 'manager'
                });

            if (!error) {
                alert("¡Verificación completada!");
                window.location.href = "dashboard.html";
            } else {
                alert("Error al guardar en BD: " + error.message);
            }
        } else {
            alert("Código incorrecto. Inténtalo de nuevo.");
        }
    };
});