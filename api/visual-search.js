const ALLOWED_HOSTS = ['bagmancikuyumculuk.com.tr', 'www.bagmancikuyumculuk.com.tr', 'localhost', '127.0.0.1'];

function originAllowed(req) {
  const origin = req.headers.origin || '';
  if (!origin) return true;
  try { return ALLOWED_HOSTS.includes(new URL(origin).hostname.toLowerCase()); }
  catch (error) { return false; }
}

function clean(value, limit = 180) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function parseJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Gemini JSON döndürmedi');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeAnalysis(input = {}) {
  const allowedCategories = ['bilezik', 'yuzuk', 'kolye', 'kupe', 'akitma', 'saat'];
  const allowedSubCategories = ['burma', 'kelepce', 'baget', 'urfa_akitmasi', 'frenk_bagi'];
  const category = clean(input.kategori, 40).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ğ/g, 'g');
  const subCategory = clean(input.altKategori, 60).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/\s+/g, '_');
  return {
    kategori: allowedCategories.includes(category) ? category : '',
    altKategori: allowedSubCategories.includes(subCategory) ? subCategory : '',
    ayar: ['22', '14'].includes(String(input.ayar)) ? String(input.ayar) : '',
    ozellikler: Array.isArray(input.ozellikler) ? input.ozellikler.map(value => clean(value, 80)).filter(Boolean).slice(0, 12) : [],
    aramaTerimleri: Array.isArray(input.aramaTerimleri) ? input.aramaTerimleri.map(value => clean(value, 80)).filter(Boolean).slice(0, 12) : []
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'Method not allowed' });
  if (!originAllowed(req)) return res.status(403).json({ ok: false, reason: 'Origin denied' });
  if (!process.env.GEMINI_API_KEY) return res.status(200).json({ ok: false, reason: 'GEMINI_API_KEY missing' });

  const image = String(req.body?.image || '');
  const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match || match[2].length > 8_000_000) return res.status(400).json({ ok: false, reason: 'Geçerli ve makul boyutta bir görsel gerekli.' });

  const prompt = `Sen Bağmancı Kuyumculuk görsel arama motorusun. Görseldeki baskın takı veya saat modelini incele. Sadece geçerli JSON döndür, markdown kullanma. kategori yalnızca bilezik, yuzuk, kolye, kupe, akitma, saat olabilir. altKategori yalnızca burma, kelepce, baget, urfa_akitmasi, frenk_bagi olabilir. ayar yalnızca 22 veya 14 olsun; emin değilsen boş string kullan. ozellikler ve aramaTerimleri kısa Türkçe diziler olsun. Şema: {"kategori":"","altKategori":"","ayar":"","ozellikler":[],"aramaTerimleri":[]}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 420, responseMimeType: 'application/json' }
    })
  });
  if (!response.ok) return res.status(502).json({ ok: false, reason: 'Görsel analiz servisi yanıt vermedi.' });
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join(' ').trim();
  try { return res.status(200).json({ ok: true, analysis: normalizeAnalysis(parseJson(text)) }); }
  catch (error) { return res.status(502).json({ ok: false, reason: 'Görsel analiz sonucu okunamadı.' }); }
}
