(() => {
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const style = document.createElement('style');
  style.textContent = `
    #bk-install-dialog{width:min(390px,calc(100% - 32px));max-height:85dvh;overflow:auto;padding:24px;border:1px solid #c8a345;border-radius:8px;background:#fffaf0;color:#104b3a;font:16px/1.6 Arial,sans-serif}
    #bk-install-dialog::backdrop{background:#0009}#bk-install-dialog img{display:block;width:92px;height:92px;border-radius:8px;margin:0 auto 12px}#bk-install-dialog h2{font-size:22px;text-align:center;color:#104b3a}#bk-install-dialog ol{padding-left:24px}#bk-install-dialog button{width:100%;padding:12px;background:#d4af37;color:#06251d;border:0;border-radius:8px;font-weight:700;cursor:pointer}
    #bk-opening{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#04130d;pointer-events:none;overflow:hidden}#bk-opening img{display:block;width:100%;height:100%;min-height:0;object-fit:contain;border-radius:0}#bk-opening.bk-ready{animation:bk-opening-out .5s ease 2s forwards}
    @media(max-width:600px){#bk-opening img{object-fit:cover}}
    @keyframes bk-opening-out{to{opacity:0;visibility:hidden}}@media(prefers-reduced-motion:reduce){#bk-opening{animation-duration:0s}}
  `;
  document.head.append(style);
  const debugMode = false; // TEST: true yapıp test et
  if (standalone() || debugMode) {
    let seen = false;
    // TEST MODE: Her açılışta göster (production'da comment'e al)
    try { seen = sessionStorage.getItem('bk-opening') === '1'; if (!debugMode) sessionStorage.setItem('bk-opening','1'); } catch {}
    if (!seen) {
      const opening = document.createElement('div'); opening.id = 'bk-opening';
      const logo = document.createElement('img'); logo.alt = 'BAĞMANCI Kuyumculuk'; logo.setAttribute('loading', 'eager'); logo.setAttribute('fetchpriority', 'high'); logo.setAttribute('decoding', 'sync');
      const failSafe = setTimeout(() => opening.remove(), 7000);
      logo.onload = () => {
        clearTimeout(failSafe);
        opening.classList.add('bk-ready');
        setTimeout(() => opening.remove(), 2500);
      };
      logo.onerror = () => { clearTimeout(failSafe); opening.remove(); };
      logo.src = 'assets/bk-acilis.webp';
      opening.append(logo); document.body.append(opening);
    }
  }
  let serviceWorkerRegistration;
  async function getPushConfig() {
    let response;
    try { response = await fetch('/api/push-config', { cache: 'no-store' }); } catch (error) { response = null; }
    if (!response || response.status === 404 || response.status >= 500) response = await fetch('/.netlify/functions/push-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Push ayarı alınamadı.');
    return response.json();
  }
  function decodeVapidKey(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  }
  async function setupPushNotifications(requestPermission = false) {
    if (!('serviceWorker' in navigator) || !window.isSecureContext || !('PushManager' in window) || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default' && requestPermission) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;
    }
    if (Notification.permission !== 'granted') return false;
    serviceWorkerRegistration ||= await navigator.serviceWorker.ready;
    const config = await getPushConfig();
    let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (!subscription) subscription = await serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(config.publicKey) });
    const json = subscription.toJSON();
    const supabaseConfig = window.BAGMANCI_SUPABASE || {};
    if (!supabaseConfig.url || !supabaseConfig.anonKey || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    const response = await fetch(`${supabaseConfig.url}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: 'POST',
      headers: { apikey: supabaseConfig.anonKey, Authorization: `Bearer ${supabaseConfig.anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, subscription: json, user_agent: navigator.userAgent })
    });
    if (!response.ok) throw new Error('Push aboneliği kaydedilemedi.');
    window.dispatchEvent(new CustomEvent('bk-push-ready'));
    return true;
  }
  window.BKPush = { setup: setupPushNotifications };
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(registration => {
        serviceWorkerRegistration = registration;
        if (Notification.permission === 'granted') return setupPushNotifications(false);
        return null;
      }).catch(error => console.warn('Uygulama desteği başlatılamadı.', error));
    });
  }
  let installEvent;
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = "BK’yı Yükle"; button.hidden = !ios || standalone();
  button.style.cssText = 'position:fixed;right:16px;bottom:92px;z-index:90;background:#d4af37;color:#06251d;border:1px solid #947422;border-radius:8px;padding:12px 16px;font:600 14px sans-serif;box-shadow:0 4px 16px #0003;cursor:pointer';
  document.body.append(button);
  function showIOSGuide() {
    let dialog = document.getElementById('bk-install-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'bk-install-dialog';
      dialog.setAttribute('aria-labelledby','bk-install-title');
      dialog.innerHTML = `<img src="bk-logo.png" alt="BK"><h2 id="bk-install-title">BK'yı Ana Ekrana Ekle</h2><ol><li>Safari'de <strong>Paylaş</strong> menüsünü aç.</li><li><strong>Ana Ekrana Ekle</strong> seçeneğine dokun.</li><li>Adı <strong>BK</strong> olarak bırak. Varsa <strong>Web Uygulaması Olarak Aç</strong> seçeneğini açıp <strong>Ekle</strong>ye dokun.</li></ol>`;
      const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Tamam'; close.onclick = () => dialog.close();
      dialog.append(close); document.body.append(dialog);
      dialog.addEventListener('close', () => button.focus());
    }
    dialog.showModal();
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installEvent = event;
    button.hidden = standalone();
  });
  button.onclick = async () => {
    if (!installEvent) { if (ios) showIOSGuide(); return; }
    button.hidden = true;
    try { await installEvent.prompt(); await installEvent.userChoice; }
    catch (error) { console.warn('Yükleme isteği açılamadı.', error); }
    finally { installEvent = null; }
  };
  window.addEventListener('appinstalled', () => { button.hidden = true; installEvent = null; });
  window.addEventListener('load', () => {
    setTimeout(() => { if ('Notification' in window && Notification.permission === 'default') setupPushNotifications(true).catch(() => {}); }, 1200);
  });
})();
