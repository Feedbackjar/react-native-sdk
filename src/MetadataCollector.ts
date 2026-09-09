import { Dimensions, NativeModules, Platform } from 'react-native';
import { getNativeAppInfo } from './NativeAppInfo';

interface DeviceMetadata {
  os: {
    name: string;
    version: string;
  };
  screen: {
    width: number;
    height: number;
    scale: number;
  };
  locale: {
    language: string;
    region: string;
    timezone: string;
  };
  app: Record<string, unknown>;
  sdk: string;
  timestamp: string;
}

function getLocaleString(): string {
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings;
    return (
      settings?.AppleLocale ||
      (Array.isArray(settings?.AppleLanguages) && settings.AppleLanguages[0]) ||
      'en-US'
    );
  }
  return NativeModules.I18nManager?.localeIdentifier || 'en-US';
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export interface AppInfoOverride {
  /** App version string, e.g. `"1.4.0"`. Overrides the native value. */
  version?: string | null;
  /** Build number, e.g. `"42"`. Overrides the native value. */
  build?: string | null;
}

/**
 * Merge caller-supplied version/build over the native `app` info, using the
 * per-platform key names the dashboard expects (`version`/`build` on iOS,
 * `versionName`/`versionCode` on Android).
 */
function resolveAppInfo(override?: AppInfoOverride): Record<string, unknown> {
  const app: Record<string, unknown> = { ...getNativeAppInfo() };
  const versionKey = Platform.OS === 'ios' ? 'version' : 'versionName';
  const buildKey = Platform.OS === 'ios' ? 'build' : 'versionCode';
  if (override?.version) app[versionKey] = override.version;
  if (override?.build) app[buildKey] = override.build;
  return app;
}

export function collectMetadata(appOverride?: AppInfoOverride): DeviceMetadata {
  const { width, height, scale } = Dimensions.get('screen');
  const localeStr = getLocaleString();
  const parts = localeStr.replace('-', '_').split('_');

  return {
    os: {
      name: Platform.OS === 'ios' ? 'iOS' : 'Android',
      version: String(Platform.Version),
    },
    screen: { width, height, scale },
    locale: {
      language: parts[0] || 'en',
      region: parts[1] || '',
      timezone: getTimezone(),
    },
    app: resolveAppInfo(appOverride),
    sdk: 'react-native',
    timestamp: new Date().toISOString(),
  };
}
