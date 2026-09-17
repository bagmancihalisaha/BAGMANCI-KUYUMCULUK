const CategoryAdmin = (() => {
  let rows = [], ready = false, busy = false;
  const panel = document.createElement('section');
  panel.id = 'categories-panel'; panel.className = 'panel hidden';
  panel.innerHTML = `<h2>Katalog Yönetimi</h2>
    <form id="category-form">
      <h3 id="category-form-heading" tabindex="-1" style="margin-top:20px">Yeni Kategori Ekle</h3>
      <input id="category-edit-id" type="hidden">
      <div class="grid" style="margin-top:14px">
        <label>Kategori Adı<input id="category-name" required maxlength="100"></label>
        <label>Slug<input id="category-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*"></label>
        <label>Kapak Fotoğrafı URL<input id="category-cover" type="url" placeholder="https://..."></label>
        <label>Kapak Fotoğrafı Yükle<input id="category-file" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="full">Alt Kategoriler (virgülle ayırın)<input id="category-models" placeholder="Kelepçe, Burma, Ajda"></label>
        <label>Sıralama No<input id="category-order" type="number" step="1" value="0" required></label>
        <label>Yayın Durumu<select id="category-active"><option value="true">Aktif</option><option value="false">Pasif</option></select></label>
      </div>
      <div class="actions"><button class="primary" type="submit">Kaydet</button><button class="secondary" type="button" id="category-cancel">İptal</button></div>
    </form>
    <div id="category-status" class="status" role="status"></div>
    <h3 style="margin:20px 0 12px">Mevcut Kategoriler</h3><div id="category-list" class="admin-catalog-grid"></div>`;
  document.querySelector('.wrap').append(panel);
  const get = id => document.getElementById('category-' + id);
  const status = (text, bad = false) => setStatus('category-status', text, bad ? 'err' : 'ok');
  function reset() { get('form').reset(); get('edit-id').value = ''; document.getElementById('category-form-heading').textContent = 'Yeni Kategori Ekle'; }
  function subOptions(value = '') {
    const select = document.getElementById('sub_category');
    const row = rows.find(row => row.name === formValue('category'));
    select.replaceChildren(new Option('Alt kategori seçin', ''));
    (row?.sub_categories || []).forEach(name => select.add(new Option(name, name)));
    if (value && ![...select.options].some(option => option.value === value)) select.add(new Option(value + ' (eski)', value));
    select.value = value;
  }
  function options(category = formValue('category'), sub = formValue('sub_category')) {
    const select = document.getElementById('category');
    select.replaceChildren(new Option('Kategori seçin', ''));
    rows.forEach(row => select.add(new Option(row.name + (row.is_active ? '' : ' (pasif)'), row.name)));
    if (category && !rows.some(row => row.name === category)) select.add(new Option(category + ' (eski)', category));
    select.value = category;
    subOptions(sub);
  }
  function render() {
    const root = get('list'); root.replaceChildren();
    rows.forEach(row => {
      const card = document.createElement('article'); card.className = 'item-card';
      const image = document.createElement('div'); image.className = 'cover-box';
      image.append(catalogImage(row.cover_image, row.name, 'bk-logo.jpg'));
      const body = document.createElement('div'); body.className = 'item-body';
      const title = document.createElement('h3'); title.textContent = row.name;
      const meta = document.createElement('span'); meta.className = 'item-meta';
      meta.textContent = `${row.sub_categories.length} alt kategori · Sıra ${row.order_no} · ${row.is_active ? 'Aktif' : 'Pasif'}`;
      const actions = document.createElement('div'); actions.className = 'item-actions';
      for (const [label, handler] of [['Düzenle', () => edit(row)], ['Sil', () => remove(row)]]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = label === 'Sil' ? 'danger' : 'secondary';
        button.textContent = label; button.onclick = handler; actions.append(button);
      }
      body.append(title, meta, actions); card.append(image, body); root.append(card);
    });
    if (!rows.length) root.textContent = 'Henüz kategori eklenmedi.';
  }
  async function load() {
    try {
      const {data, error} = await supabaseClient.from('categories').select('*').order('order_no').order('name');
      if (error) throw error;
      rows = (data || []).map(row => ({...row, sub_categories: Array.isArray(row.sub_categories) ? row.sub_categories : []}));
      ready = true; options(); render(); renderAdminCatalog();
    } catch (error) { ready = false; status('Kategoriler yüklenemedi. Kategori tablosunun kurulumunu ve erişim izinlerini kontrol edin. ' + error.message, true); }
  }
  function edit(row) {
    if (busy) return;
    reset(); get('edit-id').value = row.id; get('name').value = row.name; get('slug').value = row.slug;
    get('cover').value = row.cover_image || ''; get('models').value = row.sub_categories.join(', ');
    get('order').value = row.order_no; get('active').value = String(row.is_active);
    const heading = document.getElementById('category-form-heading'); heading.textContent = 'Kategori Düzenle'; heading.focus();
  }
  async function remove(row) {
    if (busy || !confirm(row.name + ' kategorisi silinsin mi?')) return;
    busy = true; panel.inert = true;
    try {
      const {error} = await supabaseClient.from('categories').delete().eq('id', row.id);
      if (error) throw error;
      if (get('edit-id').value === String(row.id)) reset();
      await load(); status('Kategori silindi.');
    } catch (error) { status(error.message, true); }
    finally { busy = false; panel.inert = false; }
  }
  get('form').onsubmit = async event => {
    event.preventDefault(); if (busy || !ready) return;
    busy = true; panel.inert = true; status('Kaydediliyor...');
    try {
      let cover = get('cover').value.trim();
      const file = get('file').files[0];
      if (file) {
        const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
        if (!extensions[file.type] || file.size > 15 * 1024 * 1024) throw Error('JPG, PNG veya WebP seçin; en fazla 15 MB.');
        const path = `categories/${crypto.randomUUID()}.${extensions[file.type]}`;
        const {error} = await supabaseClient.storage.from('product-images').upload(path, file, {contentType:file.type});
        if (error) throw error;
        cover = supabaseClient.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      if (cover && !/^https?:\/\//i.test(cover)) throw Error('Geçerli bir görsel URL’i girin.');
      const order = Number(get('order').value);
      if (!Number.isInteger(order) || order < -2147483648 || order > 2147483647) throw Error('Geçerli bir sıra numarası girin.');
      const models = [...new Map(get('models').value.split(',').map(s => s.trim()).filter(Boolean).map(s => [s.toLocaleLowerCase('tr-TR'), s])).values()];
      const payload = {name:get('name').value.trim(), slug:get('slug').value.trim(), cover_image:cover, sub_categories:models, order_no:order, is_active:get('active').value === 'true'};
      const id = get('edit-id').value;
      const query = supabaseClient.from('categories');
      const {error} = await (id ? query.update(payload).eq('id', id) : query.insert(payload));
      if (error) throw error;
      reset(); await load(); await loadProducts(); status('Kategori kaydedildi.');
    } catch (error) { status(error.message, true); }
    finally { busy = false; panel.inert = false; }
  };
  get('name').oninput = () => { if (!get('edit-id').value) get('slug').value = slugify(get('name').value); };
  get('cancel').onclick = reset;
  return {load, options, subOptions, get rows() {return rows;}, get ready() {return ready;}};
})();
