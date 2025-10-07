import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, getCurrentUser } from './firebase.js';
import imageCompression from 'browser-image-compression';

/**
 * Compress and resize image for upload
 * @param {File} file - Image file
 * @param {number} maxSizeMB - Max size in MB
 * @param {number} maxWidthOrHeight - Max dimension
 * @returns {Promise<Blob>} Compressed image
 */
async function compressImage(file, maxSizeMB = 1, maxWidthOrHeight = 1200) {
  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/jpeg'
  };

  try {
    const compressed = await imageCompression(file, options);
    return compressed;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file;
  }
}

/**
 * Upload plant photo to Firebase Storage
 * @param {File} file - Image file
 * @param {string} plantId - Plant ID
 * @returns {Promise<string>} Download URL
 */
export async function uploadPlantPhoto(file, plantId) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  // Compress image
  const compressed = await compressImage(file);

  // Create storage reference
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storageRef = ref(storage, `users/${user.uid}/plants/${plantId}/${fileName}`);

  // Upload
  await uploadBytes(storageRef, compressed);

  // Get download URL
  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * Upload plant photo thumbnail
 * @param {File} file - Image file
 * @param {string} plantId - Plant ID
 * @returns {Promise<string>} Download URL for thumbnail
 */
export async function uploadPlantThumbnail(file, plantId) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  // Compress to smaller thumbnail
  const compressed = await compressImage(file, 0.3, 400);

  const timestamp = Date.now();
  const fileName = `thumb_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storageRef = ref(storage, `users/${user.uid}/plants/${plantId}/thumbnails/${fileName}`);

  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * Upload activity photo
 * @param {File} file - Image file
 * @param {string} activityId - Activity ID
 * @returns {Promise<string>} Download URL
 */
export async function uploadActivityPhoto(file, activityId) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const compressed = await compressImage(file, 0.5, 800);

  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const storageRef = ref(storage, `users/${user.uid}/activities/${activityId}/${fileName}`);

  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * Delete photo from Firebase Storage
 * @param {string} photoURL - Full photo URL
 */
export async function deletePhoto(photoURL) {
  if (!photoURL) return;

  try {
    // Extract storage path from URL
    const url = new URL(photoURL);
    const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
    const photoRef = ref(storage, path);

    await deleteObject(photoRef);
  } catch (error) {
    console.error('Failed to delete photo:', error);
  }
}

/**
 * Convert file to data URL (for offline fallback)
 * @param {File} file - Image file
 * @returns {Promise<string>} Data URL
 */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
