import { NativeModules } from 'react-native';

type NativeStorageModule = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const module = NativeModules.FeedbackJarStorage as NativeStorageModule | undefined;

export async function getStoredItem(key: string): Promise<string | null> {
  if (!module) return null;
  try {
    return await module.getItem(key);
  } catch {
    return null;
  }
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  if (!module) return;
  try {
    await module.setItem(key, value);
  } catch {
    // Best-effort — storage failures shouldn't block submission.
  }
}

export async function removeStoredItem(key: string): Promise<void> {
  if (!module) return;
  try {
    await module.removeItem(key);
  } catch {
    // Best-effort — storage failures shouldn't block clearing identity in memory.
  }
}
