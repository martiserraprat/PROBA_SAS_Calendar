document.addEventListener('DOMContentLoaded', () => {
    let eventosUsuario = [];
    let mesActual = new Date().getMonth();
    let anioActual = new Date().getFullYear();

    const vistaLista = document.getElementById('vista-lista');
    const vistaMes = document.getElementById('vista-mes');
    const btnLista = document.getElementById('btn-vista-lista');
    const btnMes = document.getElementById('btn-vista-mes');
    const containerLista = document.getElementById('lista-eventos-container');
    const modal = document.getElementById('eventoModal');

    // 1. Alternar Vistas
    btnLista.addEventListener('click', () => {
        btnLista.classList.add('active'); btnMes.classList.remove('active');
        vistaLista.style.display = 'block'; vistaMes.style.display = 'none';
    });
    btnMes.addEventListener('click', () => {
        btnMes.classList.add('active'); btnLista.classList.remove('active');
        vistaLista.style.display = 'none'; vistaMes.style.display = 'block';
        renderizarVistaMes();
    });

    // Abrir Modal para Evento Personal / Local
    const btnEventoPersonal = document.getElementById('btn-nuevo-evento-personal');
    if (btnEventoPersonal) {
        btnEventoPersonal.addEventListener('click', () => modal.classList.add('active'));
    }

    // Botón de Explorar Eventos Oficiales
    const btnOficial = document.getElementById('btn-buscar-oficial');
    if (btnOficial) {
        btnOficial.addEventListener('click', () => {
            // Aquí pones la ruta a la página donde tienes tu lista general de eventos
            window.location.href = '../index.html'; 
        });
    }

    // Cerrar Modal
    document.getElementById('close-modal').addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
    });

    // 3. Cargar Eventos desde BD
    async function cargarEventos() {
        const client = window.supabaseClient || window.supabase;
        if (!client) return;

        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        // Recuperar nombre para el menú lateral
        const { data: profile } = await client.from('profiles').select('full_name').eq('id', user.id).single();
        if(document.getElementById('sidebar-user-name')) {
            document.getElementById('sidebar-user-name').textContent = profile?.full_name || 'Atleta';
        }

        const { data, error } = await client
            .from('calendario_atletas')
            .select('*')
            .eq('atleta_user_id', user.id)
            .order('fecha_inicio', { ascending: true });

        if (error) { console.error("Error:", error); return; }
        
        eventosUsuario = data || [];
        renderizarVistaLista();
        if(vistaMes.style.display === 'block') renderizarVistaMes();
    }

    // 4. Renderizar Lista
    function renderizarVistaLista() {
        if (eventosUsuario.length === 0) {
            containerLista.innerHTML = '<p style="color:#888; text-align:center; padding: 40px;">No tienes competiciones planificadas.</p>';
            return;
        }

        let html = '';
        let mesRenderizadoActual = '';
        
        // Filtro para mostrar desde hace 7 días en adelante en la vista lista
        const hoy = new Date();
        hoy.setDate(hoy.getDate() - 7);
        const eventosFuturos = eventosUsuario.filter(e => new Date(e.fecha_inicio) >= hoy);

        if (eventosFuturos.length === 0) {
            containerLista.innerHTML = '<p style="color:#888; text-align:center; padding: 40px;">No hay eventos próximos.</p>';
            return;
        }

        eventosFuturos.forEach(ev => {
            const fechaObj = new Date(ev.fecha_inicio);
            const mesAnioStr = fechaObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            
            if (mesAnioStr !== mesRenderizadoActual) {
                html += `<div class="month-separator">${mesAnioStr}</div>`;
                mesRenderizadoActual = mesAnioStr;
            }

            const dia = fechaObj.getDate().toString().padStart(2, '0');
            const mesCorto = fechaObj.toLocaleString('es-ES', { month: 'short' });
            const titulo = ev.titulo_personalizado || "Competición";
            
            let estadoTexto = ev.estado;
            if(ev.estado === 'planeado') estadoTexto = '🗓️ Planeado';
            if(ev.estado === 'pendiente') estadoTexto = '⏳ Solicitado';
            if(ev.estado === 'confirmado') estadoTexto = '✅ Confirmado';

            let obsHtml = ev.observaciones ? `<div class="ev-obs"><i class="fas fa-info-circle"></i> ${ev.observaciones}</div>` : '';

            html += `
                <div class="cal-event-card">
                    <div class="ev-date-box">
                        <span class="day">${dia}</span>
                        <span class="month">${mesCorto}</span>
                    </div>
                    <div class="ev-info">
                        <h4>${titulo}</h4>
                        <p><i class="fas fa-map-marker-alt"></i> ${ev.lugar || 'Por determinar'}</p>
                        ${obsHtml}
                    </div>
                    <div><span class="status-badge status-${ev.estado}">${estadoTexto}</span></div>
                </div>`;
        });
        containerLista.innerHTML = html;
    }

    // 5. Renderizar Grid del Mes
    function renderizarVistaMes() {
        const grid = document.getElementById('cal-dias-container');
        const tituloMes = document.getElementById('cal-mes-año');
        let html = '';

        const primerDia = new Date(anioActual, mesActual, 1);
        const ultimoDia = new Date(anioActual, mesActual + 1, 0);
        
        tituloMes.textContent = primerDia.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        // 0 = Domingo, 1 = Lunes... Lo pasamos a (0 = Lunes, 6 = Domingo)
        let diaInicioSemana = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1;

        for (let i = 0; i < diaInicioSemana; i++) {
            html += `<div class="cal-cell empty"></div>`;
        }

        const hoy = new Date();

        for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
            const strMes = (mesActual + 1).toString().padStart(2, '0');
            const strDia = dia.toString().padStart(2, '0');
            const fechaCeldaStr = `${anioActual}-${strMes}-${strDia}`;
            
            let esHoy = (hoy.getDate() === dia && hoy.getMonth() === mesActual && hoy.getFullYear() === anioActual) ? 'today' : '';
            
            const eventosDia = eventosUsuario.filter(e => e.fecha_inicio === fechaCeldaStr);
            let eventosHtml = eventosDia.map(e => `
                <div class="cal-mini-event mini-${e.estado}" title="${e.titulo_personalizado}">${e.titulo_personalizado}</div>
            `).join('');

            html += `
                <div class="cal-cell ${esHoy}">
                    <span class="cal-cell-date">${dia}</span>
                    ${eventosHtml}
                </div>`;
        }
        grid.innerHTML = html;
    }

    // Navegación
    document.getElementById('cal-prev').addEventListener('click', () => { mesActual--; if(mesActual < 0){ mesActual = 11; anioActual--; } renderizarVistaMes(); });
    document.getElementById('cal-next').addEventListener('click', () => { mesActual++; if(mesActual > 11){ mesActual = 0; anioActual++; } renderizarVistaMes(); });

    // 6. Guardar Evento
    document.getElementById('form-evento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = window.supabaseClient;
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        const { data: { user } } = await client.auth.getUser();

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const payload = {
            atleta_user_id: user.id,
            titulo_personalizado: document.getElementById('ev-titulo').value,
            fecha_inicio: document.getElementById('ev-fecha').value,
            lugar: document.getElementById('ev-lugar').value,
            estado: document.getElementById('ev-estado').value,
            observaciones: document.getElementById('ev-obs').value
        };

        const { error } = await client.from('calendario_atletas').insert([payload]);
        
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Guardar Evento';

        if (error) {
            alert('Error: ' + error.message);
        } else {
            document.getElementById('form-evento').reset();
            modal.classList.remove('active');
            cargarEventos(); 
        }
    });

    // Iniciar
    setTimeout(cargarEventos, 200);
});