import { Store } from './store.js';
import { fmtDate, toISODate, todayISO, imageToDataURL, download, groupBy, monthMatrix } from './utils.js';

const store = new Store();
const state = { route: '/dashboard', cal: { year: new Date().getFullYear(), month: new Date().getMonth() } };
const qs = (sel, el=document)=> el.querySelector(sel);
const qsa = (sel, el=document)=> [...el.querySelectorAll(sel)];

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(mode){
  document.documentElement.classList.remove('light');
  if (mode === 'light') document.documentElement.classList.add('light');
  if (mode === 'auto'){ if (!colorScheme.matches) document.documentElement.classList.add('light'); }
}

async function main(){
  await store.init();
  initTheme();
  registerSW();
  bindChromeInstall();
  bindNav();
  routeTo(location.hash.replace('#','') || '/dashboard');
  updateVersion();
  if (store.settings.useNotifications) requestNotifyPermission();
  seedIfEmpty();
}

function updateVersion(){
  const el = qs('#appVersion'); if (el) el.textContent = store.settings.version || '1.0.0';
}

function initTheme(){
  let mode = store.settings.theme || 'auto';
  applyTheme(mode);
  colorScheme.addEventListener('change', ()=>{
    if (mode === 'auto') applyTheme('auto');
  });
  qs('#themeToggle').addEventListener('click', async ()=>{
    mode = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
    applyTheme(mode);
    await store.saveSettings({theme: mode});
  });
}

function bindNav(){
  const menuBtn = qs('#menuBtn'); const drawer = qs('#drawer'); const closeBtn = qs('#closeDrawer');
  menuBtn.addEventListener('click', ()=> drawer.classList.add('open'));
  closeBtn.addEventListener('click', ()=> drawer.classList.remove('open'));
  drawer.addEventListener('click', e=>{
    if (e.target.matches('[data-route]')) drawer.classList.remove('open');
  });
  window.addEventListener('hashchange', ()=> routeTo(location.hash.replace('#','')));
}

function routeTo(r){
  state.route = r || '/dashboard';
  qsa('[data-route]').forEach(a=> a.classList.toggle('active', a.getAttribute('href') === '#'+state.route));
  const root = qs('#app'); root.innerHTML = '';
  if (state.route === '/dashboard') renderDashboard(root);
  if (state.route === '/plants') renderPlants(root);
  if (state.route === '/calendar') renderCalendar(root);
  if (state.route === '/settings') renderSettings(root);
  root.focus();
}

function renderDashboard(root){
  const tpl = qs('#tpl-dashboard').content.cloneNode(true);
  const due = store.duePlants(todayISO());
  const total = store.cache.plants.length;
  const kpis = qs('#dueSummary', tpl);
  kpis.innerHTML = `
    <div class="kpi"><h3>Plants</h3><div class="num">${total}</div></div>
    <div class="kpi"><h3>Due to water</h3><div class="num">${due.length}</div></div>
    <div class="kpi"><h3>Overdue</h3><div class="num">${due.filter(p=>p.overdueDays>0).length}</div></div>`;
  const list = qs('#dueList', tpl);
  if (!due.length){
    list.innerHTML = `<div class="empty">Nothing due. Your plants salute you.</div>`;
  } else {
    for (const p of due){
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `
        <header>
          <strong>${escapeHTML(p.name)}</strong>
          <span class="badge ${p.overdueDays>0?'bad':'warn'}">${p.overdueDays>0? p.overdueDays+' days overdue' : 'due today'}</span>
        </header>
        <div class="row">
          <span class="tag">${escapeHTML(p.species||p.type||'')}</span>
          <span class="tag">Every ${p.waterIntervalDays} days</span>
        </div>
        <div class="row">
          <button class="primary-btn" data-act="water" data-id="${p.id}">Mark watered</button>
          <button class="btn" data-act="log" data-id="${p.id}">More...</button>
        </div>
      `;
      list.appendChild(card);
    }
  }
  qs('[data-action="quick-water"]', tpl).addEventListener('click', async ()=>{
    for (const p of due){ await store.addActivity({ plantId: p.id, type:'water', date: todayISO() }); }
    routeTo('/dashboard');
  });
  qs('[data-action="add-plant"]', tpl).addEventListener('click', ()=> openPlantDialog());
  qs('[data-action="scan-qr"]', tpl).addEventListener('click', ()=> scanQR());
  const recent = store.recentActivity(10);
  const timeline = qs('#recentActivity', tpl);
  if (!recent.length){
    timeline.innerHTML = `<div class="empty">No activity yet.</div>`;
  } else {
    for (const ev of recent){
      const p = store.cache.plants.find(x=>x.id===ev.plantId);
      const div = document.createElement('div'); div.className = 'event';
      div.innerHTML = `<div><strong>${ev.type}</strong> · ${escapeHTML(p?.name||'Unknown')}</div>
      <div class="meta">${fmtDate(ev.date)}${ev.note? ' · ' + escapeHTML(ev.note): ''}</div>`;
      timeline.appendChild(div);
    }
  }
  root.appendChild(tpl);
  root.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'water'){ await store.addActivity({ plantId: id, type:'water', date: todayISO() }); routeTo('/dashboard'); }
    if (btn.dataset.act === 'log'){ openActivityDialog(id); }
  });
}

