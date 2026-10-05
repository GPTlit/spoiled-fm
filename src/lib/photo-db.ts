export interface PhotoRecord {
  id: string;
  blob: Blob;
  url?: string;
  title: string;
  date: number;
  width?: number;
  height?: number;
  filter?: string;
}

const DB_NAME = "spoiled-photo-gallery";
const DB_VERSION = 1;
const STORE_NAME = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not available in this environment"));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(
  blob: Blob,
  meta?: { title?: string; filter?: string; width?: number; height?: number },
): Promise<PhotoRecord> {
  const db = await openDb();
  const id = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: PhotoRecord = {
    id,
    blob,
    title:
      meta?.title ||
      `Capture ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    date: Date.now(),
    filter: meta?.filter || "normal",
    width: meta?.width,
    height: meta?.height,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      ...record,
      url: undefined, // URLs recreated at runtime
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  record.url = URL.createObjectURL(blob);
  return record;
}

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  try {
    const db = await openDb();
    const records = await new Promise<PhotoRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as PhotoRecord[]);
      req.onerror = () => reject(req.error);
    });
    db.close();

    return records
      .map((r) => ({
        ...r,
        url: URL.createObjectURL(r.blob),
      }))
      .sort((a, b) => b.date - a.date);
  } catch (err) {
    console.error("Error loading photos:", err);
    return [];
  }
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
