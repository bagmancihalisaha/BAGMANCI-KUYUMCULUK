import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { generateGemini } from '../lib/gemini.js';
import visualSearch from '../api/visual-search.js';
import assistant from '../api/assistant.js';

const response = text => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] }));
const request = { contents: [{ parts: [{ text: 'test' }] }] };

test('Gemini request and endpoint regressions', async t => {
  process.env.GEMINI_API_KEY = 'test-secret';
  t.after(() => { delete process.env.GEMINI_API_KEY; });
  await t.test('default model, private header, and complete output budget', async t => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.match(url, /models\/gemini-3\.6-flash:generateContent$/);
      assert.ok(!url.includes('test-secret'));
      assert.equal(options.headers['x-goog-api-key'], 'test-secret');
      const config = JSON.parse(options.body).generationConfig;
      assert.equal(config.thinkingConfig.thinkingLevel, 'minimal');
      assert.equal(config.maxOutputTokens, 2048);
      return response('Yanıt');
    });
    assert.equal(await generateGemini(request), 'Yanıt');
  });
  await t.test('retired Vercel override retries only once', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
      calls.push(url);
      return calls.length === 1 ? new Response('{}', { status: 404 }) : response('OK');
    });
    assert.equal(await generateGemini({ ...request, model: 'gemini-2.5-flash' }), 'OK');
    assert.equal(calls.length, 2);
    assert.match(calls[1], /gemini-3\.6-flash/);
  });
  await t.test('quota and authentication failures have distinct codes without retries', async t => {
    for (const [status, code] of [[429, 'AI_QUOTA'], [403, 'AI_AUTH']]) {
      let calls = 0;
      t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}', { status }); });
      await assert.rejects(generateGemini(request), { code });
      assert.equal(calls, 1);
      t.mock.restoreAll();
    }
  });
  await t.test('network failure and missing key return controlled errors', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('network'); });
    await assert.rejects(generateGemini(request), { code: 'AI_UNAVAILABLE' });
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(generateGemini(request), { code: 'AI_NOT_CONFIGURED' });
    process.env.GEMINI_API_KEY = 'test-secret';
  });
  await t.test('busy model switches to the independent vision model', async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (++calls === 1) return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Overloaded' } }), { status: 503 });
      assert.match(url, /gemini-3\.5-flash-lite:generateContent$/);
      assert.deepEqual(JSON.parse(options.body).contents, request.contents);
      return response('Recovered');
    });
    assert.equal(await generateGemini(request), 'Recovered');
    assert.equal(calls, 2);
  });
  await t.test('missing models exhaust the finite fallback list', async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}', { status: 404 }); });
    await assert.rejects(generateGemini(request), { code: 'AI_MODEL_UNAVAILABLE' });
    assert.equal(calls, 2);
  });
  await t.test('permanent image rejection preserves status and redacts credentials in logs', async t => {
    const logs = [];
    t.mock.method(console, 'warn', (...args) => logs.push(args));
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response(JSON.stringify({ error: { message: 'Unable to decode image test-secret' } }), { status: 400 });
    });
    await assert.rejects(generateGemini(request), { code: 'AI_IMAGE_REJECTED', upstreamStatus: 400 });
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(logs).includes('test-secret'));
    assert.match(JSON.stringify(logs), /Unable to decode image/);
  });
  await t.test('persistent provider error stops after two attempts including non-JSON responses', async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('Bad gateway', { status: 502 }); });
    await assert.rejects(generateGemini(request), { code: 'AI_PROVIDER_BUSY', upstreamStatus: 502 });
    assert.equal(calls, 2);
  });
  await t.test('visual endpoint produces parsed JSON and assistant produces text', async t => {
    const analysis = { kategori: 'bilezik', altKategori: 'burma', ayar: '', ozellikler: ['örgü'], aramaTerimleri: ['burma'] };
    t.mock.method(globalThis, 'fetch', async (_, options) => response(JSON.parse(options.body).generationConfig.responseMimeType ? JSON.stringify(analysis) : 'Burma bilezik modelini inceleyebilirsiniz.'));
    function res() { return { setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
    const visualResult = res();
    await visualSearch({ method: 'POST', headers: {}, body: { image: 'data:image/jpeg;base64,YQ==' } }, visualResult);
    assert.equal(visualResult.statusCode, 200);
    assert.deepEqual(visualResult.body.analysis, analysis);
    const assistantResult = res();
    await assistant({ method: 'POST', headers: {}, body: { question: 'Bilezik önerir misiniz?' } }, assistantResult);
    assert.equal(assistantResult.statusCode, 200);
    assert.match(assistantResult.body.answer, /Burma/);
  });
});

test('all inline scripts parse and assistant answer remains visible', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/src=|application\/ld\+json/.test(match[1]) || !match[2].trim()) continue;
    new vm.Script(match[2]);
  }
  const start = html.indexOf('async function submitAssistantQuestion()');
  const end = html.indexOf('function showCartStep(', start);
  const handler = html.slice(start, end);
  assert.match(handler, /answerBox\.classList\.add\('active'\)/);
  assert.ok(!handler.includes("openAccountSection('home')"));
});
