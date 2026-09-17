import webpush from 'web-push';

const ALLOWED_HOSTS = ['bagmancikuyumculuk.com.tr', 'www.bagmancikuyumculuk.com.tr', 'localhost', '127.0.0.1'];

function originAllowed(req) {
  const origin = req.headers.origin || '';
  if (!origin) return true;
  try { return ALLOWED_HOSTS.includes(new URL(origin).hostname.toLowerCase()); } catch { return false; }
}

function clean(value, limit = 240) {
  return String(value || '').trim().slice(0, limit);
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function verifyAdmin(token) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return false;
  const user = await response.json();
  const allowed = String(process.env.PUSH_ADMIN_EMAILS || 'bagmanciabdullah93@gmail.com').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(user.email && allowed.includes(user.email.toLowerCase()));
}

export default async function handler(req, res) {
  try {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  if (!originAllowed(req)) return res.status(403).json({ message: 'Origin denied' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) return res.status(503).json({ message: 'Push sunucu ayarları eksik.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyAdmin(token))) return res.status(403).json({ message: 'Admin yetkisi gerekli.' });

  const title = clean(req.body?.title, 120);
  const message = clean(req.body?.message, 1000);
  const url = clean(req.body?.url, 300) || '/index.html#duyurular';
  if (!title || !message) return res.status(400).json({ message: 'Başlık ve mesaj zorunlu.' });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subscriptionsResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, { headers: supabaseHeaders() });
  if (!subscriptionsResponse.ok) return res.status(502).json({ message: 'Push abonelikleri okunamadı.' });
  const subscriptions = await subscriptionsResponse.json();
  const payload = JSON.stringify({ title, body: message, url, icon: '/bk-logo.png', badge: '/bk-logo.png', tag: `announcement-${req.body?.announcementId || Date.now()}` });
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
      }
    }
  }));

    return res.status(200).json({ ok: true, sent, removed, failed: results.filter(result => result.status === 'rejected').length });
  } catch (error) {
    console.error('Push gönderim hatası:', error);
    return res.status(500).json({ message: `Push sunucu hatası: ${error.message || 'Bilinmeyen hata'}` });
  }
}
