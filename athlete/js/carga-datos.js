// ========================================
// carga-datos.js - Sincronización con API y Supabase
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    const btnSync = document.getElementById('btn-iniciar-sync');
    const inputUrl = document.getElementById('wa-url');
    const statusBox = document.getElementById('status-message');

    // Función para mostrar mensajes de estado
    const showStatus = (type, message, icon = '') => {
        statusBox.className = `status-box ${type}`;
        statusBox.innerHTML = `${icon} ${message}`;
    };

    btnSync.addEventListener('click', async () => {
        const url = inputUrl.value.trim();
        const client = window.supabaseClient;

        // Validaciones previas
        if (!url) {
            showStatus('error', 'Por favor, introduce una URL válida.', '<i class="fas fa-exclamation-circle"></i>');
            return;
        }
        if (!url.includes('worldathletics.org/athletes/')) {
            showStatus('error', 'La URL no parece ser un perfil válido de World Athletics.', '<i class="fas fa-exclamation-triangle"></i>');
            return;
        }
        if (!client) {
            showStatus('error', 'Error de conexión con la base de datos.', '<i class="fas fa-wifi"></i>');
            return;
        }

        try {
            // 1. Bloquear interfaz y mostrar carga
            btnSync.disabled = true;
            inputUrl.disabled = true;
            showStatus('loading', 'Extrayendo datos de World Athletics... Esto puede tardar unos segundos.', '<i class="fas fa-spinner fa-spin"></i>');

            // 2. Llamada a tu API de Render
            const apiUrl = `https://api-world-athletics.onrender.com/api/atleta?url=${encodeURIComponent(url)}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error('La API no pudo extraer los datos. Verifica la URL.');
            }

            const waData = await response.json();

            showStatus('loading', 'Datos extraídos. Guardando en tu perfil de APEX...', '<i class="fas fa-save"></i>');

            // 3. Obtener el ID del usuario activo en Supabase
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');

            // 4. Mapear datos al formato exacto de tu tabla `atletas`
            // Nota: JSONB en Supabase desde JS se pasa como objetos/arrays normales
            const atletaPayload = {
                wa_id: parseInt(waData.id), // PRIMARY KEY
                atleta_user_id: user.id, // Vínculo de seguridad
                nombre: waData.nombre,
                apellido: waData.apellido,
                nombre_completo: waData.nombre_completo,
                pais: waData.pais,
                codigo_pais: waData.codigo_pais,
                fecha_nacimiento: waData.fecha_nacimiento,
                genero: waData.genero,
                url_perfil: waData.url_perfil,
                redes_sociales: waData.redes_sociales || {},
                wa_representante_id: waData.representante_id,
                marcas_personales: waData.marcas_personales || [],
                mejores_temporada: waData.mejores_temporada || [],
                top_10_historico: waData.top_10_historico || [],
                progresion_historica: waData.progresion_historica || [],
                resultados_recientes: waData.resultados_recientes || [],
                ultima_actualizacion: new Date().toISOString()
            };

            // 5. Upsert (Insertar o Actualizar si ya existe) en Supabase
            // 5. Upsert (Insertar o Actualizar si ya existe) en Supabase
            const { error: dbError } = await client
                .from('atletas')
                .upsert(atletaPayload, { onConflict: 'wa_id' });

            if (dbError) {
                console.error("Error DB:", dbError);
                
                // Código 23505: Violación de unicidad. 
                // Código 42501 o 'security': Bloqueo por nuestras políticas de seguridad (RLS)
                if (dbError.code === '23505' || dbError.code === '42501' || dbError.message.includes('security')) {
                    throw new Error('Este perfil ya está registrado en APEX. Si eres tú, <a href="mailto:soporte@tuweb.com" style="color: #00d1ff; text-decoration: underline; font-weight: bold;">contacta con nuestro servicio técnico</a> para reclamar tus datos.');
                }
                
                throw new Error('Error al guardar en la base de datos.');
            }

            // 6. Éxito absoluto
            showStatus('success', '¡Tus datos se han sincronizado correctamente! Redirigiendo a tu panel...', '<i class="fas fa-check-circle"></i>');
            
            // Redirigir al inicio después de 2 segundos para ver los datos
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2500);

        } catch (error) {
            console.error("Error en la sincronización:", error);
            showStatus('error', error.message || 'Ha ocurrido un error inesperado.', '<i class="fas fa-times-circle"></i>');
        } finally {
            // Restaurar botones si falla (si acierta se redirige)
            btnSync.disabled = false;
            inputUrl.disabled = false;
        }
    });
});