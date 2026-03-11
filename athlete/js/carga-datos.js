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
            showStatus('loading', 'Extrayendo datos de World Athletics... Esto puede tardar hasta 2 minutos. Por favor, no cierres esta ventana..', '<i class="fas fa-spinner fa-spin"></i>');

            // 2. Llamada a tu API
            const apiUrl = `https://api-world-athletics.onrender.com/api/atleta?url=${encodeURIComponent(url)}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error('La API no pudo extraer los datos. Verifica que la URL sea correcta y pública.');
            }

            const waData = await response.json();

            // Validación extra: Asegurarnos de que la API devolvió un atleta real
            if (!waData || !waData.id) {
                throw new Error('Los datos extraídos están incompletos. Inténtalo de nuevo.');
            }

            showStatus('loading', 'Datos extraídos. Guardando en tu perfil de APEX...', '<i class="fas fa-save"></i>');

            // 3. Obtener el ID del usuario activo en Supabase
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');

            // 4. Mapear datos al formato exacto de tu tabla `atletas`
            const atletaPayload = {
                wa_id: parseInt(waData.id), // PRIMARY KEY (o UNIQUE)
                atleta_user_id: user.id,    // UNIQUE KEY
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

            // 5. Upsert basado en el USUARIO (atleta_user_id), no en el wa_id.
            // Esto asegura que si el usuario ya guardó datos manuales en su perfil, se sobreescriban
            // correctamente en SU fila, en lugar de intentar crear una fila duplicada.
            const { error: dbError } = await client
                .from('atletas')
                .upsert(atletaPayload, { onConflict: 'atleta_user_id' });

            if (dbError) {
                console.error("Error DB:", dbError);
                
                // Código 23505: Violación de unicidad (Ej: Alguien más ya registró este wa_id)
                if (dbError.code === '23505' || dbError.code === '42501' || (dbError.message && dbError.message.includes('security'))) {
                    throw new Error('Este perfil de World Athletics ya está reclamado por otra cuenta en APEX. Si eres tú, <a href="mailto:soporte@tuweb.com" style="color: #00d1ff; text-decoration: underline; font-weight: bold;">contacta con soporte</a>.');
                }
                
                throw new Error('Error al guardar en la base de datos.');
            }

            // 6. Éxito absoluto
            showStatus('success', '¡Tus datos se han sincronizado correctamente! Redirigiendo a tu panel...', '<i class="fas fa-check-circle"></i>');
            
            // Redirigir al inicio después de 2 segundos para ver los datos
            setTimeout(() => {
                window.location.href = 'athlete.html';
            }, 2500);

        } catch (error) {
            console.error("Error en la sincronización:", error);
            showStatus('error', error.message || 'Ha ocurrido un error inesperado.', '<i class="fas fa-times-circle"></i>');
        } finally {
            // Restaurar botones si falla
            btnSync.disabled = false;
            inputUrl.disabled = false;
        }
    });
});