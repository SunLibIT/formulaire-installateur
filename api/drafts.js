// /api/drafts.js — Proxy Airtable des brouillons SunLib (le token reste côté serveur).
// Base par défaut : appmroXyuCrYwDbM7. Tables "Particulier" et "Pro" selon le type.
// Variables d'environnement Vercel :
//   AIRTABLE_TOKEN    = Personal Access Token (scopes data.records:read + data.records:write, accès à la base)
//   AIRTABLE_BASE_ID  = (optionnel) def. appmroXyuCrYwDbM7
//   ALLOW_ORIGIN      = (optionnel) origine Softr autorisée (CORS) ; sinon "*"
//
//   GET    /api/drafts?email=...        → dossiers « En cours » de cet email (Particulier + Pro)
//   POST   /api/drafts   (body = payload) → upsert sur « ID Brouillon » dans la bonne table
//   DELETE /api/drafts?id=rec...&type=part|pro → supprime le brouillon

const AT = 'https://api.airtable.com/v0';
const BASE = process.env.AIRTABLE_BASE_ID || 'appmroXyuCrYwDbM7';
const TOKEN = process.env.AIRTABLE_TOKEN;
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

// Vérification IA de la pièce d'identité (CNI) — webhook n8n (Claude vision). Secrets côté serveur.
const N8N_ID_URL = process.env.N8N_ID_WEBHOOK_URL || '';
const N8N_ID_HEADER = process.env.N8N_ID_WEBHOOK_HEADER || 'x-sl-secret';
const N8N_ID_SECRET = process.env.N8N_ID_WEBHOOK_SECRET || '';

// La vérification IA (upload + appel Claude via n8n) peut dépasser 10 s → on relève la limite Vercel.
export const maxDuration = 60;

const TABLES = { part: 'Particulier', pro: 'Pro' };
const STATUT = { draft: 'En cours', submitted: 'Soumis' };
const TYPE_LABEL = { pv: 'PV seul', pvbv: 'PV + Batterie Virtuelle', pvb: 'PV + Batterie physique', bat: 'Batterie seule' };

