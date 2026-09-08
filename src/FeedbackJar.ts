import { getConfig as apiGetConfig, listFeedback as apiListFeedback, submitFeedback } from './ApiClient';
import { collectMetadata } from './MetadataCollector';
import { getNativeAppId } from './NativeAppInfo';
import { getStoredItem, removeStoredItem, setStoredItem } from './NativeStorage';
import type { FeedbackIdentity, FeedbackJarResult, FeedbackListResult, FeedbackResponse, WidgetConfig } from './models';

const NAME_STORAGE_KEY = 'com.feedbackjar.sdk.identity.name';
const EMAIL_STORAGE_KEY = 'com.feedbackjar.sdk.identity.email';

interface SubmitOptions {
  email?: string | null;
  name?: string | null;
  /**
   * Custom key/value pairs (e.g. `{ flavor: 'foss' }`) merged into the auto-collected
   * `app` metadata. Values should be string, number, or boolean — nested objects/arrays
   * aren't supported.
   */
  properties?: Record<string, unknown>;
}

/**
 * FeedbackJar React Native SDK.
 *
 * Configure once before use — typically in your root component or App.tsx:
 * ```ts
 * FeedbackJar.configure({ widgetId: 'your-widget-id' });
 * ```
 *
 * Promise submission:
 * ```ts
 * const result = await FeedbackJar.submit('Love the dark mode!');
 * if (result.ok) console.log('Posted:', result.value.postId);
 * else console.error('Failed:', result.error.message);
 * ```
 *
 * Callback submission:
 * ```ts
 * FeedbackJar.submit('Love the dark mode!', (result) => {
 *   if (result.ok) console.log('Posted:', result.value.postId);
 * });
 * ```
 *
 * Name/email passed to `submit` are remembered automatically and reused on later
 * calls. Manage them directly with `setIdentity`, `getIdentity`, and `clearIdentity`.
 */
class FeedbackJarClass {
  private widgetId: string | null = null;

  configure({ widgetId }: { widgetId: string }): void {
    this.widgetId = widgetId;
  }

  /**
   * Remember a submitter's name/email so future `submit` calls reuse them
   * automatically. Pass `undefined`/omit a field to leave it unchanged; use
   * `clearIdentity()` to remove both.
   */
  async setIdentity(identity: { name?: string | null; email?: string | null }): Promise<void> {
    await Promise.all([
      identity.name != null ? setStoredItem(NAME_STORAGE_KEY, identity.name) : Promise.resolve(),
      identity.email != null ? setStoredItem(EMAIL_STORAGE_KEY, identity.email) : Promise.resolve(),
    ]);
  }

  /**
   * The currently remembered submitter identity, if any.
   */
  async getIdentity(): Promise<FeedbackIdentity> {
    const [name, email] = await Promise.all([
      getStoredItem(NAME_STORAGE_KEY),
      getStoredItem(EMAIL_STORAGE_KEY),
    ]);
    return { name, email };
  }

  /**
   * Forget the remembered submitter identity (e.g. on user logout).
   */
  async clearIdentity(): Promise<void> {
    await Promise.all([removeStoredItem(NAME_STORAGE_KEY), removeStoredItem(EMAIL_STORAGE_KEY)]);
  }

  /**
   * Fetch this widget's organization config, including whether it asks submitters
   * for their name/email ("Ask for Name" / "Ask for Email" in the dashboard).
   *
   * Use this to decide whether your own submission UI should show those fields —
   * the SDK does not render any UI itself.
   */
  async getConfig(): Promise<FeedbackJarResult<WidgetConfig>> {
    if (!this.widgetId) {
      return { ok: false, error: new Error('FeedbackJar not configured. Call FeedbackJar.configure() first.') };
    }
    return apiGetConfig(this.widgetId, getNativeAppId());
  }

  /**
   * Submit feedback. Device metadata is collected automatically.
   * Returns a Promise that always resolves — never rejects.
   *
   * @param content  The feedback text.
   * @param options  Optional `email`/`name` for headless/anonymous submissions, and
   *                 `properties` for your own custom context (never overwrites device metadata).
   */
  async submit(content: string, options?: SubmitOptions): Promise<FeedbackJarResult<FeedbackResponse>>;

  /**
   * Callback variant. Safe to call from the main thread.
   */
  submit(content: string, options: SubmitOptions | undefined, callback: (result: FeedbackJarResult<FeedbackResponse>) => void): void;

  submit(
    content: string,
    optionsOrCallback?: SubmitOptions | ((result: FeedbackJarResult<FeedbackResponse>) => void),
    callback?: (result: FeedbackJarResult<FeedbackResponse>) => void,
  ): Promise<FeedbackJarResult<FeedbackResponse>> | void {
    if (typeof optionsOrCallback === 'function') {
      this._submit(content, {}).then(optionsOrCallback);
      return;
    }
    if (callback) {
      this._submit(content, optionsOrCallback ?? {}).then(callback);
      return;
    }
    return this._submit(content, optionsOrCallback ?? {});
  }

  private async _submit(
    content: string,
    options: SubmitOptions,
  ): Promise<FeedbackJarResult<FeedbackResponse>> {
    if (!this.widgetId) {
      return { ok: false, error: new Error('FeedbackJar not configured. Call FeedbackJar.configure() first.') };
    }
    if (options.email != null || options.name != null) {
      await this.setIdentity({ name: options.name, email: options.email });
    }
    const identity = await this.getIdentity();
    const metadata = collectMetadata();
    if (options.properties && Object.keys(options.properties).length > 0) {
      Object.assign(metadata.app, options.properties);
    }
    return submitFeedback(
      this.widgetId,
      {
        content,
        email: options.email ?? identity.email,
        userName: options.name ?? identity.name,
        metadata,
      },
      getNativeAppId(),
    );
  }

  /**
   * List public feedback for this widget's organization.
   *
   * @param boardId  optional — filter to a specific board
   * @param limit    max items per page (1–50, default 20)
   * @param cursor   pagination cursor from a previous `FeedbackListResult.nextCursor`
   */
  async listFeedback(options?: {
    boardId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<FeedbackJarResult<FeedbackListResult>>;

  /**
   * Callback variant. Safe to call from the main thread.
   */
  listFeedback(
    options: { boardId?: string; limit?: number; cursor?: string } | undefined,
    callback: (result: FeedbackJarResult<FeedbackListResult>) => void,
  ): void;

  listFeedback(
    options?: { boardId?: string; limit?: number; cursor?: string },
    callback?: (result: FeedbackJarResult<FeedbackListResult>) => void,
  ): Promise<FeedbackJarResult<FeedbackListResult>> | void {
    if (callback) {
      this._listFeedback(options).then(callback);
      return;
    }
    return this._listFeedback(options);
  }

  private async _listFeedback(
    options?: { boardId?: string; limit?: number; cursor?: string },
  ): Promise<FeedbackJarResult<FeedbackListResult>> {
    if (!this.widgetId) {
      return { ok: false, error: new Error('FeedbackJar not configured. Call FeedbackJar.configure() first.') };
    }
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    return apiListFeedback(
      this.widgetId,
      options?.boardId,
      limit,
      options?.cursor,
      getNativeAppId(),
    );
  }
}

export const FeedbackJar = new FeedbackJarClass();