function renderPlants(root){
  const tpl = qs('#tpl-plants').content.cloneNode(true);
  const listEl = qs('#plantList', tpl);
  function draw(){
    const search = qs('#plantSearch', root)?.value || '';
    const type = qs('#filterType', root)?.value || '';
    const sort = qs('#sortBy', root)?.value || 'name';
    const arr = store.listPlants({ search, type, sort });
    listEl.innerHTML = '';
    if (!arr.length){ listEl.innerHTML = `<div class="empty">No plants yet. Add one.</div>`; return; }
    for (const p of arr){
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `
        <header>
          <div><strong>${escapeHTML(p.name)}</strong><div class="row" style="margin-top:.2rem">
            <span class="tag">${escapeHTML(p.species||p.type||'')}</span>
            ${p.location? `<span class="tag">${escapeHTML(p.location)}</span>`:''}
          </div></div>
          <div class="row">
            <button class="btn" data-plant-edit="${p.id}">Edit</button>
            <button class="icon-btn" data-plant-menu="${p.id}" title="More">
              <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
          </div>
        </header>
        <img class="plant-cover" src="${p.photoData || 'assets/placeholder.jpg'}" alt="${escapeHTML(p.name)}">
        <div class="row">
          <span>Next water: <strong>${fmtDate(p.nextWaterDate)}</strong></span>
          <span class="badge">${p.waterIntervalDays} days</span>
        </div>
        ${p.notes ? `<div>${escapeHTML(p.notes)}</div>`:''}
        <div class="row">
          <button class="primary-btn" data-act="water" data-id="${p.id}">Mark watered</button>
          <button class="btn" data-act="log" data-id="${p.id}">Log...</button>
        </div>
      `;
      listEl.appendChild(card);
    }
  }
  qs('[data-action="add-plant"]', tpl).addEventListener('click', ()=> openPlantDialog());
  tpl.addEventListener('input', (e)=>{
    if (['plantSearch', 'filterType', 'sortBy'].includes(e.target.id)) draw();
  });
  root.appendChild(tpl);
  draw();
  root.addEventListener('click', async (e)=>{
    const edit = e.target.closest('[data-plant-edit]');
    if (edit){
      const id = edit.getAttribute('data-plant-edit');
      const p = store.cache.plants.find(x=>x.id===id);
      openPlantDialog(p);
      return;
    }
    const menu = e.target.closest('[data-plant-menu]');
    if (menu){
      const id = menu.getAttribute('data-plant-menu');
      showPlantMenu(id, e.pageX, e.pageY);
    }
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'water'){ await store.addActivity({ plantId: id, type:'water', date: todayISO() }); routeTo('/plants'); }
    if (btn.dataset.act === 'log'){ openActivityDialog(id); }
  });
}

function showPlantMenu(id, x, y){
  const menu = document.createElement('div');
  menu.className = 'card'; menu.style.position='absolute'; menu.style.left = x+'px'; menu.style.top = y+'px'; menu.style.zIndex = 2000;
  menu.innerHTML = `
    <div class="row"><button class="btn" data-menu="duplicate">Duplicate</button><button class="btn" data-menu="delete">Delete</button></div>
  `;
  document.body.appendChild(menu);
  const close = ()=>{ menu.remove(); document.removeEventListener('click', close); };
  setTimeout(()=> document.addEventListener('click', close), 0);
  menu.addEventListener('click', async (e)=>{
    const action = e.target.closest('[data-menu]')?.dataset.menu;
    if (!action) return;
    if (action==='delete'){ if (confirm('Delete this plant?')) { await store.deletePlant(id); routeTo('/plants'); } }
    if (action==='duplicate'){
      const p = structuredClone(store.cache.plants.find(x=>x.id===id));
      delete p.id; p.name = p.name + ' copy';
      await store.upsertPlant(p); routeTo('/plants');
    }
  });
}

