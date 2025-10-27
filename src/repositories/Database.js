/**
 * IndexedDB wrapper with modern promise-based API
 * @class
 */
export class Database {
  /**
   * @param {string} name - Database name
   * @param {number} version - Database version
   */
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.db = null;
  }

  /**
   * Open database connection
   * @param {Function} upgradeCallback - Upgrade callback
   * @returns {Promise<IDBDatabase>}
   */
  async open(upgradeCallback) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        if (upgradeCallback) {
          upgradeCallback(this.db, event.oldVersion, event.newVersion);
        }
      };
    });
  }

  /**
   * Get object from store
   * @param {string} storeName - Store name
   * @param {string} key - Key
   * @returns {Promise<*>}
   */
  async get(storeName, key) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return this.promisify(store.get(key));
  }

  /**
   * Get all objects from store
   * @param {string} storeName - Store name
   * @returns {Promise<Array>}
   */
  async getAll(storeName) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return this.promisify(store.getAll());
  }

  /**
   * Put object in store
   * @param {string} storeName - Store name
   * @param {*} value - Value
   * @param {string} key - Optional key
   * @returns {Promise<*>}
   */
  async put(storeName, value, key) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = key ? store.put(value, key) : store.put(value);
    return this.promisify(request);
  }

  /**
   * Delete object from store
   * @param {string} storeName - Store name
   * @param {string} key - Key
   * @returns {Promise<void>}
   */
  async delete(storeName, key) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return this.promisify(store.delete(key));
  }

  /**
   * Clear all objects from store
   * @param {string} storeName - Store name
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return this.promisify(store.clear());
  }

  /**
   * Query store by index
   * @param {string} storeName - Store name
   * @param {string} indexName - Index name
   * @param {*} value - Value to query
   * @returns {Promise<Array>}
   */
  async getAllByIndex(storeName, indexName, value) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return this.promisify(index.getAll(value));
  }

  /**
   * Count objects in store
   * @param {string} storeName - Store name
   * @returns {Promise<number>}
   */
  async count(storeName) {
    const tx = this.db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return this.promisify(store.count());
  }

  /**
   * Execute transaction
   * @param {string[]} storeNames - Store names
   * @param {string} mode - Transaction mode
   * @param {Function} callback - Transaction callback
   * @returns {Promise<*>}
   */
  async transaction(storeNames, mode, callback) {
    const tx = this.db.transaction(storeNames, mode);
    const result = await callback(tx);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Convert IDBRequest to Promise
   * @param {IDBRequest} request - IDB request
   * @returns {Promise<*>}
   */
  promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
