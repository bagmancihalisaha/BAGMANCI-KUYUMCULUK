(() => {
  const pageIds = {search:'searchModal', cart:'sepetModal', account:'uyeModal', messages:'soruModal', notifications:'duyuruModal', calculator:'calculator-view'};
  const idViews = Object.fromEntries(Object.entries(pageIds).map(([view,id]) => [id,view]));
  const home = document.createElement('section'); home.id = 'home-view';
  const banner = document.querySelector('.banner-container'); banner.before(home);
  const main = document.querySelector('main.hero-main-content');
  const market = document.getElementById('borsa');
  home.append(banner, main);
  const catalog = document.getElementById('katalog');
  const header = document.getElementById('anasayfa');
  const updateMarketOffset = () => market.style.scrollMarginTop = `${header.offsetHeight + 12}px`;
  new ResizeObserver(updateMarketOffset).observe(header);
  updateMarketOffset();
  const footer = document.querySelector('.legal-footer');
  const nav = document.querySelector('nav:has([data-nav])');
  if (nav) { nav.classList.add('view-bottom-nav'); nav.style.setProperty('z-index','30','important'); }
  const headerRow = document.createElement('div'); headerRow.className = 'view-header-row';
  const brand = document.createElement('div'); brand.className = 'view-header-brand';
  brand.append(...header.querySelectorAll('.brand-logo, .brand-sub, .header-location'));
  headerRow.append(document.getElementById('themeControl'), brand, header.querySelector('.header-actions'));
  header.prepend(headerRow);
  const backBar = document.createElement('div'); backBar.className = 'view-back-bar';
  backBar.innerHTML = '<button class="view-back-button" type="button"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Geri Dön</button>';
  home.before(backBar);
  document.body.classList.add('app-views');
  for (const id of Object.values(pageIds)) {
    const node = document.getElementById(id);
    node.className = id === 'calculator-view' ? 'app-page calculator-page' : 'app-page'; node.removeAttribute('aria-modal'); node.setAttribute('role','region');
  }
  let applying = false, current, sequence = 0;
  const originalModal = modalGoster, originalCategory = katalogAc;
  const originalAccount = openAccountSection, originalCartStep = showCartStep;
  const show = (node, visible) => { if (node) { node.dataset.viewHidden = String(!visible); node.hidden = !visible; } };
  function hashFor(state) {
    const hashes = {home:state.anchor === 'borsa' ? 'borsa' : 'home',catalog:'katalog',cart:'sepet',account:'hesabim',search:'search',messages:'account-messages',notifications:'duyurular',calculator:'hesap-makinesi'};
    const params = new URLSearchParams();
    if (state.category) params.set('category',state.category);
    if (state.model) params.set('model',state.model);
    if (state.q) params.set('q',state.q);
    if (state.section && state.section !== 'home') params.set('section',state.section);
    if (state.step && state.step !== 'cart') params.set('step',state.step);
    return '#' + hashes[state.view] + (params.size ? '?' + params : '');
  }
  function parseHash() {
    const [name, query] = location.hash.slice(1).split('?');
    const params = Object.fromEntries(new URLSearchParams(query));
    const views = {home:'home',anasayfa:'home',katalog:'catalog',borsa:'home',sepet:'cart',hesabim:'account',search:'search',duyurular:'notifications','account-messages':'messages','hesap-makinesi':'calculator'};
    if (name === 'borsa') return {view:'home',anchor:'borsa'};
    if (name?.startsWith('account-') && name !== 'account-messages') return {view:'account',section:name.slice(8),...params};
    return {view:views[name] || 'home',...params};
  }
  async function apply(state, restoring = false) {
    if (state.view === 'market') {
      state = {view:'home',anchor:'borsa',scroll:state.scroll};
      history.replaceState({...history.state,bkView:state},'',hashFor(state));
    }
    const token = ++sequence;
    const previousView = current?.view;
      current = state; applying = true;
    try {
      document.body.classList.remove('modal-page-open');
      if (state.view !== 'catalog') activeCatalogCategory = '';
      document.getElementById('themeControl')?.classList.remove('open');
      show(home,state.view === 'home'); show(market,state.view === 'home');
      show(catalog,state.view === 'home' || state.view === 'catalog');
      show(header,['home','catalog'].includes(state.view));
      show(footer,state.view === 'home'); show(backBar,state.view !== 'home');
      for (const [view,id] of Object.entries(pageIds)) {
        const node = document.getElementById(id); show(node,view === state.view); node.style.display = view === state.view ? 'block' : 'none';
      }
      document.getElementById('logoutConfirmModal').style.display = 'none';
      setActiveNav(state.anchor === 'borsa' ? 'borsa' : ({home:'home',catalog:'katalog',cart:'sepet',account:'hesabim'})[state.view] || '');
      if (pageIds[state.view] && previousView !== state.view) {
        originalModal(pageIds[state.view]);
        document.body.classList.remove('modal-page-open');
      }
      if (state.view === 'catalog' && state.category) {
        await originalCategory(state.category);
        if (token !== sequence) return;
        if (state.model) {
          activeCatalogModel = state.model;
          const items = catalogProducts.filter(item => normalizeCategoryName(item.category) === state.category).sort((a,b)=>catalogOrder(a)-catalogOrder(b));
          renderCatalogFilters(items); renderCatalogItems(items);
        }
      } else if (state.view === 'catalog' || state.view === 'home') {
        activeCatalogCategory = ''; activeCatalogModel = '';
        document.getElementById('catalogItemsView').style.display = 'none';
        document.getElementById('catalogCoversView').style.display = 'grid';
      }
      if (state.view === 'account') originalAccount(state.section || 'home');
      if (state.view === 'cart') originalCartStep(state.step || 'cart');
      if (state.view === 'search') {
        document.getElementById('searchPageInput').value = state.q || '';
        await loadCatalogProducts(); if (token !== sequence) return;
        renderSearchPage(state.q || '');
      }
      if (state.view === 'messages') { showMessageTab('seller'); loadCustomerQuestions(); }
      if (state.view === 'notifications') { showNotificationTab('all'); loadPublicAnnouncements(); }
      if (token !== sequence) return;
      if (state.anchor === 'borsa' && (!restoring || state.scroll == null)) {
        updateMarketOffset();
        market.scrollIntoView({behavior:restoring ? 'instant' : 'smooth',block:'start'});
      } else window.scrollTo({top:restoring ? state.scroll || 0 : 0,behavior:'instant'});
      if (!restoring && state.view !== 'home') { backBar.querySelector('button').focus({preventScroll:true}); }
    } finally { if (token === sequence) applying = false; }
  }
  function navigate(state, replace = false) {
    state = {view:state.view,...state};
    if (current && hashFor(current) === hashFor(state)) return;
    if (state.view === 'account' && current?.view === 'cart') {
      history.replaceState({...history.state,bkView:{view:'home',scroll:0}},'','#home');
    } else if (current) history.replaceState({...history.state, bkView:{...current,scroll:window.scrollY}},'',location.href);
    const depth = replace ? history.state?.bkDepth || 0 : (history.state?.bkDepth || 0) + 1;
    history[replace ? 'replaceState' : 'pushState']({bkView:state,bkDepth:depth},'',hashFor(state));
    return apply(state);
  }
  function back() {
    if (current?.view === 'account') { navigate({view:'home'},true); return; }
    if (history.state?.bkDepth > 0) history.back(); else navigate({view:'home'},true);
  }
  backBar.querySelector('button').onclick = back;
  window.SiteViews = {navigate, back, get current(){return current;}};
  modalGoster = id => { if (idViews[id]) { if (current?.view !== idViews[id]) navigate({view:idViews[id]}); } else originalModal(id); };
  const originalClose = modalKapat;
  modalKapat = id => { if (idViews[id]) back(); else originalClose(id); };
  closeTopPages = () => {};
  goHomeNav = () => navigate({view:'home'});
  scrollToSectionTop = id => {
    if (id === 'borsa') {
      if (current?.view === 'home' && current.anchor === 'borsa') {
        updateMarketOffset();
        market.scrollIntoView({behavior:'smooth',block:'start'});
      } else navigate({view:'home',anchor:'borsa'});
      return;
    }
    if (applying) return;
    const view = id === 'katalog' ? 'catalog' : 'home';
    if (current?.view !== view) navigate({view});
  };
  katalogAc = category => {
    if (current?.view === 'catalog' && current.category === category) return originalCategory(category);
    return navigate({view:'catalog',category});
  };
  katalogKapat = () => navigate({view:'catalog'});
  openAccountSection = section => { if (applying || current?.view !== 'account') return originalAccount(section); navigate({view:'account',section}); };
  showCartStep = step => { if (applying || current?.view !== 'cart') return originalCartStep(step); navigate({view:'cart',step}); };
  closeContextualPage = () => back();
  const originalSearch = openSearchPage;
  openSearchPage = async (...args) => {
    await originalSearch(...args);
    if (current?.view === 'search') remember({q:document.getElementById('searchPageInput').value});
  };
  document.addEventListener('click',event => {
    const control = document.getElementById('themeControl');
    if (control && !control.contains(event.target)) control.classList.remove('open');
    control?.querySelector('button')?.setAttribute('aria-expanded',String(control.classList.contains('open')));
  });
  document.addEventListener('keydown',event => { if (event.key === 'Escape') document.getElementById('themeControl')?.classList.remove('open'); });
  document.querySelector('.brand-logo').onclick = event => {event.preventDefault();goHomeNav();};
  document.getElementById('searchPageInput').addEventListener('input',event=>remember({q:event.target.value}));
  document.getElementById('catalogFilters').addEventListener('click',()=>remember({model:activeCatalogModel}));
  function remember(patch) {
    if (!current) return; current = {...current,...patch};
    history.replaceState({...history.state,bkView:current},'',hashFor(current));
  }
  window.addEventListener('popstate',()=>{
    let state = history.state?.bkView || parseHash();
    if (current?.view === 'account' && state.view !== 'account' && state.view !== 'home') {
      state = {view:'home'};
      history.replaceState({...history.state,bkView:state},'','#home');
    }
    apply(state,true);
  });
  window.addEventListener('hashchange',()=>{const state=parseHash(); if(hashFor(state)!==hashFor(current)) navigate(state,true);});
  window.addEventListener('pageshow',event=>{if(event.persisted) apply(history.state?.bkView || parseHash(),true);});
  const state = history.state?.bkView || parseHash();
  history.replaceState({bkView:state,bkDepth:history.state?.bkDepth || 0},'',hashFor(state));
  apply(state,true);
})();