function tbl(name) { return AT + '/' + BASE + '/' + encodeURIComponent(name); }
function fmtDM(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
function num(x) { var n = parseFloat(x); return isFinite(n) ? n : null; }
function esc(s) { return String(s == null ? '' : s).replace(/'/g, "\\'"); }

// payload (état du dossier) -> champs Airtable de la bonne table
function fieldsFromPayload(p) {
  var ins = p.installation || {}, adr = p.adresse || {}, m = p.mensualite_estimee || {};
  var f = {
    'ID Brouillon': String(p.draftId || ''),
    'Email Installateur': String(p.email_installateur || ''),
    'Statut': STATUT[p.status] || 'En cours',
    'Étape atteinte': Number(p.step || 1),
    'Adresse Installation': [adr.numero, adr.rue].filter(Boolean).join(' '),
    'Commune': adr.commune || '',
    'Type Installation': TYPE_LABEL[ins.type] || '',
    'Durée Abonnement': ins.duree || '',
    'Mensualité estimée HT': num(m.ht),
    'Données JSON': JSON.stringify(p),
    'Dernière modif': p.updatedAt || new Date().toISOString()
  };
  if (p.type_client === 'pro') {
    var e = p.entreprise || {};
    f['Raison Sociale'] = e.nom || '';
    f['SIREN'] = e.siret || '';
    f['Dirigeant'] = e.dirigeant || '';
  } else {
    var a = (p.abonnes && p.abonnes[0]) || {};
    var full = [a.prenom, a.nom].filter(Boolean).join(' ').trim();
    f['Nom Abonné 1'] = full;
    f['Email Abonné 1'] = a.email || '';
    f['Nom dossier'] = full || 'Dossier particulier';
    f['Mensualité estimée TTC'] = num(m.ttc);
  }
  // Verdict de validation documentaire (persisté pour le routage / la relecture).
  if (p.validation && typeof p.validation === 'object') {
    var SV = { conforme: 'Conforme', a_verifier: 'À vérifier', non_conforme: 'Non conforme' };
    if (p.validation.statutGlobal) f['Statut validation'] = SV[p.validation.statutGlobal] || 'À vérifier';
    f['Points bloquants'] = Array.isArray(p.validation.pointsBloquants) ? p.validation.pointsBloquants.join('\n') : String(p.validation.pointsBloquants || '');
    f['Rapport validation'] = JSON.stringify(p.validation.rapport || p.validation);
    f['Validé le'] = new Date().toISOString();
  }
  return f;
}

function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

// GET Airtable robuste : retente sur erreurs TRANSITOIRES (429 rate-limit, 5xx, réseau)
// et PROPAGE l'erreur si tout échoue — pour ne jamais confondre « échec » et « liste vide ».
async function atGet(url, tries) {
  tries = tries || 3;
  var lastErr;
  for (var i = 0; i < tries; i++) {
    var r;
    try {
      r = await fetch(url, { headers: H });
    } catch (netErr) {                       // erreur réseau → transitoire
      lastErr = netErr;
      if (i < tries - 1) await sleep(350 * (i + 1));
      continue;
    }
    if (r.ok) return await r.json();
    var body = ''; try { body = await r.text(); } catch (e) {}
    if (r.status !== 429 && r.status < 500) {  // 4xx (hors 429) = définitif : on arrête
      throw new Error('Airtable ' + r.status + ': ' + body);
    }
    lastErr = new Error('Airtable ' + r.status + ': ' + body);   // 429 / 5xx → on retente
    if (i < tries - 1) await sleep(350 * (i + 1));
  }
  throw lastErr || new Error('Airtable: échec après ' + tries + ' tentatives');
}

async function findId(table, draftId) {
  draftId = String(draftId || '').trim();
  if (!draftId) return null;   // ID vide → NE PAS matcher (sinon {ID Brouillon}='' accroche tout record à ID vide → écrasement)
  var formula = encodeURIComponent("{ID Brouillon}='" + esc(draftId) + "'");
  var d = await atGet(tbl(table) + '?maxRecords=1&filterByFormula=' + formula);   // throw → upsert ne crée pas de doublon par erreur
  return (d.records && d.records[0]) ? d.records[0].id : null;
}

async function listByEmail(table, type, email) {
  var formula = encodeURIComponent("AND(LOWER({Email Installateur})='" + esc(email) + "',{Statut}='En cours')");
  var d = await atGet(tbl(table) + '?pageSize=50&filterByFormula=' + formula);   // throw sur échec persistant (≠ [])
  return (d.records || []).map(function (rec) {
    var f = rec.fields || {};
    var data = null;
    try { if (f['Données JSON']) data = JSON.parse(f['Données JSON']); } catch (e) { data = null; }
    return {
      id: rec.id, draftId: f['ID Brouillon'] || '', type: type, status: 'draft',
      name: (type === 'pro' ? f['Raison Sociale'] : (f['Nom dossier'] || f['Nom Abonné 1'])) || 'Dossier',
      ville: f['Commune'] || '', cp: '',
      instType: f['Type Installation'] || '', duree: f['Durée Abonnement'] || '',
      step: f['Étape atteinte'] || 1, modif: fmtDM(f['Dernière modif']),
      data: data   // payload complet → restauration intégrale du dossier à la reprise
    };
  });
}

// ── Table Sessions : 1 enregistrement par email installateur, qui agrège ses brouillons ──
function simplifyUA(ua) {
  ua = String(ua || '');
  var os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  var br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' · ') || (ua ? ua.slice(0, 60) : '');
}

async function findSession(email) {
  var formula = encodeURIComponent("LOWER({Email})='" + esc(email) + "'");
  var r = await fetch(tbl('Sessions') + '?maxRecords=1&filterByFormula=' + formula, { headers: H });
  var d = await r.json();
  return (r.ok && d.records && d.records[0]) ? d.records[0] : null;
}

// Upsert d'une session (clé = Email) ; journalise Date accès + Device.
// Si link={type,draftRecId} fourni, ajoute le brouillon au champ de liens correspondant (sans écraser les autres).
// Best-effort : toute erreur est avalée pour ne jamais casser la requête principale.
async function touchSession(email, device, link) {
  if (!email) return;
  try {
    var existing = await findSession(email);
    var fields = { 'Email': email, 'Date accès': new Date().toISOString() };
    if (device) fields['Device'] = device;
    if (link && link.draftRecId) {
      var linkField = link.type === 'pro' ? 'ID Brouillon Pro' : 'ID Brouillon Particulier';
      var cur = (existing && existing.fields && existing.fields[linkField]) || [];
      var ids = cur.map(function (x) { return (x && x.id) ? x.id : x; });
      if (ids.indexOf(link.draftRecId) === -1) ids.push(link.draftRecId);
      fields[linkField] = ids;
    }
    if (existing) {
      await fetch(tbl('Sessions'), { method: 'PATCH', headers: H, body: JSON.stringify({ records: [{ id: existing.id, fields: fields }] }) });
    } else {
      await fetch(tbl('Sessions'), { method: 'POST', headers: H, body: JSON.stringify({ records: [{ fields: fields }] }) });
    }
  } catch (e) { /* journalisation best-effort */ }
}

// ── Documents → table dédiée « Documents » (1 ligne = 1 fichier, liée au dossier) ──
const CONTENT = 'https://content.airtable.com/v0';
const DOCS_TABLE = 'Documents';
const DOCS_FILE_FIELD = 'fldx0yxmkJ90wRfxl';   // champ « Fichier » (pièce jointe) de la table Documents
// Type (single-select de la table Documents) déduit de la clé du document.
const TYPE_BY_KEY = {
  maps: 'Google Maps', 'map-pro': 'Google Maps',
  calep: 'Étude installateur', 'cal-pro': 'Étude installateur',
  devis: 'Devis', 'dev-pro': 'Devis',
  impots: "Avis d'imposition",
  elec: 'Facture énergie',
  prop: 'Titre de propriété', 'prop-pro': 'Titre de propriété',
  kbis: 'Kbis', 'kbis-prop': 'Kbis'
};
function typeForKey(key) {
  if (/^cni-(recto|verso)-/.test(String(key || ''))) return 'CNI';
  return TYPE_BY_KEY[key] || 'Autre';
}

// Trouve le record du brouillon, ou le crée a minima (pour pouvoir y attacher un fichier avant le 1er save).
async function ensureRecord(table, p) {
  var id = await findId(table, p.draftId);
  if (id) return id;
  var fields = {
    'ID Brouillon': String(p.draftId || ''),
    'Email Installateur': String(p.email_installateur || ''),
    'Statut': 'En cours',
    'Date création': new Date().toISOString(),
    'Dernière modif': new Date().toISOString()
  };
  var r = await fetch(tbl(table), { method: 'POST', headers: H, body: JSON.stringify({ records: [{ fields: fields }], typecast: true }) });
  var d = await r.json();
  return (r.ok && d.records && d.records[0]) ? d.records[0].id : null;
}

// Upload d'UN document → crée une ligne dans la table « Documents » (liée au dossier) + y attache le fichier.
// Renvoie l'id de la LIGNE (utilisé ensuite pour la lecture/retrait). prevId : ancienne ligne à supprimer (remplacement).
async function handleUpload(p, res) {
  if (!p.draftId || !p.dataBase64) return res.status(400).json({ error: 'draftId + dataBase64 requis' });
  var table = TABLES[p.type_client] || 'Particulier';
  var recId = await ensureRecord(table, p);   // dossier (pour le lien)
  if (!recId) return res.status(500).json({ error: 'dossier introuvable/non créé' });
  // 1) créer la ligne Documents (métadonnées + lien vers le dossier)
  var linkField = (p.type_client === 'pro') ? 'Dossier Pro' : 'Dossier Particulier';
  var rowFields = {
    'Nom': p.label || p.filename || 'document',
    'Type': typeForKey(p.key),
    'Portée': p.scope || (typeForKey(p.key) === 'CNI' ? 'Abonné' : 'Dossier'),
    'Abonné': p.abo || '',
    'Clé': String(p.key || ''),
    'ID Brouillon': String(p.draftId || ''),
    'Statut validation': 'Non vérifié'
  };
  rowFields[linkField] = [recId];
  var cr = await fetch(tbl(DOCS_TABLE), { method: 'POST', headers: H, body: JSON.stringify({ records: [{ fields: rowFields }], typecast: true }) });
  var cd = await cr.json();
  if (!cr.ok) return res.status(cr.status).json({ error: cd });
  var rowId = cd.records && cd.records[0] && cd.records[0].id;
  if (!rowId) return res.status(500).json({ error: 'ligne Documents non créée' });
  // 2) attacher le fichier à la ligne
  var filename = p.filename || 'document';
  var ur = await fetch(CONTENT + '/' + BASE + '/' + rowId + '/' + DOCS_FILE_FIELD + '/uploadAttachment', {
    method: 'POST', headers: H,
    body: JSON.stringify({ contentType: p.contentType || 'application/octet-stream', filename: filename, file: p.dataBase64 })
  });
  var ud = await ur.json();
  if (!ur.ok) {
    try { await fetch(tbl(DOCS_TABLE) + '/' + rowId, { method: 'DELETE', headers: H }); } catch (e) {}   // rollback de la ligne vide
    return res.status(ur.status).json({ error: ud });
  }
  if (p.prevId) { try { await fetch(tbl(DOCS_TABLE) + '/' + encodeURIComponent(p.prevId), { method: 'DELETE', headers: H }); } catch (e) {} }   // remplacement : supprime l'ancienne ligne
  return res.status(200).json({ ok: true, id: rowId, filename: filename });
}

// Détecte le vrai type MIME à partir des octets (magic bytes). Le contentType déclaré par Airtable/
// l'upload est parfois faux (ex. .png qui est en réalité un JPEG) → Claude rejette « media type mismatch ».
function sniffMedia(buf, fallback) {
  if (!buf || buf.length < 12) return fallback || 'application/octet-stream';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return fallback || 'application/octet-stream';
}

// Récupère les fichiers (par ids de LIGNES de la table Documents) et les renvoie en base64. Les URLs
// d'attachement Airtable sont signées et lues juste-à-temps. Client → proxy ne transporte que des ids.
async function filesFromIds(table, draftId, ids) {
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]; if (!id) continue;
    var gr = await fetch(tbl(DOCS_TABLE) + '/' + encodeURIComponent(id), { headers: H });
    if (!gr.ok) continue;
    var gd = await gr.json();
    var atts = (gd.fields && gd.fields['Fichier']) || [];
    var a = atts[0]; if (!a || !a.url) continue;
    var fr = await fetch(a.url); if (!fr.ok) continue;
    var buf = Buffer.from(await fr.arrayBuffer());
    out.push({ dataBase64: buf.toString('base64'), contentType: sniffMedia(buf, a.type), filename: a.filename || '' });   // type réel (magic bytes), pas le contentType déclaré
  }
  return out;
}

