import { DB } from './db.js';
import { uid, toISODate, addDays, diffDays } from './utils.js';

export class Store {
  constructor(){
    this.db = new DB('cactolog', 1);
    this.cache = { plants: [], activities: [], settings: {} };
  }
  async init(){
    await this.db.open();
    this.cache.plants = await this.db.getAll('plants');
    this.cache.activities = await this.db.getAll('activities');
    const s = await this.db.get('settings','app');
    this.cache.settings = s || { theme:'auto', useNotifications:false, notifyTime:'09:00', version: '1.0.0' };
    if (!s) await this.db.put('settings', this.cache.settings, 'app');
    return this.cache;
  }
  get settings(){ return this.cache.settings }
  async saveSettings(patch){
    Object.assign(this.cache.settings, patch);
    await this.db.put('settings', this.cache.settings, 'app');
    return this.cache.settings;
  }
  async upsertPlant(data){
    const now = new Date().toISOString();
    if (!data.id){ data.id = uid('p_'); data.createdAt = now; }
    data.updatedAt = now;
    // compute nextWater
    if (!data.lastWatered) data.lastWatered = toISODate(new Date());
    if (!data.waterIntervalDays) data.waterIntervalDays = 14;
    data.nextWaterDate = addDays(data.lastWatered, data.waterIntervalDays);
    await this.db.put('plants', data);
    const idx = this.cache.plants.findIndex(p=>p.id===data.id);
    if (idx >= 0) this.cache.plants[idx] = data; else this.cache.plants.push(data);
    return data;
  }
  async deletePlant(id){
    await this.db.delete('plants', id);
    this.cache.plants = this.cache.plants.filter(p=>p.id!==id);
    // also delete related photos and activities
    const rel = this.cache.activities.filter(a=>a.plantId===id).map(a=>a.id);
    for (const aid of rel) await this.db.delete('activities', aid);
    this.cache.activities = this.cache.activities.filter(a=>a.plantId!==id);
    return true;
  }
  async addActivity({ plantId, type, date, note, photoData }){
    const id = uid('a_'); const when = date || toISODate(new Date());
    const act = { id, plantId, type, date: when, note: note || '', photoData: photoData || null };
    await this.db.put('activities', act);
    this.cache.activities.push(act);
    // react to activity types
    const plant = this.cache.plants.find(p=>p.id===plantId);
    if (plant){
      if (type === 'water'){
        plant.lastWatered = when;
        plant.nextWaterDate = addDays(when, plant.waterIntervalDays || 14);
      }
      if (type === 'repot'){ plant.lastRepot = when; }
      plant.updatedAt = new Date().toISOString();
      await this.db.put('plants', plant);
    }
    return act;
  }
  listPlants({ search='', type='' }={}){
    const s = search.trim().toLowerCase();
    return this.cache.plants.filter(p=>{
      const matchType = type ? p.type === type : true;
      if (!s) return matchType;
      const hay = [p.name, p.species, p.tags].filter(Boolean).join(' ').toLowerCase();
      return matchType && hay.includes(s);
    });
  }
  duePlants(onDate = toISODate(new Date())){
    return this.cache.plants
      .map(p=>({ ...p, overdueDays: diffDays(onDate, p.nextWaterDate) }))
      .filter(p=> p.overdueDays >= 0)
      .sort((a,b)=> b.overdueDays - a.overdueDays);
  }
  recentActivity(limit=10){
    return [...this.cache.activities].sort((a,b)=> a.date < b.date ? 1 : -1).slice(0, limit);
  }
  calendarEvents(year, month){
    const events = [];
    for (const p of this.cache.plants){
      const nwd = new Date(p.nextWaterDate);
      if (nwd.getFullYear()===year && nwd.getMonth()===month){
        events.push({ date: p.nextWaterDate, label: `Water · ${p.name}`, plantId: p.id, type:'water' });
      }
      if (p.lastRepot && p.repotIntervalMonths > 0){
        const lr = new Date(p.lastRepot);
        const due = new Date(lr); due.setMonth(due.getMonth() + Number(p.repotIntervalMonths));
        if (due.getFullYear()===year && due.getMonth()===month){
          events.push({ date: toISODate(due), label: `Repot · ${p.name}`, plantId: p.id, type:'repot' });
        }
      }
    }
    return events.sort((a,b)=> a.date > b.date ? 1 : -1);
  }
  async exportBackup(){
    const payload = {
      plants: this.cache.plants,
      activities: this.cache.activities,
      settings: this.cache.settings,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(payload, null, 2);
  }
  async importBackup(json){
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.plants)) throw new Error('Invalid backup');
    // Clear and replace
    await this.db.clear('plants'); await this.db.clear('activities');
    this.cache.plants = []; this.cache.activities = [];
    for (const p of data.plants) await this.upsertPlant(p);
    for (const a of data.activities) await this.addActivity(a);
    if (data.settings) await this.saveSettings(data.settings);
    return true;
  }
}
