export class DB {
  constructor(name = 'cactolog', version = 1){
    this.name = name; this.version = version; this.db = null;
  }
  async open(){
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject)=>{
      const req = indexedDB.open(this.name, this.version);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if (!db.objectStoreNames.contains('plants')){
          const s = db.createObjectStore('plants', { keyPath: 'id' });
          s.createIndex('by_name','name',{unique:false});
          s.createIndex('by_type','type',{unique:false});
        }
        if (!db.objectStoreNames.contains('activities')){
          const s = db.createObjectStore('activities', { keyPath: 'id' });
          s.createIndex('by_plant','plantId',{unique:false});
          s.createIndex('by_date','date',{unique:false});
        }
        if (!db.objectStoreNames.contains('photos')){
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('by_plant','plantId',{unique:false});
        }
        if (!db.objectStoreNames.contains('settings')){
          db.createObjectStore('settings');
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
    return this.db;
  }
  async tx(storeNames, mode='readonly'){
    const db = await this.open();
    return db.transaction(storeNames, mode);
  }
  async get(store, key){
    const tx = await this.tx([store]);
    return new Promise((res, rej)=>{
      const r = tx.objectStore(store).get(key);
      r.onsuccess = ()=> res(r.result);
      r.onerror = ()=> rej(r.error);
    });
  }
  async getAll(store, index = null, query = null){
    const tx = await this.tx([store]);
    const os = tx.objectStore(store);
    const src = index ? os.index(index) : os;
    return new Promise((res, rej)=>{
      const r = query ? src.getAll(query) : src.getAll();
      r.onsuccess = ()=> res(r.result);
      r.onerror = ()=> rej(r.error);
    });
  }
  async put(store, value, key=undefined){
    const tx = await this.tx([store],'readwrite');
    return new Promise((res, rej)=>{
      const r = tx.objectStore(store).put(value, key);
      r.onsuccess = ()=> res(r.result);
      r.onerror = ()=> rej(r.error);
    });
  }
  async delete(store, key){
    const tx = await this.tx([store],'readwrite');
    return new Promise((res, rej)=>{
      const r = tx.objectStore(store).delete(key);
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    });
  }
  async clear(store){
    const tx = await this.tx([store],'readwrite');
    return new Promise((res, rej)=>{
      const r = tx.objectStore(store).clear();
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    });
  }
}
