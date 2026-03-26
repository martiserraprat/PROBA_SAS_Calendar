/**
 * vinculaciones.js
 * Lee wa_id directamente del campo en el JSON.
 * Busca en Supabase `atletas` por ese wa_id para encontrar candidatos.
 * Muestra el estado de vinculación y permite Desvincular.
 */

let managerProfile = null;
let atletasJSON    = [];
let candidatos     = {};  // { wa_id: [rows de supabase] }

// ─── 1. INICIALIZACIÓN ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initVinculaciones();
});

async function initVinculaciones() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { mostrarError('No hay sesión activa. Por favor, inicia sesión.'); return; }

        const { data: perfil, error } = await supabaseClient
            .from('profiles').select('*').eq('id', session.user.id).single();

        if (error || !perfil) { mostrarError('No se encontró tu perfil. Ve a Ajustes.'); return; }
        if (!perfil.is_verified) { mostrarError('Perfil no verificado. Ve a Ajustes para vincular tu cuenta.'); return; }

        managerProfile = perfil;
        const nameEl = document.querySelector('.user-name');
        const roleEl = document.querySelector('.user-role');
        if (nameEl) nameEl.innerText = perfil.full_name;
        if (roleEl) roleEl.innerText = 'Manager Oficial';

        await cargarDatos();

    } catch (err) {
        mostrarError('Error al inicializar: ' + err.message);
    }
}

// ─── 2. CARGA DE DATOS ─────────────────────────────────────────────────────
async function cargarDatos() {
    renderSkeletons(5);
    try {
        atletasJSON = await obtenerAtletasDelJSON();
        if (!atletasJSON.length) { mostrarError('No tienes atletas en el JSON.'); return; }
        await cargarCandidatosDeSupabase();
        renderVinculaciones();
    } catch (err) {
        mostrarError('Error cargando datos: ' + err.message);
    }
}

async function obtenerAtletasDelJSON() {
    const cached = sessionStorage.getItem('misAtletas');
    if (cached) return JSON.parse(cached);

    const response = await fetch('./json/datos_world_athletics.json');
    if (!response.ok) throw new Error('No se encontró el archivo JSON.');

    const agentes = await response.json();
    const nombreManager = managerProfile.full_name.trim().toLowerCase();

    let encontrados = [];
    agentes.forEach(ag => {
        if (ag.name.trim().toLowerCase() === nombreManager && ag.athletes) {
            encontrados = [...encontrados, ...ag.athletes];
        }
    });

    if (encontrados.length) sessionStorage.setItem('misAtletas', JSON.stringify(encontrados));
    return encontrados;
}

async function cargarCandidatosDeSupabase() {
    candidatos = {};

    const waIds = atletasJSON
        .map(a => parseInt(a.wa_id))
        .filter(id => !isNaN(id));

    atletasJSON.forEach(a => { if (a.wa_id != null) candidatos[a.wa_id] = []; });

    if (!waIds.length) { console.warn('⚠️ Ningún atleta tiene wa_id en el JSON.'); return; }

    const { data, error } = await supabaseClient
        .from('atletas')
        .select('id, wa_id, nombre_completo, pais, manager_id, atleta_user_id')
        .in('wa_id', waIds);

    if (error) { console.warn('Error en Supabase:', error); return; }

    const uids = (data || []).filter(r => r.atleta_user_id).map(r => r.atleta_user_id);
    let correos = {};
    if (uids.length) {
        const { data: profs } = await supabaseClient
            .from('profiles').select('id, official_email').in('id', uids);
        (profs || []).forEach(p => { correos[p.id] = p.official_email || '—'; });
    }

    (data || []).forEach(row => {
        if (candidatos[row.wa_id] !== undefined) {
            candidatos[row.wa_id].push({
                ...row,
                correo: row.atleta_user_id ? (correos[row.atleta_user_id] || '—') : '—',
                aprobado: row.manager_id === managerProfile.id
            });
        }
    });
}

