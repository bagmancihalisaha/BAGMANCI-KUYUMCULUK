const DEFAULT_MODEL = 'gemini-3.6-flash';

function failure(code, reason, status = 502) {
  return Object.assign(new Error(reason), { code, status });
}

export function geminiFailure(error, res) {
  const code = error.code || 'AI_UNAVAILABLE';
  console.warn('Gemini request failed', { code, status: error.status || 502 });
  return res.status(error.status || 502).json({
    ok: false, code,
    reason: error.code ? error.message : 'Yapay zeka servisine ulaşılamadı. Lütfen tekrar deneyin.'
  });
}

export async function generateGemini({ model, contents, generationConfig, systemInstruction }) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '').trim();
  if (!apiKey) throw failure('AI_NOT_CONFIGURED', 'Yapay zeka bağlantısı henüz yapılandırılmamış.', 503);
  const requestedModel = (model || DEFAULT_MODEL).trim().replace(/^models\//, '');
  const models = [...new Set([requestedModel, DEFAULT_MODEL])];
  const signal = AbortSignal.timeout(25000);
  for (const currentModel of models) {
    let response;
    let data;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents, systemInstruction,
          generationConfig: {
            ...generationConfig, maxOutputTokens: 2048,
            ...(currentModel === DEFAULT_MODEL ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {})
          }
        })
      });
      data = await response.json();
    } catch (error) {
      if (signal.aborted) throw failure('AI_TIMEOUT', 'Analiz zaman aşımına uğradı. Lütfen tekrar deneyin.', 504);
      throw failure('AI_UNAVAILABLE', 'Yapay zeka servisine ulaşılamadı. Lütfen tekrar deneyin.');
    }
    if (!response.ok) {
      // Retry retired model overrides once with the supported default.
      if (response.status === 404 && currentModel !== DEFAULT_MODEL) continue;
      if (response.status === 404) throw failure('AI_MODEL_UNAVAILABLE', 'Yapay zeka modeli şu an kullanılamıyor.');
      if (response.status === 429) throw failure('AI_QUOTA', 'Yapay zeka kullanım sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.', 429);
      const invalidKey = data?.error?.details?.some(detail => /API_KEY/.test(detail.reason || ''));
      if (invalidKey || [401, 403].includes(response.status)) throw failure('AI_AUTH', 'Yapay zeka bağlantısı doğrulanamadı.', 503);
      throw failure('AI_PROVIDER_ERROR', 'Yapay zeka servisi isteği işleyemedi.');
    }
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') throw failure('AI_INCOMPLETE', 'Analiz tamamlanamadı. Lütfen tekrar deneyin.');
    const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join(' ').trim();
    if (!text) throw failure('AI_EMPTY_RESPONSE', 'Bu istek için bir yanıt üretilemedi. Lütfen başka bir fotoğraf veya soru deneyin.', 422);
    return text;
  }
}