function renderCalendar(root){
  const now = new Date();
  const year = state.cal.year; const month = state.cal.month;
  const tpl = qs('#tpl-calendar').content.cloneNode(true);
  const title = qs('#calTitle', tpl);
  title.textContent = new Date(year, month, 1).toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  const grid = qs('#calendarGrid', tpl);
  const matrix = monthMatrix(year, month);
  const events = store.calendarEvents(year, month);
  const gst = groupBy(events, e=>e.date);
  for (const row of matrix){
    for (const cell of row){
      const div = document.createElement('div'); div.className = 'cell';
      div.innerHTML = `<div class="day">${new Date(cell.date).getDate()}</div>`;
      const due = document.createElement('div'); due.className = 'due';
      for (const ev of gst[cell.date] || []){
        const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = ev.label;
        tag.dataset.plantId = ev.plantId; tag.style.cursor = 'pointer';
        tag.addEventListener('click', ()=> openActivityDialog(ev.plantId));
        due.appendChild(tag);
      }
      div.appendChild(due);
      if (!cell.inMonth) div.style.opacity = .5;
      grid.appendChild(div);
    }
  }
  qs('[data-cal="today"]', tpl).addEventListener('click', ()=>{ state.cal.year = now.getFullYear(); state.cal.month = now.getMonth(); routeTo('/calendar'); });
  qs('[data-cal="prev"]', tpl).addEventListener('click', ()=>{ const d = new Date(year, month-1, 1); state.cal.year = d.getFullYear(); state.cal.month = d.getMonth(); routeTo('/calendar'); });
  qs('[data-cal="next"]', tpl).addEventListener('click', ()=>{ const d = new Date(year, month+1, 1); state.cal.year = d.getFullYear(); state.cal.month = d.getMonth(); routeTo('/calendar'); });
  qs('[data-action="export-ics"]', tpl).addEventListener('click', ()=> exportICS(year, month));
  root.appendChild(tpl);
}

function renderSettings(root){
  const tpl = qs('#tpl-settings').content.cloneNode(true);
  const form = qs('#settingsForm', tpl);
  form.elements.theme.value = store.settings.theme || 'auto';
  form.elements.useNotifications.checked = !!store.settings.useNotifications;
  form.elements.notifyTime.value = store.settings.notifyTime || '09:00';
  form.addEventListener('change', async ()=>{
    const data = {
      theme: form.elements.theme.value,
      useNotifications: form.elements.useNotifications.checked,
      notifyTime: form.elements.notifyTime.value
    };
    await store.saveSettings(data);
    applyTheme(data.theme);
    if (data.useNotifications) requestNotifyPermission();
  });
  qs('[data-action="backup"]', tpl).addEventListener('click', async ()=>{
    const json = await store.exportBackup();
    download(`cactolog-backup-${toISODate(new Date())}.json`, json, 'application/json');
  });
  qs('#importFile', tpl).addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    await store.importBackup(text);
    routeTo('/dashboard');
  });
  root.appendChild(tpl);
}

function openPlantDialog(plant=null){
  const dlg = qs('#plantDialog'); const form = qs('#plantForm');
  qs('#plantDialogTitle').textContent = plant ? 'Edit plant' : 'New plant';
  form.reset();
  form.elements.name.value = plant?.name || '';
  form.elements.species.value = plant?.species || '';
  form.elements.type.value = plant?.type || 'cactus';
  form.elements.location.value = plant?.location || '';
  form.elements.waterIntervalDays.value = plant?.waterIntervalDays || 14;
  form.elements.lastWatered.value = plant?.lastWatered || '';
  form.elements.repotIntervalMonths.value = plant?.repotIntervalMonths || 12;
  form.elements.lastRepot.value = plant?.lastRepot || '';
  form.elements.tags.value = plant?.tags || '';
  form.elements.notes.value = plant?.notes || '';
  form.elements.photo.value = '';
  dlg.returnValue = 'cancel';
  dlg.showModal();
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const f = form.elements;
    const data = {
      id: plant?.id,
      name: f.name.value.trim(),
      species: f.species.value.trim(),
      type: f.type.value,
      location: f.location.value.trim(),
      waterIntervalDays: Number(f.waterIntervalDays.value||14),
      lastWatered: f.lastWatered.value || toISODate(new Date()),
      repotIntervalMonths: Number(f.repotIntervalMonths.value||0),
      lastRepot: f.lastRepot.value || '',
      tags: f.tags.value.trim(),
      notes: f.notes.value.trim()
    };
    const file = f.photo.files[0];
    if (file){ data.photoData = await imageToDataURL(file); }
    await store.upsertPlant(data);
    dlg.close('save'); routeTo('/plants');
  };
}

