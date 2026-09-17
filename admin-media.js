/* Media drafts retain originals so every crop can be edited again. */
const MediaAdmin = (() => {
  'use strict';
  let draft = [], busy = false;
  const slots = [
    ['hero:day', 'Gündüz vitrin görseli', 2.4],
    ['hero:night', 'Gece vitrin görseli', 2.4],
    ['background:day', 'Gündüz arka planı', 16 / 9],
    ['background:night', 'Gece arka planı', 16 / 9],
    ...['Yüzük','Küpe','Bilezik','Bileklik','Kolye','Madonna','Frenk Bağı','Urfa Akıtması','Saat','Aksesuar'].map(name => ['catalog:' + name, name + ' katalog kapağı', 4 / 3])
  ];
  const assets = new Map();
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function button(text, action, title) {
    const b = el('button', 'secondary', text);
    b.type = 'button'; b.onclick = action;
    b.title = title || text; b.setAttribute('aria-label', title || text);
    return b;
  }
  function message(text, bad = false) {
    const node = document.getElementById('media-message');
    if (!node) return;
    node.textContent = text; node.style.color = bad ? '#e96f75' : 'inherit';
  }
  function validate(file, video = true) {
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp', ...(video ? ['video/mp4','video/webm'] : [])];
    if (!allowed.includes((file.type || '').toLowerCase())) throw Error('JPG, PNG, WebP' + (video ? ', MP4 veya WebM' : '') + ' dosyası seçin.');
    if (file.size > (file.type.startsWith('video/') ? 50 : 15) * 1024 * 1024) throw Error('Fotoğraf en fazla 15 MB, video en fazla 50 MB olabilir.');
  }
  function entry(item) {
    return { ...item, type: item.type === 'video' ? 'video' : 'image', crop: { fit: 'cover', zoom: 1, x: 50, y: 50, ...(item.crop || {}) } };
  }
  function release(item) { if (item.local) URL.revokeObjectURL(item.local); }
  function reset() { draft.forEach(release); draft = []; render(); }
  function edit(product) {
    if (busy || (typeof savingProduct !== 'undefined' && savingProduct)) return;
    reset();
    const imgInp = document.getElementById('images');
    if (imgInp) imgInp.value = '';
    draft = (Array.isArray(product.media) && product.media.length ? product.media : (product.images || []).map(url => ({ url, type: 'image' }))).map(entry);
    render();
  }
  async function add(input) {
    if (busy) return;
    try {
      const files = [...input.files];
      if (draft.length + files.length > 20) throw Error('Bir ürüne en fazla 20 fotoğraf/video eklenebilir.');
      files.forEach(file => validate(file));
      files.forEach(file => draft.push(entry({ file, local: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image', dirty: true })));
      render();
    } catch (error) { 
      if (typeof setStatus === 'function') setStatus('save-status', error.message, 'err'); 
      else message(error.message, true);
    }
    input.value = '';
  }
  function geometry(iw, ih, w, h, c) {
    const scale = (c.fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)) * c.zoom;
    const dw = iw * scale, dh = ih * scale;
    return { x: (w - dw) * c.x / 100, y: (h - dh) * c.y / 100, w: dw, h: dh };
  }
  function editor(item, ratio) {
    const box = el('div', 'media-item');
    const stage = el('div', 'media-crop-stage'); stage.style.aspectRatio = ratio;
    box.append(stage);
    const source = item.local || item.original_url || item.url;
    if (item.type === 'video') {
      const v = el('video'); v.src = source; v.controls = true; v.playsInline = true; v.preload = 'metadata'; stage.append(v);
      return box;
    }
    const canvas = el('canvas'); canvas.width = 720; canvas.height = Math.round(720 / ratio); stage.append(canvas);
    const img = new Image();
    
    // Yalnızca dış sunuculardan gelen adresler için crossOrigin ayarlanır, yerel blob engellenmez
    if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }

    function draw() {
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#faf8f3'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!img.naturalWidth) return;
      const rect = geometry(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height, item.crop);
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    }
    img.onload = draw;
    img.onerror = () => { stage.replaceChildren(el('span', '', 'Görsel yüklenemedi. Dosyayı yeniden seçin.')); };
    img.src = source;

    const controls = el('div', 'media-controls');
    const fitLabel = el('label', '', 'Kadraj');
    const fit = el('select');
    for (const [value, label] of [['contain','Tamamını göster'],['cover','Alanı doldur']]) {
      const o = el('option', '', label); o.value = value; fit.append(o);
    }
    fit.value = item.crop.fit;
    fit.onchange = () => { item.crop.fit = fit.value; item.dirty = true; draw(); };
    fitLabel.append(fit); controls.append(fitLabel);
    for (const [key, label, min, max, step] of [['zoom','Yakınlaştır',1,3,.05],['x','Yatay konum',0,100,1],['y','Dikey konum',0,100,1]]) {
      const row = el('label', '', label), input = el('input');
      input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = item.crop[key];
      input.oninput = () => { item.crop[key] = Number(input.value); item.dirty = true; draw(); };
      row.append(input); controls.append(row);
    }
    controls.append(button('Sıfırla', () => { item.crop = { fit: 'cover', zoom: 1, x: 50, y: 50 }; item.dirty = true; box.replaceWith(editor(item, ratio)); }));
    box.append(controls);
    return box;
  }
  function render() {
    const root = document.getElementById('product-media-editor'); 
    if (!root) return;
    root.replaceChildren();
    draft.forEach((item, index) => {
      const card = el('div', 'media-draft');
      card.append(el('strong', '', `${index + 1}. ${item.type === 'video' ? 'Video' : 'Fotoğraf'}${index === draft.findIndex(i => i.type === 'image') ? ' · Ürün kapağı' : ''}`));
      card.append(editor(item, 1));
      const actions = el('div', 'media-actions');
      for (const [delta, symbol, name] of [[-1,'←','Öne taşı'],[1,'→','Arkaya taşı']]) {
        const b = button(symbol, () => { if (busy) return; [draft[index], draft[index + delta]] = [draft[index + delta], draft[index]]; render(); }, name);
        b.disabled = index + delta < 0 || index + delta >= draft.length; actions.append(b);
      }
      actions.append(button('×', () => { if (busy) return; release(item); draft.splice(index, 1); render(); }, 'Medyayı kaldır'));
      card.append(actions); root.append(card);
    });
  }
  async function upload(file, folder) {
    const type = (file.type || '').toLowerCase();
    const extMap = { 'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm' };
    const ext = extMap[type] || 'webp';
    // Klasör adlarındaki özel karakterleri ve iki noktayı temizle (S3/Supabase Storage uyumu)
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, '-');
    const path = `${cleanFolder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseClient.storage.from('product-images').upload(path, file, { contentType: type || 'image/webp', upsert: true });
    if (error) throw error;
    return supabaseClient.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }
  async function persist(item, folder, ratio) {
    if (!item.dirty && item.url) return clean(item);
    let original = item.original_url || item.url;
    if (item.file) { original = await upload(item.file, folder); item.original_url = original; item.file = null; }
    if (item.type === 'video') { item.url = original; item.dirty = false; return clean(item); }
    const img = new Image();
    const imgSrc = item.local || original;
    if (typeof imgSrc === 'string' && (imgSrc.startsWith('http://') || imgSrc.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }
    await new Promise((resolve, reject) => { 
      img.onload = resolve; 
      img.onerror = () => reject(Error('Kırpma için orijinal görsel yüklenemedi.')); 
      img.src = imgSrc; 
    });
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = Math.round(1600 / ratio);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#faf8f3'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const r = geometry(img.naturalWidth,img.naturalHeight,canvas.width,canvas.height,item.crop); ctx.drawImage(img,r.x,r.y,r.w,r.h);
    const blob = await new Promise((resolve, reject) => { 
      try { 
        canvas.toBlob(b => b ? resolve(b) : reject(Error('Görsel hazırlanamadı.')), 'image/webp', .92); 
      } catch (e) { reject(e); } 
    });
    item.url = await upload(blob, folder); item.original_url = original; item.dirty = false;
    return clean(item);
  }
  function clean(item) { return { url: item.url, original_url: item.original_url || item.url, type: item.type, crop: { ...item.crop } }; }
  async function save(id) {
    if (busy) throw Error('Yükleme devam ediyor.');
    busy = true;
    const editorEl = document.getElementById('product-media-editor');
    if (editorEl) editorEl.inert = true;
    try {
      const { error } = await supabaseClient.from('products').select('media').limit(0);
      if (error) throw Error('Medya alanı hazır değil. Önce supabase-media.sql güncellemesini uygulayın. ' + error.message);
      const result = [];
      for (const item of draft) result.push(await persist(item, 'products/' + encodeURIComponent(id), 1));
      return result;
    } finally { 
      busy = false; 
      if (editorEl) editorEl.inert = false; 
    }
  }
  async function loadSite() {
    showSiteSection('menu');
    message('Görseller yükleniyor...');
    const { data, error } = await supabaseClient.from('site_assets').select('*');
    if (error) { message('Site görselleri yüklenemedi: ' + error.message, true); return; }
    assets.forEach(release); assets.clear();
    for (const row of data || []) assets.set(row.key, entry(row));
    for (const mode of ['day', 'night']) {
      if (!assets.has('hero:' + mode) && assets.has('hero:main')) assets.set('hero:' + mode, entry(assets.get('hero:main')));
    }
    imageGrid.replaceChildren(); catalogGrid.replaceChildren();
    for (const [key, title, ratio] of slots) {
      const root = key.startsWith('catalog:') ? catalogGrid : imageGrid;
      const card = el('article', 'media-asset'); card.append(el('h3', '', title));
      const preview = el('div');
      let current = assets.get(key);
      if (current?.url) preview.append(editor(current, ratio));
      const input = el('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.setAttribute('aria-label', title);
      input.onchange = () => {
        const file = input.files[0]; if (!file) return;
        try {
          validate(file, false); if (current) release(current);
          current = entry({ file, local: URL.createObjectURL(file), type: 'image', dirty: true }); assets.set(key, current);
          preview.replaceChildren(editor(current, ratio)); message('');
        } catch (e) { message(e.message, true); }
        input.value = '';
      };
      const saveButton = button('Kaydet', async () => {
        if (!current) { message('Önce görsel seçin.', true); return; }
        card.inert = true; message(title + ' kaydediliyor...');
        try {
          const media = await persist(current, 'site/' + key.replace(':', '-'), ratio);
          const { error } = await supabaseClient.from('site_assets').upsert({ key, ...media }, { onConflict: 'key' });
          if (error) throw error;
          message(title + ' kaydedildi.');
        } catch (e) { message(e.message, true); }
        finally { card.inert = false; }
      });
      card.append(preview, input, saveButton); root.append(card);
    }
    message('');
  }
  const style = el('style');
  style.textContent = `
    #product-media-editor,#site-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),280px));justify-content:start;gap:14px;width:100%;margin-top:8px}
    .site-settings-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;margin-top:20px}
    .site-settings-menu button{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:76px;padding:20px;text-align:left;font-size:17px;border-radius:8px}
    .site-settings-menu button span:last-child{font-size:24px}
    .site-settings-toolbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:20px 0}
    .site-settings-toolbar h3{font-size:20px;margin:0}
    .site-assets-group{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px;align-items:start}
    #site-media-panel [hidden]{display:none!important}
    .media-draft,.media-asset{min-width:0;border:1px solid #94762b;border-radius:8px;padding:8px;background:#061c16;color:#f8eed1}
    .media-draft>strong,.media-asset>h3{display:block;margin:0 0 6px;font-size:12px}
    .media-crop-stage{width:100%;aspect-ratio:1;overflow:hidden;background:#faf8f3;display:grid;place-items:center;margin:0}
    .media-crop-stage canvas,.media-crop-stage video{display:block;width:100%;height:100%;object-fit:cover}
    .media-controls{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.media-controls label{font-size:11px;min-width:0}.media-controls input{width:100%;padding:0;accent-color:#bd9323}
    .media-actions{display:flex;gap:6px;margin-top:6px}.media-actions button{min-width:36px;min-height:36px;padding:8px}
    body[data-theme="day"] .media-draft,body[data-theme="day"] .media-asset{background:#fffaf0;color:#104b3a}
    #media-message{position:sticky;bottom:12px;padding:12px;background:var(--bg,#061c16);z-index:2}#media-message:empty{display:none}
  `;
  document.head.append(style);
  const panel = el('section', 'panel hidden'); panel.id = 'site-media-panel';
  panel.append(el('h2', '', 'Site Ayarları'));
  const menu = el('div', 'site-settings-menu');
  for (const [key, title] of [['images', 'Site Görselleri'], ['catalog', 'Katalog']]) {
    const link = button('', () => key === 'catalog' ? showAdminPage('categories') : showSiteSection(key), title);
    link.append(el('span', '', title));
    const arrow = el('span', '', '›'); arrow.setAttribute('aria-hidden', 'true'); link.append(arrow);
    menu.append(link);
  }
  const toolbar = el('div', 'site-settings-toolbar'); toolbar.hidden = true;
  toolbar.append(button('← Site Ayarları', () => showSiteSection('menu')));
  const sectionTitle = el('h3'); sectionTitle.tabIndex = -1; toolbar.append(sectionTitle);
  const imageGrid = el('div', 'site-assets-group'); imageGrid.id = 'site-images-grid'; imageGrid.hidden = true;
  const catalogGrid = el('div', 'site-assets-group'); catalogGrid.id = 'site-catalog-grid'; catalogGrid.hidden = true;
  panel.append(menu, toolbar, imageGrid, catalogGrid);
  function showSiteSection(section) {
    menu.hidden = section !== 'menu'; toolbar.hidden = section === 'menu';
    imageGrid.hidden = section !== 'images'; catalogGrid.hidden = section !== 'catalog';
    sectionTitle.textContent = section === 'images' ? 'Site Görselleri' : 'Katalog';
    if (section !== 'menu') sectionTitle.focus();
  }
  const status = el('div', 'status'); status.id = 'media-message'; status.setAttribute('role','status'); panel.append(status);
  const membersPanel = document.getElementById('members-panel');
  if (membersPanel) membersPanel.before(panel);
  return { add, edit, reset, save, loadSite, geometry };
})();
