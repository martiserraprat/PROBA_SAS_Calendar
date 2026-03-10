document.addEventListener('DOMContentLoaded', () => {
    let eventosUsuario = [];
    let mesActual = new Date().getMonth();
    let anioActual = new Date().getFullYear();

    const vistaLista = document.getElementById('vista-lista');
    const vistaMes = document.getElementById('vista-mes');
    const btnLista = document.getElementById('btn-vista-lista');
    const btnMes = document.getElementById('btn-vista-mes');
    const containerLista = document.getElementById('lista-eventos-container');
    
    // Modales
    const modalCrear = document.getElementById('eventoModal');
    const modalDetalles = document.getElementById('modal-detalles-evento');

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

    // Abrir Modal de Creación
    const btnEventoPersonal = document.getElementById('btn-nuevo-evento-personal');
    if (btnEventoPersonal) {
        btnEventoPersonal.addEventListener('click', () => {
            modalCrear.style.display = 'flex';
            modalCrear.classList.add('active');
        });
    }

    // Botón de Explorar Oficiales
    const btnOficial = document.getElementById('btn-buscar-oficial');
    if (btnOficial) {
        btnOficial.addEventListener('click', () => window.location.href = '../index.html');
    }

    // Cerrar Modales
    document.getElementById('close-modal').addEventListener('click', (e) => {
        e.preventDefault();
        modalCrear.style.display = 'none';
        modalCrear.classList.remove('active');
    });

    document.getElementById('close-detalles').addEventListener('click', (e) => {
        e.preventDefault();
        modalDetalles.style.display = 'none';
    });

    // Cerrar modales si se hace clic fuera del contenedor negro
    window.addEventListener('click', (e) => {
        if (e.target === modalCrear) { modalCrear.style.display = 'none'; modalCrear.classList.remove('active'); }
        if (e.target === modalDetalles) { modalDetalles.style.display = 'none'; }
    });

    // 2. Cargar Eventos (SIN CACHÉ, directo de la BD)
    async function cargarEventos() {
        const client = window.supabaseClient || window.supabase;
        if (!client) return;

        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        const { data: profile } = await client.from('profiles').select('full_name').eq('id', user.id).single();
        if(document.getElementById('sidebar-user-name')) {
            document.getElementById('sidebar-user-name').textContent = profile?.full_name || 'Atleta';
        }

        console.log("🔄 Descargando eventos en tiempo real...");
        const { data, error } = await client
            .from('calendario_atletas')
            .select('*, eventos(*)') // 🔥 LA MAGIA DEL JOIN: Trae los datos oficiales unidos
            .eq('atleta_user_id', user.id)
            .order('fecha_inicio', { ascending: true });
        if (error) { console.error("Error:", error); return; }
        
        eventosUsuario = data || [];
        renderizarVistaLista();
        if(vistaMes.style.display === 'block') renderizarVistaMes();
    }

    // 3. Renderizar Lista
    function renderizarVistaLista() {
        if (eventosUsuario.length === 0) {
            containerLista.innerHTML = '<p style="color:#888; text-align:center; padding: 40px;">No tienes competiciones planificadas.</p>';
            return;
        }

        let html = '';
        let mesRenderizadoActual = '';
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

            // 🔥 Añadimos un data-id para poder identificar el evento al hacer clic
            html += `
                <div class="cal-event-card" data-id="${ev.id}" style="cursor: pointer;">
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

        // Añadir evento click a todas las tarjetas de la lista
        document.querySelectorAll('#lista-eventos-container .cal-event-card').forEach(card => {
            card.addEventListener('click', () => abrirDetalles(card.dataset.id));
        });
    }

    // 4. Renderizar Grid del Mes (Mejorado)
    function renderizarVistaMes() {
        const grid = document.getElementById('cal-dias-container');
        const tituloMes = document.getElementById('cal-mes-año');
        let html = '';

        const primerDia = new Date(anioActual, mesActual, 1);
        const ultimoDia = new Date(anioActual, mesActual + 1, 0);
        
        tituloMes.textContent = primerDia.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

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
            
            // 🔥 AQUÍ VA LA LÓGICA DE LAS PASTILLAS
            let eventosHtml = eventosDia.map(e => {
                let iconoEstado = '🗓️';
                if(e.estado === 'pendiente') iconoEstado = '⏳';
                if(e.estado === 'confirmado') iconoEstado = '✅';
                
                // Extraemos la primera palabra para el diseño limpio
                let tituloLargo = e.titulo_personalizado || "Evento";
                let primeraPalabra = tituloLargo.split(' ')[0];
                let tituloCorto = primeraPalabra + "...";

                // Texto completo para el "bocadillo" al pasar el ratón
                let infoHover = `${tituloLargo} ${e.lugar ? '- ' + e.lugar : ''}`;

                // RETORNAMOS EL HTML CON EL TITLE INCLUIDO
                return `
                <div class="cal-mini-event mini-${e.estado}" data-id="${e.id}" title="${infoHover}">
                    <span class="mini-icon">${iconoEstado}</span>
                    <span class="mini-text">${tituloCorto}</span>
                </div>`;
            }).join('');

            html += `
                <div class="cal-cell ${esHoy}">
                    <span class="cal-cell-date">${dia}</span>
                    ${eventosHtml}
                </div>`;
        }
        grid.innerHTML = html;

        // Volver a activar los clics para abrir el modal
        document.querySelectorAll('.cal-mini-event').forEach(miniCard => {
            miniCard.addEventListener('click', (e) => {
                e.stopPropagation();
                abrirDetalles(miniCard.dataset.id);
            });
        });
    }

    // Navegación Calendario
    document.getElementById('cal-prev').addEventListener('click', () => { mesActual--; if(mesActual < 0){ mesActual = 11; anioActual--; } renderizarVistaMes(); });
    document.getElementById('cal-next').addEventListener('click', () => { mesActual++; if(mesActual > 11){ mesActual = 0; anioActual++; } renderizarVistaMes(); });

    // 5. Función para Abrir Modal de Detalles
    function abrirDetalles(eventoId) {
        const evento = eventosUsuario.find(e => e.id === eventoId);
        if(!evento) return;

        const fechaObjeto = new Date(evento.fecha_inicio);
        const fechaTexto = fechaObjeto.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        // Rellenar datos base del usuario
        document.getElementById('detalle-id').value = evento.id;
        document.getElementById('detalle-titulo').textContent = evento.titulo_personalizado || "Competición";
        document.getElementById('detalle-fecha').textContent = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
        document.getElementById('detalle-lugar').textContent = evento.lugar || "Lugar por determinar";
        document.getElementById('detalle-obs').textContent = evento.observaciones || "Ninguna observación extra.";
        document.getElementById('detalle-estado').value = evento.estado;

        // 🔥 LÓGICA DE EVENTO OFICIAL (Clon de index)
        const infoOficialBox = document.getElementById('detalle-oficial-info');
        const oficialEv = evento.eventos; 

        if (oficialEv) {
            infoOficialBox.style.display = 'block';
            
            document.getElementById('detalle-area').textContent = oficialEv.area || '-';
            const levelMap = { 'OW': 'OLYMPIC/WORLD', 'DF': 'DL FINAL', 'GW': 'DIAMOND', 'GL': 'CHAMPIONSHIP', 'A': 'GOLD', 'B': 'SILVER', 'C': 'BRONZE', 'D': 'CHALLENGER' };
            document.getElementById('detalle-cat').textContent = levelMap[oficialEv.category] || oficialEv.category || '-';
            
            // Pruebas
            const vault = document.getElementById('detalle-pruebas');
            if (oficialEv.disciplines && oficialEv.disciplines.length > 0) {
                vault.textContent = oficialEv.disciplines.map(d => `${d.name} (${d.gender})`).join(', ');
            } else {
                vault.innerHTML = '<span style="color: #ffcc00;"><i class="fas fa-exclamation-triangle"></i> Pruebas por confirmar</span>';
            }

            // Enlaces con el mismo diseño del index
            const linksCont = document.getElementById('detalle-links');
            linksCont.innerHTML = '';
            function ensureAbsUrl(url) {
                if (!url) return '';
                return (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;
            }

            if (oficialEv.links?.web) linksCont.innerHTML += `<a href="${ensureAbsUrl(oficialEv.links.web)}" target="_blank" class="link-btn" style="padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 6px; color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-external-link-alt" style="color: #00d1ff;"></i> Web Oficial</a>`;
            if (oficialEv.links?.results) linksCont.innerHTML += `<a href="${ensureAbsUrl(oficialEv.links.results)}" target="_blank" class="link-btn" style="padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 6px; color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,0.1);"><i class="fas fa-poll" style="color: #00d1ff;"></i> Resultados</a>`;

            // Contactos igual que en app.js
            const contactCont = document.getElementById('detalle-contacts');
            contactCont.innerHTML = oficialEv.contact?.length > 0 
                ? oficialEv.contact.map(c => `
                    <div class="contact-box" style="border-left:4px solid #0070f3; padding:12px; margin-bottom:12px; background:rgba(255,255,255,0.05);">
                        <p style="color:#0070f3; font-size:0.75rem; font-weight:bold; margin:0;">${c.title || 'ORGANIZER'}</p>
                        <p style="margin:2px 0; font-weight:bold; color:#fff;"><i class="fas fa-user-circle"></i> ${c.name || 'N/A'}</p>
                        ${c.email ? `<p style="margin:5px 0 0 0; font-size:0.9rem;"><i class="fas fa-envelope"></i> <a href="mailto:${c.email}" style="color:#fff; opacity:0.8;">${c.email}</a></p>` : ''}
                    </div>`).join('')
                : '<p style="color:#777; font-style:italic;">Contacto no publicado.</p>';

            // Botón de viaje
            document.getElementById('btn-manage-trip-cal').onclick = (e) => {
                e.preventDefault();
                const dateStr = evento.fecha_inicio;
                window.location.href = `../utils/travel.html?destino=${encodeURIComponent(evento.lugar || oficialEv.venue)}&fecha=${dateStr}`;
            };

        } else {
            infoOficialBox.style.display = 'none';
        }

        modalDetalles.style.display = 'flex';
    }

    // 6. ACTUALIZAR ESTADO DEL EVENTO
    document.getElementById('form-editar-estado').addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = window.supabaseClient;
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        
        const eventoId = document.getElementById('detalle-id').value;
        const nuevoEstado = document.getElementById('detalle-estado').value;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const { error } = await client
            .from('calendario_atletas')
            .update({ estado: nuevoEstado })
            .eq('id', eventoId);
        
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Actualizar Estado';

        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else {
            modalDetalles.style.display = 'none';
            cargarEventos(); // Recargar datos para ver el cambio
        }
    });

    // 7. ELIMINAR EVENTO
    document.getElementById('btn-eliminar-evento').addEventListener('click', async () => {
        const confirmar = confirm("¿Estás seguro de que quieres eliminar esta competición de tu calendario?");
        if(!confirmar) return;

        const client = window.supabaseClient;
        const eventoId = document.getElementById('detalle-id').value;
        const btnEliminar = document.getElementById('btn-eliminar-evento');

        btnEliminar.disabled = true;
        btnEliminar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const { error } = await client
            .from('calendario_atletas')
            .delete()
            .eq('id', eventoId);

        btnEliminar.disabled = false;
        btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';

        if(error) {
            alert('Error al eliminar: ' + error.message);
        } else {
            modalDetalles.style.display = 'none';
            cargarEventos();
        }
    });

    // 8. GUARDAR NUEVO EVENTO
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
            modalCrear.style.display = 'none';
            modalCrear.classList.remove('active');
            cargarEventos(); 
        }
    });

    // Iniciar
    setTimeout(cargarEventos, 200);
});
