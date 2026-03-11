// =============================================
// PERFIL ATLETA - SCRIPT MEJORADO
// Explota toda la información de la tabla atletas
// =============================================

let _atletaData = null;
let _originalInfoData = null;
let _originalSocialData = null;

// =============================================
// UTILS
// =============================================

function showToast(msg, type = 'info', duration = 3500) {
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(8px)';
        t.style.transition = '0.3s';
        setTimeout(() => t.remove(), 350);
    }, duration);
}

function showConfirm(title, desc) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-desc').textContent = desc;
        modal.style.display = 'flex';
        const close = () => {
            modal.style.display = 'none';
            document.getElementById('confirm-ok').replaceWith(document.getElementById('confirm-ok').cloneNode(true));
            document.getElementById('confirm-cancel').replaceWith(document.getElementById('confirm-cancel').cloneNode(true));
        };
        document.getElementById('confirm-ok').onclick = () => { close(); resolve(true); };
        document.getElementById('confirm-cancel').onclick = () => { close(); resolve(false); };
    });
}

// Calcula la edad a partir de una fecha "DD MMM YYYY" o "YYYY-MM-DD"
function calcularEdad(fechaNac) {
    if (!fechaNac) return null;
    const d = new Date(fechaNac);
    if (isNaN(d)) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - d.getFullYear();
    const m = hoy.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
    return edad;
}

// Agrupa marcas personales por disciplina principal (ignorando variantes de altura)
function getDisciplinasPrincipales(marcas) {
    // Prioridad: disciplinas con puntuacion > 0 y más relevantes
    return marcas
        .filter(m => m.puntuacion > 0)
        .sort((a, b) => b.puntuacion - a.puntuacion);
}

// Obtiene la mejor marca por disciplina (para tabla)
function getMejoresPorDisciplina(marcas) {
    const map = {};
    marcas.forEach(m => {
        const key = m.disciplina;
        if (!map[key] || (m.puntuacion > 0 && m.puntuacion > (map[key].puntuacion || 0))) {
            map[key] = m;
        }
    });
    return Object.values(map).sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
}

// Formatea fecha "DD MMM YYYY" o ISO a "DD MMM YYYY"
function formatFecha(fecha) {
    if (!fecha) return '-';
    // Si ya viene en formato "DD MMM YYYY"
    if (/^\d{2} [A-Z]{3} \d{4}$/.test(fecha)) return fecha;
    // Si viene ISO
    try {
        return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    } catch { return fecha; }
}

// Obtiene el año de una fecha
function getAnio(fecha) {
    if (!fecha) return null;
    const match = fecha.match(/\d{4}/);
    return match ? parseInt(match[0]) : null;
}

// =============================================
// RENDERIZADO DE SECCIONES
// =============================================

// --- HERO ---
function actualizarHero(atleta, email) {
    const nombre = atleta?.nombre_completo || `${atleta?.nombre || ''} ${atleta?.apellido || ''}`.trim() || 'Tu nombre';
    document.getElementById('hero-name').textContent = nombre;
    document.getElementById('hero-email').textContent = email || '';

    // Avatar dinámico con iniciales
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0070f3&color=fff&size=200`;
    document.getElementById('hero-avatar').src = avatarUrl;
    document.getElementById('sidebar-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=00d1ff&color=fff`;
    document.getElementById('sidebar-user-name').textContent = nombre;

    // Meta badges
    const metaEl = document.getElementById('hero-meta');
    metaEl.innerHTML = '';

    const genero = atleta?.genero;
    if (genero) {
        const isMale = genero === 'M';
        const gb = document.createElement('span');
        gb.className = `gender-badge-hero ${isMale ? 'man' : 'woman'}`;
        gb.innerHTML = `<i class="fas ${isMale ? 'fa-mars' : 'fa-venus'}"></i> ${isMale ? 'Masculino' : 'Femenino'}`;
        metaEl.appendChild(gb);
    }

    if (atleta?.pais) {
        const tag = document.createElement('span');
        tag.className = 'meta-tag';
        tag.innerHTML = `<i class="fas fa-flag"></i> ${atleta.pais}`;
        metaEl.appendChild(tag);
    }

    const edad = calcularEdad(atleta?.fecha_nacimiento);
    if (edad) {
        const tag = document.createElement('span');
        tag.className = 'meta-tag';
        tag.innerHTML = `<i class="fas fa-birthday-cake"></i> ${edad} años`;
        metaEl.appendChild(tag);
    }

    if (atleta?.wa_id) {
        const tag = document.createElement('span');
        tag.className = 'meta-tag';
        tag.innerHTML = `<i class="fas fa-id-badge"></i> WA #${atleta.wa_id}`;
        if (atleta?.url_perfil) {
            tag.style.cursor = 'pointer';
            tag.title = 'Ver perfil en World Athletics';
            tag.onclick = () => window.open(atleta.url_perfil, '_blank');
        }
        metaEl.appendChild(tag);
    }

    // Disciplina principal (la de mayor puntuación)
    const marcas = atleta?.marcas_personales || [];
    const mejores = getDisciplinasPrincipales(marcas);
    if (mejores.length > 0) {
        const tag = document.createElement('span');
        tag.className = 'meta-tag';
        tag.innerHTML = `<i class="fas fa-running"></i> ${mejores[0].disciplina}`;
        metaEl.appendChild(tag);
    }
}

