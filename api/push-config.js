const ALLOWED_HOSTS = ['bagmancikuyumculuk.com.tr', 'www.bagmancikuyumculuk.com.tr', 'localhost', '127.0.0.1'];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ message: 'Push bildirim ayarı eksik.' });
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}
