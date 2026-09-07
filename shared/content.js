export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function photoSource(photo) {
  const src = typeof photo === 'string' ? photo : photo?.url || photo?.img || '';
  if (typeof src === 'string' && src.startsWith('blob:')) return src;
  if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return src;
  try { const u = new URL(src); if (u.protocol === 'https:' || (['localhost','127.0.0.1'].includes(u.hostname) && u.protocol === 'http:')) return u.href; } catch {}
  return '';
}
export const normalizedPhoto = p => ({ ...(typeof p === 'object' ? p : {}), img: photoSource(p), desc: typeof p?.desc === 'string' ? p.desc : '' });
export function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