// --- STATS MINI ---
function renderStatsMini(atleta) {
    const marcas = atleta?.marcas_personales || [];
    const resultados = atleta?.resultados_recientes || [];
    const top10 = atleta?.top_10_historico || [];
    const progresion = atleta?.progresion_historica || [];

    // Número de disciplinas distintas con marca
    const disciplinas = new Set(marcas.filter(m => m.puntuacion > 0).map(m => m.disciplina));
    document.getElementById('stat-marcas').textContent = disciplinas.size || marcas.length;

    // Total competiciones (del top10 + resultados recientes deduplicados por fecha+competicion)
    const todasCompeticiones = new Set([
        ...top10.map(r => `${r.fecha}-${r.competicion}`),
        ...resultados.map(r => `${r.fecha}-${r.competicion}`)
    ]);
    document.getElementById('stat-competiciones-total').textContent = todasCompeticiones.size || '-';

    // Mejor puntuación histórica
    const mejorPuntuacion = Math.max(
        ...marcas.filter(m => m.puntuacion > 0).map(m => m.puntuacion),
        ...top10.filter(r => r.puntuacion > 0).map(r => r.puntuacion),
        0
    );
    if (mejorPuntuacion > 0) {
        // Buscar en qué disciplina fue
        const mejorMarca = [...marcas, ...top10].find(m => m.puntuacion === mejorPuntuacion);
        document.getElementById('stat-mejor-score').textContent = mejorPuntuacion;
        document.getElementById('stat-mejor-score-label').textContent = mejorMarca?.disciplina || 'World Athletics Score';
    } else {
        document.getElementById('stat-mejor-score').textContent = '-';
        document.getElementById('stat-mejor-score-label').textContent = 'World Athletics Score';
    }

    // Años de carrera (desde primera marca hasta hoy)
    if (progresion.length > 0) {
        const años = progresion.map(p => getAnio(p.fecha)).filter(Boolean);
        if (años.length > 0) {
            const min = Math.min(...años);
            const max = new Date().getFullYear();
            const temporadas = max - min + 1;
            document.getElementById('stat-temporadas').textContent = temporadas;
        }
    } else {
        document.getElementById('stat-temporadas').textContent = '-';
    }

    // Última actualización
    if (atleta?.ultima_actualizacion) {
        const d = new Date(atleta.ultima_actualizacion);
        document.getElementById('stat-ultima-actualizacion').textContent =
            d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } else {
        document.getElementById('stat-ultima-actualizacion').textContent = 'N/A';
    }
}