// ── Vérification IA des pièces d'identité (CNI) via un workflow n8n (Claude vision) ──
// Proxy : l'URL du webhook et le secret restent côté serveur (variables d'env Vercel).
// Reçoit soit { ids:[...] } (multi, résolus depuis Airtable), soit { dataBase64,... } (fallback 1 fichier).
// Renvoie TOUJOURS 200 avec un verdict JSON. En cas d'indisponibilité, { ok:false, ... } → le front
// NE bloque PAS la création (dégradé).
async function handleVerifyId(p, res) {
  if (!N8N_ID_URL) return res.status(200).json({ ok: false, erreur: 'non_configure', raison: 'Vérification IA non configurée.' });
  var table = TABLES[p.type_client] || 'Particulier';
  var files = [];
  try {
    if (Array.isArray(p.ids) && p.ids.length && p.draftId) {
      files = await filesFromIds(table, p.draftId, p.ids);
    } else if (p.dataBase64) {
      files = [{ dataBase64: p.dataBase64, contentType: p.contentType || 'application/octet-stream', filename: p.filename || '' }];
    }
  } catch (e) {
    return res.status(200).json({ ok: false, erreur: 'lecture', raison: 'Lecture des documents impossible.' });
  }
  if (!files.length) return res.status(200).json({ ok: false, erreur: 'aucun_fichier', raison: 'Aucun document à vérifier.' });
  // Pièces de référence (contrôle croisé, ex. calepinage pour Google Maps) — best-effort, ne bloque pas si indisponible.
  var refFiles = [];
  if (Array.isArray(p.refIds) && p.refIds.length && p.draftId) {
    try { refFiles = await filesFromIds(table, p.draftId, p.refIds); } catch (e) { refFiles = []; }
  }
  var headers = { 'Content-Type': 'application/json' };
  if (N8N_ID_SECRET) headers[N8N_ID_HEADER] = N8N_ID_SECRET;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 50000);
  try {
    var r = await fetch(N8N_ID_URL, {
      method: 'POST', headers: headers, signal: ctrl.signal,
      body: JSON.stringify({ files: files, refFiles: refFiles, abonnes: Array.isArray(p.abonnes) ? p.abonnes : [], docType: p.docType || 'CNI', form: (p.form && typeof p.form === 'object') ? p.form : {} })
    });
    if (!r.ok) {
      var t = ''; try { t = await r.text(); } catch (e) {}
      return res.status(200).json({ ok: false, erreur: 'n8n_' + r.status, raison: 'Service de vérification indisponible.', detail: String(t).slice(0, 200) });
    }
    var d = await r.json();
    return res.status(200).json(d && typeof d === 'object' ? d : { ok: false, erreur: 'reponse', raison: 'Réponse inattendue du service.' });
  } catch (e) {
    return res.status(200).json({ ok: false, erreur: 'reseau', raison: 'Vérification indisponible (réseau ou délai dépassé).' });
  } finally {
    clearTimeout(timer);
  }
}

