/**
 * SDK identity, sent on every request as `X-FeedbackJar-SDK: <name>/<version>`
 * and mirrored into submission metadata (`sdk` / `sdkVersion`).
 *
 * Keep `SDK_VERSION` in sync with `package.json` on every release.
 */
export const SDK_NAME = 'react-native';
export const SDK_VERSION = '0.7.0';

/** e.g. `"react-native/0.6.0"`. */
export const SDK_IDENTIFIER = `${SDK_NAME}/${SDK_VERSION}`;