// --- TABLA DE MARCAS PERSONALES (mejorada) ---
function renderMarcasTabla(marcas) {
    const tbody = document.getElementById('pb-tbody');

    if (!marcas || marcas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="no-data-msg">
            <i class="fas fa-chart-line"></i>Sin marcas personales registradas.
            <a href="marcas.html" style="color:var(--accent-blue);">Añade tus marcas</a>
        </div></td></tr>`;
        return;
    }

    // Mostrar mejores por disciplina, ordenadas por puntuación
    const mejores = getMejoresPorDisciplina(marcas);

    tbody.innerHTML = mejores.map(m => {
        const tieneViento = m.viento && m.viento !== 'null';
        const puntuacionBadge = m.puntuacion > 0
            ? `<span style="background:rgba(0,112,243,0.1); color:#0070f3; padding:2px 8px; border-radius:8px; font-size:0.72rem; font-weight:700;">${m.puntuacion}</span>`
            : '';
        return `
        <tr>
            <td><strong style="color:#fff;">${m.disciplina || '-'}</strong></td>
            <td>
                <span class="mark-highlight">${m.marca || '-'}</span>
                ${tieneViento ? `<span style="color:#555; font-size:0.72rem; margin-left:4px;">(${m.viento})</span>` : ''}
            </td>
            <td style="font-size:0.82rem; color:#888; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.lugar || ''}">${m.lugar || '-'}</td>
            <td style="color:#666; font-size:0.82rem; white-space:nowrap;">${formatFecha(m.fecha)}</td>
            <td>${puntuacionBadge}</td>
        </tr>`;
    }).join('');
}

// --- TOP 10 HISTÓRICO ---
function renderTop10(top10) {
    const container = document.getElementById('top10-container');
    if (!container) return;

    if (!top10 || top10.length === 0) {
        container.innerHTML = `<div class="no-data-msg"><i class="fas fa-trophy"></i>Sin resultados top históricos registrados.</div>`;
        return;
    }

    container.innerHTML = top10.map((r, i) => {
        const posColor = i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : 'var(--accent-blue)';
        const puesto = r.puesto ? r.puesto.replace('.', '') : (i + 1);
        return `
        <div class="top10-item">
            <div class="top10-pos" style="color:${posColor}; background:${posColor}18; border-color:${posColor}44;">
                ${puesto}
            </div>
            <div class="top10-info">
                <div class="top10-disciplina">${r.disciplina || '-'}</div>
                <div class="top10-competicion" title="${r.competicion || ''}">${r.competicion || '-'}</div>
            </div>
            <div class="top10-right">
                <div class="top10-marca">${r.marca || '-'}</div>
                <div class="top10-fecha">${formatFecha(r.fecha)}</div>
            </div>
        </div>`;
    }).join('');
}

// --- MEJORES DE TEMPORADA ---
function renderMejoresTemporada(mejoresTemporada) {
    const container = document.getElementById('temporada-container');
    if (!container) return;

    if (!mejoresTemporada || mejoresTemporada.length === 0) {
        container.innerHTML = `<div class="no-data-msg"><i class="fas fa-calendar-star"></i>Sin mejores de temporada registradas.</div>`;
        return;
    }

    // Agrupar por año/temporada
    const porAnio = {};
    mejoresTemporada.forEach(m => {
        const anio = m.temporada || getAnio(m.fecha) || 'N/A';
        if (!porAnio[anio]) porAnio[anio] = [];
        porAnio[anio].push(m);
    });

    const aniosOrdenados = Object.keys(porAnio).sort((a, b) => b - a);

    container.innerHTML = aniosOrdenados.map(anio => `
        <div class="temporada-group">
            <div class="temporada-year-header">
                <span class="temporada-year">${anio}</span>
                <span class="temporada-count">${porAnio[anio].length} marca${porAnio[anio].length > 1 ? 's' : ''}</span>
            </div>
            ${porAnio[anio].map(m => `
            <div class="temporada-item">
                <div class="temporada-disciplina">${m.disciplina || '-'}</div>
                <div class="temporada-center">
                    <span style="font-size:0.78rem; color:#666;">${m.competicion ? truncar(m.competicion, 40) : ''}</span>
                </div>
                <div class="temporada-marca">${m.marca || '-'}</div>
            </div>`).join('')}
        </div>
    `).join('');
}

// --- PROGRESIÓN HISTÓRICA ---
function renderProgresion(progresion) {
    const container = document.getElementById('progresion-container');
    if (!container) return;

    if (!progresion || progresion.length === 0) {
        container.innerHTML = `<div class="no-data-msg"><i class="fas fa-chart-line"></i>Sin datos de progresión.</div>`;
        return;
    }

    // Agrupar por disciplina
    const porDisciplina = {};
    progresion.forEach(p => {
        const disc = p.disciplina;
        if (!porDisciplina[disc]) porDisciplina[disc] = [];
        porDisciplina[disc].push(p);
    });

    // Ordenar disciplinas por puntuación máxima
    const disciplinasOrdenadas = Object.keys(porDisciplina).sort((a, b) => {
        const maxA = Math.max(...porDisciplina[a].map(p => p.puntuacion || 0));
        const maxB = Math.max(...porDisciplina[b].map(p => p.puntuacion || 0));
        return maxB - maxA;
    });

    container.innerHTML = disciplinasOrdenadas.map(disc => {
        const entradas = porDisciplina[disc].sort((a, b) => {
            const ya = getAnio(a.fecha) || 0;
            const yb = getAnio(b.fecha) || 0;
            return ya - yb;
        });

        // Mini sparkline textual
        const marcasTexto = entradas.map(e =>
            `<div class="prog-entry">
                <span class="prog-anio">${getAnio(e.fecha) || '-'}</span>
                <span class="prog-marca">${e.marca || '-'}</span>
                <span class="prog-comp">${truncar(e.competicion || '', 35)}</span>
            </div>`
        ).join('');

        const mejorMarca = entradas.reduce((best, cur) => {
            if (!best) return cur;
            return (cur.puntuacion || 0) > (best.puntuacion || 0) ? cur : best;
        }, null);

        return `
        <div class="progresion-disciplina-card">
            <div class="prog-disc-header">
                <span class="prog-disc-name">${disc}</span>
                ${mejorMarca ? `<span class="prog-disc-best">Mejor: <strong>${mejorMarca.marca}</strong></span>` : ''}
            </div>
            <div class="prog-entries">${marcasTexto}</div>
        </div>`;
    }).join('');
}

// --- RESULTADOS RECIENTES ---
function renderResultadosRecientes(resultados) {
    const container = document.getElementById('recientes-container');
    if (!container) return;

    if (!resultados || resultados.length === 0) {
        container.innerHTML = `<div class="no-data-msg"><i class="fas fa-history"></i>Sin resultados recientes.</div>`;
        return;
    }

    const ordenados = [...resultados].sort((a, b) => {
        return new Date(b.fecha) - new Date(a.fecha);
    });

    container.innerHTML = ordenados.map(r => {
        const puesto = r.puesto ? r.puesto.replace('.', '') : '-';
        const esPodio = ['1', '2', '3'].includes(puesto);
        const puestoColor = puesto === '1' ? '#f59e0b' : puesto === '2' ? '#9ca3af' : puesto === '3' ? '#cd7f32' : '#555';

        return `
        <div class="reciente-item ${esPodio ? 'reciente-podio' : ''}">
            <div class="reciente-puesto" style="color:${puestoColor}; border-color:${puestoColor}44; background:${puestoColor}10;">
                ${esPodio && puesto === '1' ? '🥇' : esPodio && puesto === '2' ? '🥈' : esPodio && puesto === '3' ? '🥉' : `#${puesto}`}
            </div>
            <div class="reciente-info">
                <div class="reciente-disciplina">${r.disciplina || '-'}</div>
                <div class="reciente-competicion" title="${r.competicion || ''}">${truncar(r.competicion || '-', 55)}</div>
                <div class="reciente-lugar" style="font-size:0.72rem; color:#555; margin-top:2px;">
                    <i class="fas fa-map-marker-alt" style="font-size:0.6rem;"></i> ${r.lugar || '-'}
                </div>
            </div>
            <div class="reciente-right">
                <div class="reciente-marca">${r.marca || '-'}</div>
                ${r.viento ? `<div style="font-size:0.7rem; color:#555; text-align:right;">${r.viento}</div>` : ''}
                <div class="reciente-fecha">${formatFecha(r.fecha)}</div>
                ${r.puntuacion > 0 ? `<div style="font-size:0.7rem; color:#0070f3; text-align:right; margin-top:2px;">${r.puntuacion} pts</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

function truncar(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '...' : str;
}

// =============================================
// CARGAR PERFIL COMPLETO
// =============================================
async function cargarPerfil() {
    try {
        const session = window.currentSession;
        if (!session) return;

        const sc = window.supabaseClient;
        const uid = session.user.id;

        document.getElementById('inp-email').value = session.user.email || '';
        document.getElementById('hero-email').textContent = session.user.email || '';

        // Cargar profile y atleta en paralelo
        const [{ data: profile, error: pErr }, { data: atleta, error: aErr }] = await Promise.all([
            sc.from('profiles').select('*').eq('id', uid).single(),
            sc.from('atletas').select('*').eq('atleta_user_id', uid).single()
        ]);

        if (pErr && pErr.code !== 'PGRST116') throw pErr;
        if (aErr && aErr.code !== 'PGRST116') console.warn('Sin datos atleta:', aErr.message);

        _atletaData = atleta;

        // Rellenar formularios
        const nombre = atleta?.nombre || profile?.full_name?.split(' ')[0] || '';
        const apellido = atleta?.apellido || '';

        document.getElementById('inp-nombre').value = nombre;
        document.getElementById('inp-apellido').value = apellido;
        document.getElementById('inp-pais').value = atleta?.pais || '';
        document.getElementById('inp-genero').value = atleta?.genero || '';
        document.getElementById('inp-fecha-nac').value = atleta?.fecha_nacimiento
            ? atleta.fecha_nacimiento.substring(0, 10) : '';
        document.getElementById('inp-wa-id').value = atleta?.wa_id || profile?.wa_id || '';

        const redes = atleta?.redes_sociales || {};
        document.getElementById('inp-instagram').value = redes.instagram || '';
        document.getElementById('inp-twitter').value = redes.twitter || '';
        document.getElementById('inp-tiktok').value = redes.tiktok || '';
        document.getElementById('inp-youtube').value = redes.youtube || '';
        document.getElementById('inp-whatsapp').value = redes.whatsapp || '';
        document.getElementById('inp-website').value = redes.website || atleta?.url_perfil || '';

        // Guardar originales
        _originalInfoData = {
            nombre, apellido,
            pais: atleta?.pais || '',
            genero: atleta?.genero || '',
            fecha_nac: atleta?.fecha_nacimiento?.substring(0, 10) || ''
        };
        _originalSocialData = { ...redes };

        // Renderizar todas las secciones
        actualizarHero(atleta, session.user.email);
        renderStatsMini(atleta);
        renderMarcasTabla(atleta?.marcas_personales || []);
        renderTop10(atleta?.top_10_historico || []);
        renderMejoresTemporada(atleta?.mejores_temporada || []);
        renderProgresion(atleta?.progresion_historica || []);
        renderResultadosRecientes(atleta?.resultados_recientes || []);

    } catch (err) {
        console.error('Error cargando perfil:', err);
        showToast('Error cargando el perfil. Inténtalo de nuevo.', 'error');
    }
}

// =============================================
// GUARDAR INFORMACIÓN PERSONAL
// =============================================
document.getElementById('btn-save-info').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-info');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const sc = window.supabaseClient;
        const uid = window.currentSession.user.id;
        const nombre = document.getElementById('inp-nombre').value.trim();
        const apellido = document.getElementById('inp-apellido').value.trim();
        const pais = document.getElementById('inp-pais').value.trim();
        const genero = document.getElementById('inp-genero').value;
        const fechaNac = document.getElementById('inp-fecha-nac').value;
        const nombreCompleto = `${nombre} ${apellido}`.trim();

        await sc.from('profiles').update({ full_name: nombreCompleto }).eq('id', uid);

        if (_atletaData) {
            await sc.from('atletas').update({
                nombre, apellido,
                nombre_completo: nombreCompleto,
                pais, genero,
                fecha_nacimiento: fechaNac || null
            }).eq('atleta_user_id', uid);

            // Actualizar caché local
            _atletaData = { ..._atletaData, nombre, apellido, nombre_completo: nombreCompleto, pais, genero, fecha_nacimiento: fechaNac };
        }

        _originalInfoData = { nombre, apellido, pais, genero, fecha_nac: fechaNac };
        actualizarHero(_atletaData, window.currentSession.user.email);
        showToast('Información personal actualizada correctamente', 'success');
    } catch (err) {
        console.error(err);
        showToast('Error al guardar la información: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
});

document.getElementById('btn-cancel-info').addEventListener('click', () => {
    if (!_originalInfoData) return;
    document.getElementById('inp-nombre').value = _originalInfoData.nombre;
    document.getElementById('inp-apellido').value = _originalInfoData.apellido;
    document.getElementById('inp-pais').value = _originalInfoData.pais;
    document.getElementById('inp-genero').value = _originalInfoData.genero;
    document.getElementById('inp-fecha-nac').value = _originalInfoData.fecha_nac;
    showToast('Cambios descartados', 'info');
});

// =============================================
// GUARDAR REDES SOCIALES
// =============================================
document.getElementById('btn-save-social').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-social');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const sc = window.supabaseClient;
        const uid = window.currentSession.user.id;

        const redes = {
            instagram: document.getElementById('inp-instagram').value.trim(),
            twitter: document.getElementById('inp-twitter').value.trim(),
            tiktok: document.getElementById('inp-tiktok').value.trim(),
            youtube: document.getElementById('inp-youtube').value.trim(),
            whatsapp: document.getElementById('inp-whatsapp').value.trim(),
            website: document.getElementById('inp-website').value.trim(),
        };
        Object.keys(redes).forEach(k => { if (!redes[k]) delete redes[k]; });

        if (_atletaData) {
            await sc.from('atletas').update({ redes_sociales: redes }).eq('atleta_user_id', uid);
            _atletaData = { ..._atletaData, redes_sociales: redes };
        }

        _originalSocialData = { ...redes };
        showToast('Redes sociales actualizadas correctamente', 'success');
    } catch (err) {
        console.error(err);
        showToast('Error al guardar redes: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Redes';
    }
});

document.getElementById('btn-cancel-social').addEventListener('click', () => {
    const r = _originalSocialData || {};
    document.getElementById('inp-instagram').value = r.instagram || '';
    document.getElementById('inp-twitter').value = r.twitter || '';
    document.getElementById('inp-tiktok').value = r.tiktok || '';
    document.getElementById('inp-youtube').value = r.youtube || '';
    document.getElementById('inp-whatsapp').value = r.whatsapp || '';
    document.getElementById('inp-website').value = r.website || '';
    showToast('Cambios descartados', 'info');
});

// =============================================
// CONTRASEÑA
// =============================================
document.getElementById('inp-password').addEventListener('input', function () {
    const val = this.value;
    const bar = document.getElementById('pass-strength-bar');
    const label = document.getElementById('pass-strength-label');
    if (!val) {
        bar.style.width = '0%'; label.textContent = 'Introduce una contraseña'; bar.style.background = '';
        return;
    }
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const configs = [
        { pct: '20%', color: '#ff4d4d', text: 'Muy débil' },
        { pct: '40%', color: '#ff8c00', text: 'Débil' },
        { pct: '60%', color: '#f59e0b', text: 'Aceptable' },
        { pct: '80%', color: '#3b82f6', text: 'Fuerte' },
        { pct: '100%', color: '#10b981', text: 'Muy fuerte' },
    ];
    const cfg = configs[Math.min(score - 1, 4)] || configs[0];
    bar.style.width = cfg.pct;
    bar.style.background = cfg.color;
    label.textContent = cfg.text;
    label.style.color = cfg.color;
});

document.getElementById('inp-password-confirm').addEventListener('input', function () {
    const pass = document.getElementById('inp-password').value;
    const matchLabel = document.getElementById('pass-match-label');
    matchLabel.style.display = 'block';
    if (!this.value) { matchLabel.style.display = 'none'; return; }
    if (this.value === pass) {
        matchLabel.textContent = '✓ Las contraseñas coinciden';
        matchLabel.style.color = '#10b981';
    } else {
        matchLabel.textContent = '✗ Las contraseñas no coinciden';
        matchLabel.style.color = '#ff4d4d';
    }
});

document.getElementById('toggle-pass').addEventListener('click', function () {
    const inp = document.getElementById('inp-password');
    const isText = inp.type === 'text';
    inp.type = isText ? 'password' : 'text';
    this.querySelector('i').className = isText ? 'far fa-eye' : 'far fa-eye-slash';
});

document.getElementById('btn-save-password').addEventListener('click', async () => {
    const pass = document.getElementById('inp-password').value;
    const confirm = document.getElementById('inp-password-confirm').value;
    const btn = document.getElementById('btn-save-password');

    if (!pass) { showToast('Introduce una nueva contraseña', 'error'); return; }
    if (pass.length < 8) { showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    if (pass !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';

    try {
        const { error } = await window.supabaseClient.auth.updateUser({ password: pass });
        if (error) throw error;
        document.getElementById('inp-password').value = '';
        document.getElementById('inp-password-confirm').value = '';
        document.getElementById('pass-strength-bar').style.width = '0%';
        document.getElementById('pass-strength-label').textContent = 'Introduce una contraseña';
        document.getElementById('pass-strength-label').style.color = '';
        document.getElementById('pass-match-label').style.display = 'none';
        showToast('Contraseña actualizada correctamente', 'success');
    } catch (err) {
        showToast('Error al cambiar contraseña: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-key"></i> Cambiar Contraseña';
    }
});

// =============================================
// GUARDAR TODO
// =============================================
document.getElementById('btn-save-all').addEventListener('click', () => {
    document.getElementById('btn-save-info').click();
    setTimeout(() => document.getElementById('btn-save-social').click(), 600);
});

// =============================================
// EXPORTAR DATOS (MEJORADO - incluye todo)
// =============================================
document.getElementById('btn-export-data').addEventListener('click', () => {
    if (!_atletaData) { showToast('No hay datos para exportar', 'error'); return; }

    const exportData = {
        exportado_en: new Date().toISOString(),
        version: '2.0',
        perfil: {
            nombre_completo: _atletaData.nombre_completo,
            email: window.currentSession?.user?.email,
            pais: _atletaData.pais,
            codigo_pais: _atletaData.codigo_pais,
            genero: _atletaData.genero,
            fecha_nacimiento: _atletaData.fecha_nacimiento,
            wa_id: _atletaData.wa_id,
            url_perfil_wa: _atletaData.url_perfil,
        },
        redes_sociales: _atletaData.redes_sociales || {},
        marcas_personales: _atletaData.marcas_personales || [],
        mejores_temporada: _atletaData.mejores_temporada || [],
        top_10_historico: _atletaData.top_10_historico || [],
        progresion_historica: _atletaData.progresion_historica || [],
        resultados_recientes: _atletaData.resultados_recientes || [],
        ultima_actualizacion_wa: _atletaData.ultima_actualizacion,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex_completo_${(_atletaData.nombre_completo || 'atleta').replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Datos completos exportados correctamente', 'success');
});

// =============================================
// ZONA DE PELIGRO
// =============================================
document.getElementById('btn-logout-all').addEventListener('click', async () => {
    const ok = await showConfirm(
        'Cerrar todas las sesiones',
        'Se cerrará tu sesión en todos los dispositivos. Tendrás que volver a autenticarte.'
    );
    if (!ok) return;
    try {
        await window.supabaseClient.auth.signOut({ scope: 'global' });
        showToast('Sesiones cerradas. Redirigiendo...', 'success');
        setTimeout(() => window.location.href = '../index.html', 1500);
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
});

document.getElementById('btn-delete-account').addEventListener('click', async () => {
    const ok = await showConfirm(
        'Eliminar cuenta permanentemente',
        'Esta acción borrará toda tu información, marcas y datos de competición de forma irreversible. ¿Estás completamente seguro?'
    );
    if (!ok) return;
    showToast('Para eliminar la cuenta, contacta con el administrador del club.', 'info', 6000);
});

// =============================================
// REFRESH
// =============================================
document.getElementById('btn-refresh').addEventListener('click', () => {
    showToast('Actualizando datos...', 'info', 1500);
    cargarPerfil();
});

// =============================================
// INIT — esperar a que auth-guard termine
// =============================================
function initWhenReady() {
    if (window.currentSession) {
        cargarPerfil();
    } else {
        setTimeout(initWhenReady, 150);
    }
}
initWhenReady();
