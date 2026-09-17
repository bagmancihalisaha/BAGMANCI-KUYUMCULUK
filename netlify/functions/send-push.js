const webpush = require('web-push');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return response(204, '');
  if (event.httpMethod !== 'POST') return response(405, { message: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return response(503, { message: 'Push sunucu ayarları eksik. Netlify Environment Variables kontrol edilmeli.' });
  }
  const token = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyAdmin(token))) return response(403, { message: 'Admin yetkisi gerekli.' });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return response(400, { message: 'Geçersiz istek.' }); }
  const title = clean(body.title, 120);
  const message = clean(body.message, 1000);
  if (!title || !message) return response(400, { message: 'Başlık ve mesaj zorunlu.' });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subscriptionsResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, { headers: supabaseHeaders() });
  if (!subscriptionsResponse.ok) return response(502, { message: `Push abonelikleri okunamadı (${subscriptionsResponse.status}).` });
  const subscriptions = await subscriptionsResponse.json();
  const payload = JSON.stringify({ title, body: message, url: clean(body.url, 300) || '/index.html#duyurular', icon: '/bk-logo.png', badge: '/bk-logo.png', tag: `announcement-${body.announcementId || Date.now()}` });
  let sent = 0;
  let removed = 0;
  const results = await Promise.allSettled((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
      sent++;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE', headers: supabaseHeaders() });
        removed++;
      } else throw error;
    }
  }));
  return response(200, { ok: true, sent, removed, failed: results.filter(item => item.status === 'rejected').length });
};

async function verifyAdmin(token) {
  const result = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!result.ok) return false;
  const user = await result.json();
  const allowed = String(process.env.PUSH_ADMIN_EMAILS || 'bagmanciabdullah93@gmail.com').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(user.email && allowed.includes(user.email.toLowerCase()));
}

function supabaseHeaders() { return { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }; }
function clean(value, limit) { return String(value || '').trim().slice(0, limit); }
function response(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }, body: typeof body === 'string' ? body : JSON.stringify(body) }; }
