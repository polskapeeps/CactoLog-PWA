import { collection, doc, setDoc, getDocs, deleteDoc, query, where, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db as firestore, getCurrentUser } from './firebase.js';
import { DB } from './db.js';

const localDB = new DB('cactolog', 2);

// Sync queue for offline operations
const syncQueue = [];
let isOnline = navigator.onLine;

// Network status listeners
window.addEventListener('online', () => {
  isOnline = true;
  processSyncQueue();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

/**
 * Get user's Firestore collection path
 */
function getUserPath(collectionName) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  return `users/${user.uid}/${collectionName}`;
}

/**
 * Sync all plants from Firestore to IndexedDB
 */
export async function syncPlantsFromFirestore() {
  const user = getCurrentUser();
  if (!user) return [];

  try {
    const plantsRef = collection(firestore, getUserPath('plants'));
    const snapshot = await getDocs(plantsRef);

    const plants = [];
    for (const docSnap of snapshot.docs) {
      const data = { id: docSnap.id, ...docSnap.data() };
      await localDB.put('plants', data);
      plants.push(data);
    }

    return plants;
  } catch (error) {
    console.error('Failed to sync plants from Firestore:', error);
    // Return local data as fallback
    return await localDB.getAll('plants');
  }
}

/**
 * Sync all activities from Firestore to IndexedDB
 */
export async function syncActivitiesFromFirestore() {
  const user = getCurrentUser();
  if (!user) return [];

  try {
    const activitiesRef = collection(firestore, getUserPath('activities'));
    const snapshot = await getDocs(activitiesRef);

    const activities = [];
    for (const docSnap of snapshot.docs) {
      const data = { id: docSnap.id, ...docSnap.data() };
      await localDB.put('activities', data);
      activities.push(data);
    }

    return activities;
  } catch (error) {
    console.error('Failed to sync activities from Firestore:', error);
    return await localDB.getAll('activities');
  }
}

/**
 * Save plant to both IndexedDB and Firestore
 */
export async function savePlant(plantData) {
  const user = getCurrentUser();

  // Always save locally first (instant UI)
  await localDB.put('plants', plantData);

  // Queue for Firestore sync
  if (user && isOnline) {
    try {
      const plantRef = doc(firestore, getUserPath('plants'), plantData.id);
      await setDoc(plantRef, {
        ...plantData,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to save to Firestore:', error);
      queueSync('plant', 'save', plantData);
    }
  } else if (user) {
    queueSync('plant', 'save', plantData);
  }

  return plantData;
}

/**
 * Delete plant from both IndexedDB and Firestore
 */
export async function deletePlant(plantId) {
  const user = getCurrentUser();

  const relatedActivities = await localDB.getAll('activities', 'by_plant', plantId) || [];

  // Delete locally
  await localDB.delete('plants', plantId);
  for (const activity of relatedActivities) {
    await localDB.delete('activities', activity.id);
  }

  // Delete from Firestore
  if (user && isOnline) {
    try {
      const plantRef = doc(firestore, getUserPath('plants'), plantId);
      await deleteDoc(plantRef);

      if (relatedActivities.length) {
        const activitiesRef = collection(firestore, getUserPath('activities'));
        const activitiesQuery = query(activitiesRef, where('plantId', '==', plantId));
        const snapshot = await getDocs(activitiesQuery);
        if (!snapshot.empty) {
          const batch = writeBatch(firestore);
          snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }
    } catch (error) {
      console.error('Failed to delete from Firestore:', error);
      queueSync('plant', 'delete', { id: plantId });
      for (const activity of relatedActivities) {
        queueSync('activity', 'delete', { id: activity.id });
      }
    }
  } else if (user) {
    queueSync('plant', 'delete', { id: plantId });
    for (const activity of relatedActivities) {
      queueSync('activity', 'delete', { id: activity.id });
    }
  }
}

/**
 * Save activity to both IndexedDB and Firestore
 */
export async function saveActivity(activityData) {
  const user = getCurrentUser();

  // Save locally
  await localDB.put('activities', activityData);

  // Save to Firestore
  if (user && isOnline) {
    try {
      const activityRef = doc(firestore, getUserPath('activities'), activityData.id);
      await setDoc(activityRef, {
        ...activityData,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to save activity to Firestore:', error);
      queueSync('activity', 'save', activityData);
    }
  } else if (user) {
    queueSync('activity', 'save', activityData);
  }

  return activityData;
}

export async function deleteActivity(activityId) {
  const user = getCurrentUser();

  await localDB.delete('activities', activityId);

  if (user && isOnline) {
    try {
      const activityRef = doc(firestore, getUserPath('activities'), activityId);
      await deleteDoc(activityRef);
    } catch (error) {
      console.error('Failed to delete activity from Firestore:', error);
      queueSync('activity', 'delete', { id: activityId });
    }
  } else if (user) {
    queueSync('activity', 'delete', { id: activityId });
  }

  return true;
}

/**
 * Queue operation for later sync
 */
function queueSync(type, operation, data) {
  syncQueue.push({ type, operation, data, timestamp: Date.now() });
  localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
}

/**
 * Process queued sync operations
 */
async function processSyncQueue() {
  if (!isOnline || syncQueue.length === 0) return;

  const queue = [...syncQueue];
  syncQueue.length = 0;

  for (const item of queue) {
    try {
      if (item.type === 'plant' && item.operation === 'save') {
        await savePlant(item.data);
      } else if (item.type === 'plant' && item.operation === 'delete') {
        await deletePlant(item.data.id);
      } else if (item.type === 'activity' && item.operation === 'save') {
        await saveActivity(item.data);
      } else if (item.type === 'activity' && item.operation === 'delete') {
        await deleteActivity(item.data.id);
      }
    } catch (error) {
      console.error('Failed to process sync item:', error);
      syncQueue.push(item); // Re-queue failed items
    }
  }

  localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
}

/**
 * Load sync queue from localStorage
 */
export function loadSyncQueue() {
  try {
    const stored = localStorage.getItem('syncQueue');
    if (stored) {
      const items = JSON.parse(stored);
      syncQueue.push(...items);
    }
  } catch (error) {
    console.error('Failed to load sync queue:', error);
  }

  if (isOnline && syncQueue.length) {
    processSyncQueue().catch((error) => {
      console.error('Failed to process queued sync items:', error);
    });
  }
}

/**
 * Set up real-time listeners for Firestore changes
 */
export function setupRealtimeListeners(onPlantsChange, onActivitiesChange) {
  const user = getCurrentUser();
  if (!user) return;

  // Listen to plants
  const plantsRef = collection(firestore, getUserPath('plants'));
  const unsubscribePlants = onSnapshot(plantsRef, async (snapshot) => {
    const plants = [];
    for (const docSnap of snapshot.docs) {
      const data = { id: docSnap.id, ...docSnap.data() };
      await localDB.put('plants', data);
      plants.push(data);
    }
    if (onPlantsChange) onPlantsChange(plants);
  });

  // Listen to activities
  const activitiesRef = collection(firestore, getUserPath('activities'));
  const unsubscribeActivities = onSnapshot(activitiesRef, async (snapshot) => {
    const activities = [];
    for (const docSnap of snapshot.docs) {
      const data = { id: docSnap.id, ...docSnap.data() };
      await localDB.put('activities', data);
      activities.push(data);
    }
    if (onActivitiesChange) onActivitiesChange(activities);
  });

  return () => {
    unsubscribePlants();
    unsubscribeActivities();
  };
}

/**
 * Get plant by ID
 */
export async function getPlant(plantId) {
  return await localDB.get('plants', plantId);
}

/**
 * Get all plants from local cache
 */
export async function getAllPlants() {
  return await localDB.getAll('plants');
}

/**
 * Get all activities from local cache
 */
export async function getAllActivities() {
  return await localDB.getAll('activities');
}
