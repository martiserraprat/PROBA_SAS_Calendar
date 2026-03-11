document.addEventListener('DOMContentLoaded', () => {
    let misMarcas = [];
    let userId = null;

    const modal = document.getElementById('modal-marca');
    const form = document.getElementById('form-marca');
    const container = document.getElementById('pb-container');

    // 1. ABRIR Y CERRAR MODAL
    document.getElementById('btn-nueva-marca').addEventListener('click', () => {
        form.reset(); // Limpiar el formulario
        modal.style.display = 'flex';
    });

    document.getElementById('close-modal-marca').addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // 2. CARGAR DATOS DEL ATLETA
    async function cargarDatos() {
        const client = window.supabaseClient;
        if (!client) return;

        const { data: { user } } = await client.auth.getUser();
        if (!user) return;
        userId = user.id;

        // Recuperar nombre para el menú
        const { data: profile } = await client.from('profiles').select('full_name').eq('id', user.id).single();
        if(document.getElementById('sidebar-user-name')) {
            document.getElementById('sidebar-user-name').textContent = profile?.full_name || 'Atleta';
        }

        // Descargar la tabla de atletas
        const { data: atleta, error } = await client
            .from('atletas')
            .select('marcas_personales')
            .eq('atleta_user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error cargando marcas:", error);
            container.innerHTML = '<p style="color:#ff4444; text-align:center;">Error al cargar los datos.</p>';
            return;
        }

        // Parsear el JSON de marcas
        if (atleta && atleta.marcas_personales) {
            misMarcas = typeof atleta.marcas_personales === 'string' 
                        ? JSON.parse(atleta.marcas_personales) 
                        : atleta.marcas_personales;
        }

        renderizarMarcas();
    }

    // 3. PINTAR EL HTML DE LAS TARJETAS Y ESTADÍSTICAS
    function renderizarMarcas() {
        document.getElementById('total-pruebas').textContent = misMarcas.length;

        if (misMarcas.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed #333;">
                    <i class="fas fa-running" style="font-size: 3rem; color: #444; margin-bottom: 15px;"></i>
                    <h3 style="color: #fff;">Aún no tienes marcas registradas</h3>
                    <p style="color: #888;">Añade tu primer PB para empezar a construir tu perfil.</p>
                </div>
            `;
            document.getElementById('top-prueba-nombre').textContent = "-";
            document.getElementById('top-prueba-puntos').textContent = "0 pts";
            return;
        }

        const marcasOrdenadas = [...misMarcas].sort((a, b) => (parseInt(b.puntuacion) || 0) - (parseInt(a.puntuacion) || 0));
        const mejorPrueba = marcasOrdenadas[0];
        document.getElementById('top-prueba-nombre').textContent = mejorPrueba.disciplina;
        document.getElementById('top-prueba-puntos').textContent = (mejorPrueba.puntuacion || 0) + ' pts WA';

        // ==========================================
        // FILTROS INTELIGENTES PARA AGRUPAR
        // ==========================================

        function obtenerPruebaBase(d) {
            let original = d.toUpperCase();
            
            let artefacto = "";
            const matchArtefacto = original.match(/\(\s*[\d.,]+\s*(?:CM|M|KG|G)?\s*\)/);
            
            if (matchArtefacto) {
                artefacto = " " + matchArtefacto[0].replace(/\s/g, ''); 
            } else if (/HURDLE|VALLA|SHOT PUT|DISCUS|HAMMER|JAVELIN|PESO|DISCO|MARTILLO|JABALINA|SC|STEEPLECHASE/.test(original)) {
                artefacto = " (ABSOLUTO)";
            }

            let base = original;
            base = base.replace(/\b(U14|U16|U18|U20|U23|SH|SHORT TRACK|INDOOR)\b/g, ''); 
            base = base.replace(/\(.*?\)/g, ''); 
            base = base.replace(/METRES|METERS/g, 'M'); 
            base = base.replace(/\s+/g, ' ').trim(); 
            base = base.replace(/(\d+)\s+M\b/g, '$1M'); 
            
            return base + artefacto;
        }

        function obtenerCategoria(prueba) {
            const p = prueba.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const pNorm = p.replace(/(METRES|METERS|MTS)/g, 'M').replace(/\s+/g, '');
            if (/DECATHLON|HEPTATHLON|PENTATHLON|OCTATHLON|COMBINADA/.test(p)) return '🌟 Pruebas Combinadas';
            if (/PUT|JAVELIN|DISCUS|HAMMER|WEIGHT|LANZAMIENTO|PESO|JABALINA|DISCO|MARTILLO|SHOT/.test(p)) return '💪 Lanzamientos';
            if (/JUMP|VAULT|SALTO|PERTIGA|LONGITUD|TRIPLE|ALTURA/.test(p)) return '🚀 Saltos';
            if (/WALK|MARCHA|20K|35K|50K/.test(p)) return '🚶 Marcha Atlética';
            if (/500|600|800|1000|1500|2000|3000|5000|10,000|1HOUR/.test(pNorm)) {
                if (!p.includes('WALK')) return '🏃 Fondo y Medio Fondo';
            }
            if (/SC|STEEPLECHASE|OBSTACULO/.test(p)) return '🏃 Fondo y Medio Fondo';
            if (/ROAD|MARATHON|MILE|XC|TRAIL|DISTANCE MEDLEY/.test(p)) {
                if (!p.includes('WALK')) return '🏃 Fondo y Medio Fondo';
            }
            if (/100M|110M|300M|400M|60M|HURDLE|VALLA|RELEVO|RELAY|4X|SPRINT MEDLEY/.test(pNorm)) return '⚡ Velocidad y Vallas';
            if (/^50|^60|^100|^150|^200|^300|^400|^100Y/.test(pNorm)) {
                if (!p.includes('WALK')) return '⚡ Velocidad y Vallas';
            }
            return '🏅 Otras Pruebas';
        }

        // ==========================================
        // PROCESAR LOS DATOS
        // ==========================================

        const mejoresPruebasMap = {};
        misMarcas.forEach((m, index) => {
            const base = obtenerPruebaBase(m.disciplina);
            const ptsActual = parseInt(m.puntuacion) || 0;

            if (!mejoresPruebasMap[base]) {
                mejoresPruebasMap[base] = { ...m, indexReal: index, pruebaBase: base };
            } else {
                const ptsGuardado = parseInt(mejoresPruebasMap[base].puntuacion) || 0;
                if (ptsActual > ptsGuardado) {
                    mejoresPruebasMap[base] = { ...m, indexReal: index, pruebaBase: base };
                }
            }
        });
        
        const recordsAbsolutos = Object.values(mejoresPruebasMap).sort((a, b) => (parseInt(b.puntuacion) || 0) - (parseInt(a.puntuacion) || 0));

        // 🔥 AQUÍ ESTÁ EL CÓDIGO NUEVO ANTIDUPLICADOS
        const grupos = {};
        const marcasUnicas = []; // Control de clones

        misMarcas.forEach((m, index) => {
            const base = obtenerPruebaBase(m.disciplina);
            const marcaValor = m.marca.trim();
            const fechaValor = m.fecha;

            // Comprueba si ya existe esta prueba con la misma marca y misma fecha
            const esDuplicado = marcasUnicas.some(u => u.base === base && u.marca === marcaValor && u.fecha === fechaValor);

            if (!esDuplicado) {
                // Si no es un clon, lo guardamos para el histórico
                marcasUnicas.push({ base: base, marca: marcaValor, fecha: fechaValor });
                
                const cat = obtenerCategoria(m.disciplina);
                if (!grupos[cat]) grupos[cat] = [];
                grupos[cat].push({ ...m, indexReal: index, pruebaBase: base }); 
            }
        });

        // ==========================================
        // GENERAR HTML
        // ==========================================
        
        function crearTarjetaHtml(m) {
            const fechaBonita = new Date(m.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            const puntos = parseInt(m.puntuacion) || 0;
            const puntosHtml = puntos > 0 ? `<span class="pb-points-badge"><i class="fas fa-star"></i> ${puntos} pts</span>` : '';
            
            const badgeOrigen = m.manual 
                ? `<span class="badge-origen badge-manual" title="Añadida manualmente"><i class="fas fa-user-edit"></i> NO OFICIAL</span>` 
                : `<span class="badge-origen badge-oficial" title="Marca Oficial WA"><i class="fas fa-check-circle"></i> OFICIAL</span>`;

            return `
            <div class="pb-card-pro">
                <div class="pb-header" style="flex-direction: column; width: 100%; align-items: stretch;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        ${badgeOrigen}
                        ${puntosHtml}
                    </div>
                    <span class="pb-title" title="${m.disciplina}">${m.pruebaBase || m.disciplina}</span>
                </div>
                
                <div class="pb-mark-value">${m.marca}</div>
                
                <div class="pb-footer-info">
                    <span style="font-size:0.75rem; color:#666; margin-bottom:4px;">Registro original: ${m.disciplina}</span>
                    <span><i class="far fa-calendar-alt"></i> ${fechaBonita}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${m.lugar || 'N/A'}</span>
                </div>

                <button class="btn-delete-pb" data-index="${m.indexReal}" title="Eliminar Marca">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>`;
        }

        let htmlFinal = '';

        // 1. SECCIÓN VIP: TOP RÉCORDS POR PRUEBA
        htmlFinal += `
            <div class="category-section" style="grid-column: 1/-1;">
                <div class="cat-header">
                    <h3 style="color: #ffd700;"><i class="fas fa-trophy"></i> MEJOES MARCAS</h3>
                    <div class="cat-line" style="background: linear-gradient(90deg, #ffd700, transparent);"></div>
                </div>
                <div class="pb-grid-page" style="margin-top: 15px;">
        `;
        recordsAbsolutos.forEach(m => {
            htmlFinal += crearTarjetaHtml(m);
        });
        htmlFinal += `</div></div>`;

        // SEPARADOR GIGANTE PARA EL HISTÓRICO
        htmlFinal += `
            <div style="grid-column: 1/-1; margin: 50px 0 20px 0; text-align: center;">
                <h2 style="color: #555; text-transform: uppercase; letter-spacing: 2px; font-size: 1rem;">Histórico Completo de Marcas</h2>
            </div>
        `;

        // 2. SECCIÓN: HISTÓRICO COMPLETO POR CATEGORÍAS
        for (const [categoria, pruebas] of Object.entries(grupos)) {
            htmlFinal += `
                <div class="category-section" style="grid-column: 1/-1;">
                    <div class="cat-header">
                        <h3 style="color: #ccc; font-size: 1.1rem;">${categoria}</h3>
                        <div class="cat-line"></div>
                    </div>
                    <div class="pb-grid-page" style="margin-top: 15px;">
            `;
            pruebas.forEach(m => {
                htmlFinal += crearTarjetaHtml(m);
            });
            htmlFinal += `</div></div>`;
        }

        container.innerHTML = htmlFinal;

        document.querySelectorAll('.btn-delete-pb').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                borrarMarca(index);
            });
        });
    }

    // 4. GUARDAR NUEVA MARCA (O ACTUALIZAR SI YA EXISTE)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = window.supabaseClient;
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const nuevaDisciplina = document.getElementById('pb-disciplina').value.trim().toUpperCase();
        const nuevaMarca = {
            disciplina: nuevaDisciplina,
            marca: document.getElementById('pb-marca-valor').value.trim(),
            fecha: document.getElementById('pb-fecha').value,
            lugar: document.getElementById('pb-lugar').value.trim(),
            puntuacion: parseInt(document.getElementById('pb-puntos').value) || 0,
            manual: true 
        };

        const indexExistente = misMarcas.findIndex(m => m.disciplina.toUpperCase() === nuevaDisciplina);
        if (indexExistente >= 0) {
            misMarcas[indexExistente] = nuevaMarca; 
        } else {
            misMarcas.push(nuevaMarca); 
        }

        const { error } = await client
            .from('atletas')
            .update({ marcas_personales: misMarcas })
            .eq('atleta_user_id', userId);

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Guardar PB';

        if (error) {
            alert("Error al guardar: " + error.message);
        } else {
            sessionStorage.removeItem('apex_dashboard_atleta');
            modal.style.display = 'none';
            renderizarMarcas(); 
        }
    });

    // 5. BORRAR UNA MARCA
    async function borrarMarca(index) {
        const confirmar = confirm(`¿Estás seguro de borrar tu récord de ${misMarcas[index].disciplina}?`);
        if (!confirmar) return;

        misMarcas.splice(index, 1); 

        const client = window.supabaseClient;
        const { error } = await client
            .from('atletas')
            .update({ marcas_personales: misMarcas })
            .eq('atleta_user_id', userId);

        if (error) {
            alert("Error al borrar: " + error.message);
        } else {
            sessionStorage.removeItem('apex_dashboard_atleta'); 
            renderizarMarcas();
        }
    }

    // Inicializar
    setTimeout(cargarDatos, 200);
});