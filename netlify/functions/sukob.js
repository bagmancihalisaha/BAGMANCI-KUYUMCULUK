exports.handler = async function(event) {
  const isCount = event.queryStringParameters && event.queryStringParameters.type === 'count';
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
      return json({ error: true, message: `SUKOB HTTP ${response.status}` }, 502);
    }

    const body = await response.text();
    return {
      statusCode: 200,
      headers: headers(),
      body
    };
  } catch (error) {
    return json({ error: true, message: 'SUKOB canlı veri alınamadı' }, 502);
  }
};

function json(data, statusCode) {
  return {
    statusCode,
    headers: headers(),
    body: JSON.stringify(data)
  };
}

function headers() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  };
}
