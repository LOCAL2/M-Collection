// Image optimization utilities for faster upload and display

// Compress image before upload
export const compressImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85
): Promise<File> => {
  // Skip if not an image or already small
  if (!file.type.startsWith('image/') || file.size < 100 * 1024) {
    return file;
  }

  // Skip GIFs to preserve animation
  if (file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            // Only use compressed if smaller
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
};

// Generate thumbnail URL with Supabase transform
// Note: Supabase Image Transform ต้องเปิดใช้งานใน Dashboard ก่อน
// ถ้าไม่ได้เปิด จะ fallback ไปใช้ URL เดิม
export const getThumbnailUrl = (url: string, _width = 400): string => {
  // ใช้ URL เดิมไปก่อน เพราะ Supabase Transform อาจไม่ได้เปิด
  // ถ้าต้องการใช้ Transform ให้ uncomment code ด้านล่าง
  // if (url.includes('supabase.co/storage')) {
  //   const transformUrl = url.replace(
  //     '/object/public/',
  //     `/render/image/public/`
  //   );
  //   return `${transformUrl}?width=${width}&quality=75`;
  // }
  return url;
};

// Preload image
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// Image cache using IndexedDB for persistent storage
const DB_NAME = 'image-cache';
const STORE_NAME = 'images';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });

  return dbPromise;
};

export const getCachedImage = async (url: string): Promise<string | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() - result.timestamp < CACHE_EXPIRY) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const setCachedImage = async (url: string, blob: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ url, blob, timestamp: Date.now() });
  } catch {
    // Ignore cache errors
  }
};
