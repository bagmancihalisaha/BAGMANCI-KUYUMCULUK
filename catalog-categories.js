(() => {
  const cfg = window.BAGMANCI_SUPABASE;
  if (!cfg?.url || !cfg?.anonKey || !window.supabase) return;
  const client = window.supabase.createClient(cfg.url, cfg.anonKey);
  let loading = false, signature = '';
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const {data, error} = await client.from('categories').select('*').eq('is_active', true).order('order_no').order('name');
      if (error) throw error;
      const next = JSON.stringify(data || []);
      if (signature === next) return;
      signature = next;
      catalogCategories = data || [];
      productsLoaded = false;
      await loadCatalogProducts();
      renderCatalogCovers();
      if (!catalogCategories.length) document.getElementById('catalogCoversView').textContent = 'Henüz kategori eklenmedi.';
      if (activeCatalogCategory) {
        if (catalogCategories.some(row => row.name === activeCatalogCategory)) await katalogAc(activeCatalogCategory);
        else katalogKapat();
      }
    } catch (error) {
      console.warn('Kategoriler güncellenemedi:', error.message);
      if (!signature) document.getElementById('catalogCoversView').textContent = 'Katalog şu anda yüklenemiyor. Lütfen biraz sonra tekrar deneyin.';
    }
    finally { loading = false; }
  }
  refresh();
  client.channel('public-categories').on('postgres_changes', {event:'*', schema:'public', table:'categories'}, refresh).subscribe();
  // Polling also catches hidden/deleted categories when RLS suppresses an event.
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
