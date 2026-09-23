import { NativeModules, Platform } from 'react-native';

type NativeAppInfoModule = {
  bundleId?: string;
  packageName?: string;
  version?: string;
  build?: string;
};

const module = NativeModules.FeedbackJarAppInfo as NativeAppInfoModule | undefined;

export function getNativeAppId(): string {
  if (Platform.OS === 'ios') {
    return module?.bundleId?.trim() || '';
  }
  return module?.packageName?.trim() || '';
}

export function getNativeAppInfo():
  | { bundleId: string; version: string; build: string }
  | { packageName: string; versionName: string; versionCode: string } {
  if (Platform.OS === 'ios') {
    return {
      bundleId: module?.bundleId?.trim() || '',
      version: module?.version?.trim() || 'unknown',
      build: module?.build?.trim() || 'unknown',
    };
  }

  return {
    packageName: module?.packageName?.trim() || '',
    versionName: module?.version?.trim() || 'unknown',
    versionCode: module?.build?.trim() || 'unknown',
  };
}
