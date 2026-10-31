export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const isCount = req.query && req.query.type === 'count';
  const upstream = isCount
    ? 'https://www.sukobfiyat.com/api/countseen/'
    : 'https://www.sukobfiyat.com/api/mainprice/';

  try {
    const response = await fetch(`${upstream}?cache=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BagmanciKuyumculuk/1.0'
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        error: true,
        message: `SUKOB HTTP ${response.status}`
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      error: true,
      message: 'SUKOB canlı veri alınamadı'
    });
  }
}
