import { getStoredItem, setStoredItem } from './NativeStorage';

const ANON_ID_STORAGE_KEY = 'com.feedbackjar.sdk.anonId';

let cached: string | null = null;
let pending: Promise<string> | null = null;

/** RFC-4122 v4, from `Math.random` — this id only needs to be unique, not
 *  unguessable (the server HMACs it before storage). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * A stable per-install anonymous id, persisted via the SDK's native storage.
 * Used to attribute guest votes/comments to the same device. Not a device id —
 * a fresh random value that resets on reinstall / clear-data.
 */
export async function getAnonId(): Promise<string> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const existing = await getStoredItem(ANON_ID_STORAGE_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = uuidv4();
    await setStoredItem(ANON_ID_STORAGE_KEY, fresh);
    cached = fresh;
    return fresh;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}
