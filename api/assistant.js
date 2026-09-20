const ALLOWED_HOSTS = ['bagmancikuyumculuk.com.tr', 'www.bagmancikuyumculuk.com.tr', 'localhost', '127.0.0.1'];

function originAllowed(req) {
  const origin = req.headers.origin || '';
  if (!origin) return true;
  try { return ALLOWED_HOSTS.includes(new URL(origin).hostname.toLowerCase()); }
  catch (error) { return false; }
}

function clean(value, limit = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: true, message: 'Method not allowed' });
  if (!originAllowed(req)) return res.status(403).json({ error: true, message: 'Origin denied' });
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, reason: 'GEMINI_API_KEY missing' });

  const question = clean(req.body?.question, 700);
  const products = Array.isArray(req.body?.products) ? req.body.products.slice(0, 30) : [];
  const productLines = products.map(item => `- ${clean(item.name, 120)} | ${clean(item.category, 80)} | ${clean(item.sku || item.id, 80)}`).join('\n');
  const prompt = `Bağmancı Kuyumculuk sitesinde müşteriye yardımcı ol. Sadece aşağıdaki ürün listesine göre kısa, net Türkçe öneri ver. Ürün yoksa mağazaya yazmasını söyle.\n\nMüşteri isteği: ${question}\n\nÜrünler:\n${productLines}`;

  const model = process.env.GEMINI_ASSISTANT_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.35, maxOutputTokens: 220 } })
  });
  if (!response.ok) return res.status(200).json({ ok: false, reason: await response.text().catch(() => 'Gemini failed') });
  const data = await response.json();
  const answer = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join(' ').trim() || '';
  return res.status(200).json({ ok: Boolean(answer), answer });
}
