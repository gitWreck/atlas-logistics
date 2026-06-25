import * as FileSystem from "expo-file-system";

const OFFLINE_PHOTOS_DIR = `${FileSystem.documentDirectory}offline-photos/`;

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(OFFLINE_PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_PHOTOS_DIR, {
      intermediates: true,
    });
  }
}

export async function persistOfflinePhotos(operationId, photoUris = []) {
  if (!photoUris.length) return [];
  await ensurePhotoDir();

  const stored = [];
  for (let i = 0; i < photoUris.length; i += 1) {
    const sourceUri = photoUris[i];
    const dest = `${OFFLINE_PHOTOS_DIR}${operationId}_${i}.jpg`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    stored.push(dest);
  }
  return stored;
}

export async function deleteOfflinePhotos(paths = []) {
  await Promise.all(
    paths.map(async (path) => {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      } catch (error) {
        console.warn("deleteOfflinePhotos failed:", path, error);
      }
    }),
  );
}
