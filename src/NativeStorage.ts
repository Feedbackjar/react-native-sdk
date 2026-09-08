import { NativeModules } from 'react-native';

// Provided by the Metro/RN runtime; typed here so the soft require below
// doesn't need @types/node.
declare const require: (name: string) => unknown;

interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Persistence for the anon id and remembered identity, resolved once in this
 * order:
 *
 *  1. `FeedbackJarStorage` — the SDK's own native module (UserDefaults /
 *     SharedPreferences). Present in bare / dev-client builds.
 *  2. `@react-native-async-storage/async-storage` — an OPTIONAL peer dep. Lets
 *     things persist in Expo Go (which bundles it) and in any app that already
 *     has it, without the SDK requiring it.
 *  3. An in-memory map — last resort. Values don't survive a reload; a one-time
 *     warning is logged so this isn't a silent failure.
 */
function resolveStore(): KeyValueStore {
  const native = NativeModules.FeedbackJarStorage as KeyValueStore | undefined;
  if (native) return native;

  try {
    // Soft require — never listed as a hard dependency.
    const mod = require('@react-native-async-storage/async-storage') as
      | { default?: KeyValueStore }
      | KeyValueStore
      | undefined;
    const asyncStorage = (
      mod && 'default' in mod ? mod.default : mod
    ) as KeyValueStore | undefined;
    if (asyncStorage?.getItem) return asyncStorage;
  } catch {
    // not installed
  }

  if (!warned) {
    warned = true;
    console.warn(
      '[FeedbackJar] No persistent storage available — the anonymous id and ' +
        'remembered identity will reset on reload. Use a dev/bare build (the ' +
        "SDK's native module autolinks) or install " +
        '@react-native-async-storage/async-storage for Expo Go.',
    );
  }
  return memoryStore;
}

let warned = false;

const memoryMap = new Map<string, string>();
const memoryStore: KeyValueStore = {
  getItem: (key) => Promise.resolve(memoryMap.get(key) ?? null),
  setItem: (key, value) => {
    memoryMap.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    memoryMap.delete(key);
    return Promise.resolve();
  },
};

let store: KeyValueStore | null = null;
function getStore(): KeyValueStore {
  if (!store) store = resolveStore();
  return store;
}

export async function getStoredItem(key: string): Promise<string | null> {
  try {
    return await getStore().getItem(key);
  } catch {
    return null;
  }
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  try {
    await getStore().setItem(key, value);
  } catch {
    // Best-effort — storage failures shouldn't block submission.
  }
}

export async function removeStoredItem(key: string): Promise<void> {
  try {
    await getStore().removeItem(key);
  } catch {
    // Best-effort — storage failures shouldn't block clearing identity in memory.
  }
}
