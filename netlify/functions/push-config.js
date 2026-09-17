exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return json({ message: 'Method not allowed' }, 405);
  if (!process.env.VAPID_PUBLIC_KEY) return json({ message: 'Push sunucu ayarı eksik: VAPID_PUBLIC_KEY' }, 503);
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY }, 200);
};

function json(data, statusCode) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}
