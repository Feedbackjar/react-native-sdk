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

export function collectMetadata(): DeviceMetadata {
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
    app: getNativeAppInfo(),
    sdk: 'react-native',
    timestamp: new Date().toISOString(),
  };
}
