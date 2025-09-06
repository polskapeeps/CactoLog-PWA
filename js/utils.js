export const uid = (prefix='') => prefix + Math.random().toString(36).slice(2) + Date.now().toString(36);
export const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d); if (isNaN(dt)) return '';
  return dt.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
};
export const toISODate = (d) => {
  const dt = d ? new Date(d) : new Date();
  const off = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - off * 60000);
  return local.toISOString().slice(0,10);
};
export const clamp = (n, min, max)=> Math.max(min, Math.min(max, n));
export const download = (filename, content, mime='application/octet-stream')=>{
  const blob = new Blob([content], {type: mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1500);
};
export const imageToDataURL = (file) => new Promise((resolve, reject)=>{
  const reader = new FileReader();
  reader.onload = ()=> resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
export const todayISO = ()=> toISODate(new Date());
export const addDays = (iso, days)=>{
  const d = new Date(iso); d.setDate(d.getDate()+Number(days||0)); return toISODate(d);
};
export const diffDays = (a,b)=>{
  const d1 = new Date(a), d2 = new Date(b);
  return Math.round((d1 - d2) / 86400000);
};
export const sortBy = (arr, key, dir='asc')=>{
  const m = dir === 'asc' ? 1 : -1;
  return [...arr].sort((a,b)=> (a[key] > b[key] ? 1 : -1) * m);
};
export const groupBy = (arr, key)=> arr.reduce((acc, item)=>{ const k = typeof key === 'function' ? key(item) : item[key]; (acc[k] ??= []).push(item); return acc; }, {});
export const monthMatrix = (year, month)=>{
  const first = new Date(year, month, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay()+6)%7)); // Monday start
  const weeks = [];
  for (let w = 0; w < 6; w++){
    const row = [];
    for (let d = 0; d < 7; d++){
      const cur = new Date(start); cur.setDate(start.getDate()+w*7+d);
      row.push({ date: toISODate(cur), inMonth: cur.getMonth()===month });
    }
    weeks.push(row);
  }
  return weeks;
};