// ─── 3. RENDERIZADO ────────────────────────────────────────────────────────
function renderVinculaciones() {
    const lista = document.getElementById('vinc-list');
    lista.innerHTML = '';
    let vinculados = 0, pendientes = 0;

    atletasJSON.sort((a, b) => a.name.localeCompare(b.name));

    atletasJSON.forEach(at => {
        const waId  = at.wa_id;
        const cands = waId != null ? (candidatos[waId] || []) : [];
        const linked = cands.some(c => c.aprobado);

        if (linked) vinculados++; else pendientes++;

        let bClass, bIcon, bText;
        if (linked)           { bClass='linked';  bIcon='fa-check-circle';      bText='Vinculado'; }
        else if (cands.length){ bClass='partial'; bIcon='fa-clock';             bText='Esperando código'; }
        else                  { bClass='none';    bIcon='fa-minus-circle';      bText='Sin registro en BD'; }

        const block = document.createElement('div');
        block.className = 'athlete-vinc-block';
        block.dataset.waid = waId;

        block.innerHTML = `
            <div class="athlete-vinc-header" onclick="toggleBlock(this)">
                <div class="avh-left">
                    <div class="athlete-avatar">${at.name.charAt(0)}</div>
                    <div class="avh-info">
                        <div class="athlete-fullname">${at.name}</div>
                        <div class="athlete-meta">
                            <span><i class="fas fa-globe"></i> ${at.country||'?'}</span>
                            <span><i class="fas fa-${at.gender==='Man'?'mars':'venus'}"></i> ${at.gender==='Man'?'Hombre':'Mujer'}</span>
                            <span style="color:#0070f3"><i class="fas fa-id-badge"></i> ${waId!=null?`#${waId}`:'Sin ID'}</span>
                            <span><i class="fas fa-user-check"></i> ${cands.length} en BD</span>
                        </div>
                    </div>
                </div>
                <div class="avh-right">
                    <span class="vinc-status-badge ${bClass}"><i class="fas ${bIcon}"></i> ${bText}</span>
                    <i class="fas fa-chevron-down avh-chevron"></i>
                </div>
            </div>
            <div class="candidates-list">${renderCandidatos(waId, cands)}</div>
        `;
        lista.appendChild(block);
    });

    document.getElementById('stat-total').innerText   = atletasJSON.length;
    document.getElementById('stat-linked').innerText  = vinculados;
    document.getElementById('stat-pending').innerText = pendientes;
}

function renderCandidatos(waId, cands) {
    if (!cands.length) return `
        <div class="no-candidates">
            <i class="fas fa-user-slash"></i>
            Este atleta aún no se ha registrado en la plataforma APEX.
        </div>`;

    return cands.map(c => `
        <div class="candidate-row ${c.aprobado?'is-approved':''}" id="cand-row-${c.id}">
            <div class="cand-icon"><i class="fas fa-${c.aprobado?'check':'user'}"></i></div>
            <div class="cand-body">
                <div class="cand-name">${c.nombre_completo||'—'}</div>
                <div class="cand-details">
                    <span class="cand-detail highlight"><i class="fas fa-id-badge"></i> WA #${c.wa_id||'?'}</span>
                    <span class="cand-detail"><i class="fas fa-envelope"></i> ${c.correo}</span>
                    <span class="cand-detail"><i class="fas fa-globe"></i> ${c.pais||'?'}</span>
                    ${c.aprobado?`<span class="cand-detail badge-aprobado" style="color:#10b981"><i class="fas fa-shield-alt"></i> Vinculado a ti</span>`:''}
                </div>
            </div>
            <div class="cand-action" id="action-${c.id}">
                ${c.aprobado ? `
                    <button class="btn-approve unlink" onclick="desvincularAtleta('${c.id}',${waId})" id="btn-${c.id}">
                        <i class="fas fa-unlink"></i> Desvincular
                    </button>
                ` : `
                    <span style="font-size:0.75rem; color:#888; display:flex; align-items:center; gap:6px; padding-right: 15px;">
                        <i class="fas fa-clock"></i> Falta tu código
                    </span>
                `}
            </div>
        </div>`).join('');
}

// ─── 4. ACCIONES ───────────────────────────────────────────────────────────

// Ahora solo existe Desvincular, el atleta aprueba por su cuenta con el código
async function desvincularAtleta(atletaId, waId) {
    const btn = document.getElementById(`btn-${atletaId}`);
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Desvinculando...';

    try {
        const { error } = await supabaseClient.from('atletas')
            .update({ manager_id: null }).eq('id', atletaId);
        if (error) throw error;

        const cand = (candidatos[waId]||[]).find(c => c.id === atletaId);
        if (cand) cand.aprobado = false;

        actualizarFila(atletaId, waId, false);
        actualizarHeader(waId);
        recalcularStats();
        mostrarToast('Vinculación eliminada', 'info');

    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-unlink"></i> Desvincular';
        mostrarToast('Error: ' + err.message, 'error');
    }
}

// ─── 5. UI HELPERS ─────────────────────────────────────────────────────────
function actualizarFila(atletaId, waId, aprobado) {
    const row = document.getElementById(`cand-row-${atletaId}`);
    const actionDiv = document.getElementById(`action-${atletaId}`);
    if (!row || !actionDiv) return;

    row.className = `candidate-row ${aprobado?'is-approved':''}`;
    row.querySelector('.cand-icon').innerHTML = `<i class="fas fa-${aprobado?'check':'user'}"></i>`;

    const detalles = row.querySelector('.cand-details');
    const badge = detalles?.querySelector('.badge-aprobado');

    if (!aprobado) {
        if (badge) badge.remove();
        // Cambiamos el botón por el texto de que falta el código
        actionDiv.innerHTML = `
            <span style="font-size:0.75rem; color:#888; display:flex; align-items:center; gap:6px; padding-right: 15px;">
                <i class="fas fa-clock"></i> Falta tu código
            </span>
        `;
    }
}

function actualizarHeader(waId) {
    const block = document.querySelector(`.athlete-vinc-block[data-waid="${waId}"]`);
    if (!block) return;
    const cands  = candidatos[waId] || [];
    const linked = cands.some(c => c.aprobado);

    let bClass, bIcon, bText;
    if (linked)           { bClass='linked';  bIcon='fa-check-circle';      bText='Vinculado'; }
    else if (cands.length){ bClass='partial'; bIcon='fa-clock';             bText='Esperando código'; }
    else                  { bClass='none';    bIcon='fa-minus-circle';      bText='Sin registro en BD'; }

    const badge = block.querySelector('.vinc-status-badge');
    if (badge) { badge.className=`vinc-status-badge ${bClass}`; badge.innerHTML=`<i class="fas ${bIcon}"></i> ${bText}`; }
}

function recalcularStats() {
    let v=0, p=0;
    atletasJSON.forEach(a => {
        ((a.wa_id!=null && candidatos[a.wa_id]||[]).some(c=>c.aprobado)) ? v++ : p++;
    });
    document.getElementById('stat-linked').innerText  = v;
    document.getElementById('stat-pending').innerText = p;
}

function toggleBlock(h) { h.closest('.athlete-vinc-block').classList.toggle('open'); }

function renderSkeletons(n) {
    document.getElementById('vinc-list').innerHTML = Array(n).fill('<div class="skeleton-block"></div>').join('');
}

function mostrarError(msg) {
    document.getElementById('vinc-list').innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:#0f0f0f;border:1px dashed #333;border-radius:18px;color:#888;">
            <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:#444;margin-bottom:14px;display:block;"></i>
            <h3 style="color:#fff;margin:0 0 8px;">No se pudo cargar</h3>
            <p style="margin:0 0 20px;">${msg}</p>
            <a href="ajustes.html" class="btn-primary" style="display:inline-flex;text-decoration:none;width:auto;">Ir a Ajustes</a>
        </div>`;
    ['stat-total','stat-linked','stat-pending'].forEach(id => { const el=document.getElementById(id); if(el) el.innerText='—'; });
}

let toastTimer = null;
function mostrarToast(msg, tipo='success') {
    const toast=document.getElementById('vinc-toast'), msgEl=document.getElementById('toast-msg');
    const icons={success:'fa-check-circle',error:'fa-times-circle',info:'fa-info-circle'};
    toast.className=`vinc-toast ${tipo}`;
    toast.querySelector('i').className=`fas ${icons[tipo]||'fa-info-circle'}`;
    msgEl.innerText=msg; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('show'),3500);
}

async function recargarVinculaciones() {
    sessionStorage.removeItem('misAtletas');
    atletasJSON=[]; candidatos={};
    const btn=document.getElementById('btn-refresh');
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Cargando...';}
    await cargarDatos();
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-sync-alt"></i> Actualizar';}
}