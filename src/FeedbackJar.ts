import {
  createComment as apiCreateComment,
  getConfig as apiGetConfig,
  getVoteState as apiGetVoteState,
  getPost as apiGetPost,
  identify as apiIdentify,
  listComments as apiListComments,
  listFeedback as apiListFeedback,
  submitFeedback,
  unvotePost as apiUnvotePost,
  voteOnPost as apiVoteOnPost,
} from './ApiClient';
import { getAnonId } from './AnonId';
import { collectMetadata } from './MetadataCollector';
import { getNativeAppId } from './NativeAppInfo';
import { getStoredItem, removeStoredItem, setStoredItem } from './NativeStorage';
import type {
  FeedbackCommentListResult,
  FeedbackIdentity,
  FeedbackJarResult,
  FeedbackListResult,
  FeedbackPost,
  FeedbackResponse,
  VoteState,
  WidgetConfig,
} from './models';

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
interface ConfigureOptions {
  widgetId: string;
  /**
   * App version to report in submission metadata (e.g. `"1.4.0"`). Use this when
   * the SDK's native module can't read it — for example in Expo Go, or when you
   * prefer a value from `expo-application` / `react-native-device-info`. Falls
   * back to the native `CFBundleShortVersionString` / `versionName`.
   */
  appVersion?: string | null;
  /** Build number to report in submission metadata (e.g. `"42"`). */
  appBuild?: string | null;
}

class FeedbackJarClass {
  private widgetId: string | null = null;
  private appVersion: string | null = null;
  private appBuild: string | null = null;

  configure({ widgetId, appVersion, appBuild }: ConfigureOptions): void {
    this.widgetId = widgetId;
    this.appVersion = appVersion ?? null;
    this.appBuild = appBuild ?? null;
  }

  private requireWidgetId(): FeedbackJarResult<never> | null {
    if (!this.widgetId) {
      return {
        ok: false,
        error: new Error('FeedbackJar not configured. Call FeedbackJar.configure() first.'),
      };
    }
    return null;
  }

  /**
   * Remember a submitter's name/email so future `submit` calls reuse them
   * automatically. Pass `undefined`/omit a field to leave it unchanged; use
   * `clearIdentity()` to remove both.
   *
   * When configured, the name/email are also synced to the server against this
   * device's anonymous id, so guest votes/comments show the right name and can
   * be reconciled if the user later signs into the web portal with that email.
   */
  async setIdentity(identity: { name?: string | null; email?: string | null }): Promise<void> {
    await Promise.all([
      identity.name != null ? setStoredItem(NAME_STORAGE_KEY, identity.name) : Promise.resolve(),
      identity.email != null ? setStoredItem(EMAIL_STORAGE_KEY, identity.email) : Promise.resolve(),
    ]);

    if (this.widgetId && (identity.name != null || identity.email != null)) {
      const anonId = await getAnonId();
      await apiIdentify(
        this.widgetId,
        { name: identity.name, email: identity.email },
        getNativeAppId(),
        anonId,
      ).catch(() => {
        // Best-effort — a failed sync must not break local identity.
      });
    }
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
    const metadata = collectMetadata({ version: this.appVersion, build: this.appBuild });
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
    const anonId = await getAnonId();
    return apiListFeedback(
      this.widgetId,
      options?.boardId,
      limit,
      options?.cursor,
      getNativeAppId(),
      anonId,
    );
  }

  /**
   * Fetch a single public post by id — used to resolve `#[title](postId)`
   * mention jump-links. Same visibility rules as `listFeedback`.
   */
  async getPost(postId: string): Promise<FeedbackJarResult<FeedbackPost>> {
    if (!this.widgetId) {
      return { ok: false, error: new Error('FeedbackJar not configured. Call FeedbackJar.configure() first.') };
    }
    return apiGetPost(this.widgetId, postId, getNativeAppId(), await getAnonId());
  }

  /**
   * Upvote a post as this device's anonymous guest. Idempotent — voting twice
   * is a no-op. Requires guest voting to be enabled for the project
   * (`WidgetConfig.allowVotes`). Returns the new count and vote state.
   */
  async vote(postId: string): Promise<FeedbackJarResult<VoteState>> {
    const notReady = this.requireWidgetId();
    if (notReady) return notReady;
    return apiVoteOnPost(this.widgetId!, postId, getNativeAppId(), await getAnonId());
  }

  /** Remove this device's upvote from a post. Idempotent. */
  async unvote(postId: string): Promise<FeedbackJarResult<VoteState>> {
    const notReady = this.requireWidgetId();
    if (notReady) return notReady;
    return apiUnvotePost(this.widgetId!, postId, getNativeAppId(), await getAnonId());
  }

  /** Current upvote count and whether this device has voted on the post. */
  async getVoteState(postId: string): Promise<FeedbackJarResult<VoteState>> {
    const notReady = this.requireWidgetId();
    if (notReady) return notReady;
    return apiGetVoteState(this.widgetId!, postId, getNativeAppId(), await getAnonId());
  }

  /**
   * List public comments for a post (two-level threads). Anonymous — no
   * identity required.
   */
  async listComments(
    postId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<FeedbackJarResult<FeedbackCommentListResult>> {
    const notReady = this.requireWidgetId();
    if (notReady) return notReady;
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    return apiListComments(
      this.widgetId!,
      postId,
      limit,
      options?.cursor,
      getNativeAppId(),
    );
  }

  /**
   * Add a public comment (or reply, via `parentId`) as this device's anonymous
   * guest. `name`/`email` fall back to the remembered identity; email is used
   * only for reply notifications. Requires guest comments to be enabled
   * (`WidgetConfig.allowComments`).
   */
  async addComment(
    postId: string,
    content: string,
    options?: { parentId?: string; name?: string | null; email?: string | null },
  ): Promise<FeedbackJarResult<{ id: string }>> {
    const notReady = this.requireWidgetId();
    if (notReady) return notReady;
    const identity = await this.getIdentity();
    return apiCreateComment(
      this.widgetId!,
      postId,
      {
        content,
        parentId: options?.parentId,
        name: options?.name ?? identity.name,
        email: options?.email ?? identity.email,
      },
      getNativeAppId(),
      await getAnonId(),
    );
  }
}

export const FeedbackJar = new FeedbackJarClass();