// Retire UN document = supprime sa LIGNE dans la table « Documents » (par id de ligne).
async function handleRemoveDoc(p, res) {
  if (!p.id) return res.status(400).json({ error: 'id requis' });
  try {
    var pr = await fetch(tbl(DOCS_TABLE) + '/' + encodeURIComponent(p.id), { method: 'DELETE', headers: H });
    if (!pr.ok && pr.status !== 404) { var t = ''; try { t = await pr.text(); } catch (e) {} return res.status(pr.status).json({ error: t }); }
    return res.status(200).json({ ok: true });   // 404 = déjà supprimée → idempotent
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

const SV_ROW = { ok: 'Conforme', a_verifier: 'À vérifier', ko: 'Non conforme' };

// Écrit le verdict de validation sur des LIGNES Documents (par id) — appelé dès qu'une analyse IA se termine,
// pour persister le résultat sans attendre la création (et éviter de tout re-analyser à la reprise).
async function handleDocVerdict(p, res) {
  var items = Array.isArray(p.items) ? p.items : [];
  try {
    await Promise.all(items.map(function (d) {
      if (!d || !d.id) return null;
      var df = { 'Statut validation': SV_ROW[d.statut] || 'Non vérifié' };
      if (d.controles != null) df['Contrôles'] = (typeof d.controles === 'string') ? d.controles : JSON.stringify(d.controles);
      if (typeof d.confiance === 'number') df['Confiance'] = d.confiance;
      return fetch(tbl(DOCS_TABLE), { method: 'PATCH', headers: H, body: JSON.stringify({ records: [{ id: d.id, fields: df }], typecast: true }) }).catch(function () {});
    }));
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(200).json({ ok: false }); }
}

// Relit les verdicts déjà persistés d'un dossier (par ID Brouillon) → { docs:[{id, controles, statut}] }.
// Permet à la reprise de restaurer les verdicts sans relancer l'IA.
async function handleGetDocVerdicts(p, res) {
  var draftId = String(p.draftId || '').trim();
  if (!draftId) return res.status(200).json({ docs: [] });
  try {
    var formula = encodeURIComponent("{ID Brouillon}='" + esc(draftId) + "'");
    var d = await atGet(tbl(DOCS_TABLE) + '?pageSize=200&filterByFormula=' + formula);
    var out = (d.records || []).map(function (r) {
      var f = r.fields || {};
      var att = (Array.isArray(f['Fichier']) && f['Fichier'][0]) || {};
      return { id: r.id, cle: f['Clé'] || '', filename: att.filename || f['Nom'] || 'document', size: att.size || null, controles: f['Contrôles'] || '', statut: f['Statut validation'] || '' };
    });
    return res.status(200).json({ docs: out });
  } catch (e) { return res.status(200).json({ docs: [] }); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!TOKEN) return res.status(500).json({ error: 'AIRTABLE_TOKEN manquant (variable d\'environnement Vercel)' });

  try {
    if (req.method === 'GET') {
      var email = String(req.query.email || '').trim().toLowerCase();
      if (!email) return res.status(200).json({ dossiers: [] });
      var parts = await listByEmail('Particulier', 'part', email);
      var pros = await listByEmail('Pro', 'pro', email);
      await touchSession(email, simplifyUA(req.headers['user-agent']));   // journal d'accès (best-effort)
      return res.status(200).json({ dossiers: parts.concat(pros) });
    }

    if (req.method === 'POST') {
      var p = (typeof req.body === 'string') ? JSON.parse(req.body || '{}') : (req.body || {});
      if (p.action === 'verifyid') return handleVerifyId(p, res);   // vérification IA d'un document (n8n + Claude)
      if (p.action === 'removedoc') return handleRemoveDoc(p, res);   // suppression d'une ligne Documents
      if (p.action === 'upload') return handleUpload(p, res);   // upload d'un document → ligne Documents
      if (p.action === 'docverdict') return handleDocVerdict(p, res);   // persiste le verdict après analyse
      if (p.action === 'getdocverdicts') return handleGetDocVerdicts(p, res);   // relit les verdicts à la reprise
      if (!p.draftId) return res.status(400).json({ error: 'draftId requis' });
      var table = TABLES[p.type_client] || 'Particulier';
      var fields = fieldsFromPayload(p);
      var existing = await findId(table, p.draftId);
      var r;
      if (existing) {
        r = await fetch(tbl(table), { method: 'PATCH', headers: H, body: JSON.stringify({ records: [{ id: existing, fields: fields }], typecast: true }) });
      } else {
        fields['Date création'] = p.updatedAt || new Date().toISOString();
        r = await fetch(tbl(table), { method: 'POST', headers: H, body: JSON.stringify({ records: [{ fields: fields }], typecast: true }) });
      }
      var dd = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: dd });
      var recId = dd.records && dd.records[0] && dd.records[0].id;
      // Relier le brouillon a la session de l'installateur + journaliser l'acces (best-effort).
      await touchSession(String(p.email_installateur || '').trim().toLowerCase(), simplifyUA(req.headers['user-agent']), { type: p.type_client, draftRecId: recId });
      // Statut de validation par document (sur chaque ligne Documents) — best-effort.
      if (Array.isArray(p.docStatuts) && p.docStatuts.length) {
        var SVROW = { ok: 'Conforme', a_verifier: 'À vérifier', ko: 'Non conforme' };
        await Promise.all(p.docStatuts.map(function (d) {
          if (!d || !d.id) return null;
          var df = { 'Statut validation': SVROW[d.statut] || 'Non vérifié' };
          if (d.controles != null) df['Contrôles'] = (typeof d.controles === 'string') ? d.controles : JSON.stringify(d.controles);
          if (typeof d.confiance === 'number') df['Confiance'] = d.confiance;
          return fetch(tbl(DOCS_TABLE), { method: 'PATCH', headers: H, body: JSON.stringify({ records: [{ id: d.id, fields: df }], typecast: true }) }).catch(function () {});
        }));
      }
      return res.status(200).json({ ok: true, id: recId });
    }

    if (req.method === 'DELETE') {
      var id = String(req.query.id || '');
      if (!id) return res.status(400).json({ error: 'id requis' });
      var only = TABLES[String(req.query.type || '')];
      var candidates = only ? [only] : ['Particulier', 'Pro'];
      for (var i = 0; i < candidates.length; i++) {
        var rr = await fetch(tbl(candidates[i]) + '/' + encodeURIComponent(id), { method: 'DELETE', headers: H });
        if (rr.ok) return res.status(200).json({ ok: true });
      }
      return res.status(404).json({ error: 'introuvable' });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
