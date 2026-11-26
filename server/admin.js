// Admins: Benutzernamen (öffentlich, ADMIN_NAMES in wrangler.toml) + Admin-Code (geheim: GitHub-/Cloudflare-Secret ADMIN_CODE).
// Ein Admin muss mit einem Admin-Konto angemeldet sein UND den Admin-Code eingeben.
const cfg = { names: ['3fach3'], code: '' };

export function configureAdmin({ names, code } = {}) {
  if (names) cfg.names = String(names).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  cfg.code = code ? String(code) : '';
}
export const isAdminName = (login) => !!login && cfg.names.includes(String(login).toLowerCase());
export const adminEnabled = () => !!cfg.code;

// Vergleich ohne Zeitunterschiede
export function checkCode(code) {
  if (!cfg.code || typeof code !== 'string') return false;
  const a = cfg.code, b = code;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return diff === 0;
}

const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

// Nachricht des Tages + Wartungsmodus
export async function serverInfo(db) {
  const mt = parse(await db.getSetting('maintenance'));
  return {
    motd: (await db.getSetting('motd')) || '',
    maintenance: mt && mt.on ? { text: mt.text || 'Wartungsarbeiten – gleich geht es weiter!' } : null,
  };
}