function openActivityDialog(plantId){
  const p = store.cache.plants.find(x=>x.id===plantId);
  const dlg = qs('#activityDialog'); const form = qs('#activityForm');
  qs('#activityDialogTitle').textContent = `Log · ${p?.name || ''}`;
  form.reset();
  form.elements.plantId.value = plantId;
  form.elements.type.value = 'water';
  form.elements.date.value = toISODate(new Date());
  dlg.showModal();
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const f = form.elements;
    const file = f.photo.files[0];
    let photoData = null;
    if (file) photoData = await imageToDataURL(file);
    await store.addActivity({ plantId, type: f.type.value, date: f.date.value, note: f.note.value.trim(), photoData });
    dlg.close('save'); routeTo('/dashboard');
  };
}

function exportICS(year, month){
  const events = store.calendarEvents(year, month);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CactoLog//EN'
  ];
  for (const ev of events){
    const dt = new Date(ev.date + 'T09:00:00');
    const dtUTC = new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    lines.push(
      'BEGIN:VEVENT',
      'UID:'+crypto.randomUUID(),
      'DTSTAMP:'+dtUTC,
      'DTSTART:'+dtUTC,
      'SUMMARY:'+ev.label,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  download(`cactolog-${year}-${String(month+1).padStart(2,'0')}.ics`, lines.join('\r\n'), 'text/calendar');
}

function bindChromeInstall(){
  let deferredPrompt = null;
  const btn = qs('#installBtn');
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async ()=>{
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    btn.hidden = true;
    deferredPrompt = null;
  });
}

function escapeHTML(str=''){
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}

async function requestNotifyPermission(){
  try{
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return scheduleDailyCheck();
    const res = await Notification.requestPermission();
    if (res === 'granted') scheduleDailyCheck();
  }catch(e){ console.warn(e); }
}

function scheduleDailyCheck(){
  // Best-effort: try notifications if app is open
  const time = store.settings.notifyTime || '09:00';
  const [h,m] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(); next.setHours(h, m, 0, 0);
  if (next < now) next.setDate(next.getDate()+1);
  const delay = next - now;
  setTimeout(()=>{
    const due = store.duePlants(todayISO());
    if (due.length && 'Notification' in window && Notification.permission==='granted'){
      new Notification('CactoLog', { body: `${due.length} plant(s) need water today` });
    }
    scheduleDailyCheck();
  }, delay);
}

async function registerSW(){
  if ('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('sw.js');
    }catch(e){ console.warn('SW failed', e); }
  }
}

function scanQR(){
  if (!('BarcodeDetector' in window)){
    alert('Barcode detector is not supported here. Use camera apps or a browser that supports it.');
    return;
  }
  const input = document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange = async ()=>{
    const file = input.files[0]; if (!file) return;
    const img = new Image(); img.src = URL.createObjectURL(file);
    await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0);
    const bd = new BarcodeDetector({ formats: ['qr_code'] });
    const results = await bd.detect(canvas);
    if (results.length){ alert('QR content: ' + results[0].rawValue); }
    URL.revokeObjectURL(img.src);
  };
  input.click();
}

// Seed demo data (only once)
async function seedIfEmpty(){
  if (store.cache.plants.length) return;
  const demo = [
    { name:'Golden Barrel', species:'Echinocactus grusonii', type:'cactus', location:'South window', waterIntervalDays:21, lastWatered: toISODate(new Date()), repotIntervalMonths:12, tags:'cactus,spines', notes:'Likes lots of light.' },
    { name:'Bunny Ear', species:'Opuntia microdasys', type:'cactus', location:'West window', waterIntervalDays:18, lastWatered: toISODate(new Date()), repotIntervalMonths:18, tags:'pads', notes:'' },
    { name:'ZZ Plant', species:'Zamioculcas zamiifolia', type:'foliage', location:'Office', waterIntervalDays:28, lastWatered: toISODate(new Date()), repotIntervalMonths:24, tags:'low-light', notes:'' }
  ];
  for (const p of demo) await store.upsertPlant(p);
  routeTo('/dashboard');
}

main();
