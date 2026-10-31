export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upstream = url.pathname.includes('countseen')
      ? 'https://www.sukobfiyat.com/api/countseen/'
      : 'https://www.sukobfiyat.com/api/mainprice/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const response = await fetch(`${upstream}?cache=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  };
}
