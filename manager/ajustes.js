const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let codigoGenerado = null;
let datosAgenteTemp = null;

window.addEventListener('DOMContentLoaded', () => {
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const verifyBtn = document.getElementById('verify-btn');
    const confirmBtn = document.getElementById('confirm-otp-btn');
    const repreInput = document.getElementById('repre-name');
    const otpInput = document.getElementById('otp-code');
    const instructionText = document.getElementById('instruction-text');

    // BOTÓN 1: SOLICITAR CÓDIGO
    verifyBtn.onclick = async function() {
        const nombre = repreInput.value.trim().toLowerCase();
        if (!nombre) return alert("Escribe tu nombre.");

        try {
            const res = await fetch('./datos_world_athletics.json');
            const agentes = await res.json();
            const agente = agentes.find(a => a.name.toLowerCase() === nombre);

            if (!agente) return alert("No encontrado en la base de datos.");

            // 1. Inventamos el código de 6 dígitos
            codigoGenerado = Math.floor(100000 + Math.random() * 900000).toString();
            datosAgenteTemp = agente;

            // 2. Simulamos el envío (En el futuro aquí llamas a una API de mail)
            console.log(`CÓDIGO PARA ${agente.email}: ${codigoGenerado}`);
            alert(`SISTEMA: Se ha enviado un código al email oficial: ${agente.email}`);

            // 3. Cambiamos de interfaz
            step1.style.display = 'none';
            step2.style.display = 'block';
            instructionText.innerText = `Introduce el código enviado a ${agente.email}`;
            
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    // BOTÓN 2: CONFIRMAR CÓDIGO Y GUARDAR EN BD
    confirmBtn.onclick = async function() {
        const inputCode = otpInput.value.trim();

        if (inputCode === codigoGenerado) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (!session) return alert("Debes estar logueado para terminar.");

            // GUARDAMOS EN SUPABASE DEFINITIVAMENTE
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
                alert("¡Verificado con éxito!");
                window.location.href = "dashboard.html";
            } else {
                alert("Error BD: " + error.message);
                confirmBtn.disabled = false;
            }
        } else {
            alert("Código incorrecto. Revisa tu email.");
        }
    };

    document.getElementById('back-btn').onclick = () => {
        step1.style.display = 'block';
        step2.style.display = 'none';
    };
});