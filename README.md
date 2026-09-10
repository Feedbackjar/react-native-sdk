# FeedbackJar React Native SDK

A lightweight React Native SDK for collecting user feedback from iOS and Android apps. You build your own form — the SDK handles submission (enriched with device metadata) and fetching the public feedback list.

- **Min React Native:** 0.70.0
- **Platforms:** iOS & Android
- **Package:** `@feedbackjar/react-native-sdk`
- **License:** MIT

## Installation

```sh
npm install @feedbackjar/react-native-sdk
# or
yarn add @feedbackjar/react-native-sdk
# or
pnpm add @feedbackjar/react-native-sdk
```

The SDK ships two small native modules (autolinked automatically, no manual linking step) — one to read your app's bundle ID/package name, one to persist the anon id and submitter identity via `UserDefaults`/`SharedPreferences`. No dependencies are required.

> **Expo Go:** custom native modules don't load in Expo Go, so on-device values won't persist there. Install the optional `@react-native-async-storage/async-storage` (`npx expo install @react-native-async-storage/async-storage`) as a fallback, or use a dev/bare build.

## Setup

Configure once before use — typically in your root `App.tsx` or entry file. You need your **widget ID** from the FeedbackJar dashboard.

```ts
import { FeedbackJar } from '@feedbackjar/react-native-sdk';

FeedbackJar.configure({ widgetId: 'your-widget-id' });
```

### App version in metadata

The SDK's native module reports the app version/build automatically in bare and
dev-client builds. It **can't** in Expo Go — pass the values yourself so the
dashboard shows them instead of `unknown`:

```ts
import * as Application from 'expo-application';

FeedbackJar.configure({
  widgetId: 'your-widget-id',
  appVersion: Application.nativeApplicationVersion, // "1.4.0"
  appBuild: Application.nativeBuildVersion,         // "42"
});
```

A supplied value always wins over the native one.

## Prebuilt UI

If you don't want to build your own screens, drop in `FeedbackJarBoard` — a
complete feedback board (list, upvote, detail, comments, submission). It's built
only on React Native primitives, so it adds **no dependency**.

```tsx
import { FeedbackJarBoard } from '@feedbackjar/react-native-sdk';

function FeedbackScreen() {
  return <FeedbackJarBoard accentColor="#e5484d" />;
}
```

| Prop | Description |
| --- | --- |
| `accentColor?` | Colour for the vote state, primary button and links. Default `#e5484d`. |
| `boardId?` | Restrict the feed to one board. |
| `onClose?` | When set, a "Close" action appears in the header. |

It reads `getConfig()` on mount and hides the vote pills / comment composer when
guest voting / commenting is disabled, and shows name/email fields on the
submission form only when the org asks for them. Follows the system light/dark
setting.

After a submission, the new post can take a few seconds to appear in the public
list (server-side classification / approval). The board shows it right away as a
"Posting…" row and swaps it for the real post once it's live — no manual refresh
needed.

Everything below is the lower-level API if you'd rather build the UI yourself.

## Submitting feedback

Submissions can be anonymous, or include a submitter name/email if you collect them in your own form. Each submission automatically carries device metadata (OS version, screen size, locale, timezone).

### Promise (recommended)

```ts
import { FeedbackJar } from '@feedbackjar/react-native-sdk';

const result = await FeedbackJar.submit(userText);

if (result.ok) {
  console.log('Submitted:', result.value.postId, '—', result.value.type);
  // show a success state in your UI
} else {
  console.error('Failed:', result.error.message);
  // show an error state
}
```

### Callback (no async context needed)

Safe to call from the main thread — the network call runs off the main thread and the callback is invoked when done.

```ts
FeedbackJar.submit(userText, (result) => {
  if (result.ok) {
    // show success state
  } else {
    // show error state
  }
});
```

> **Note:** The server applies rate limiting (5 submissions per 15 minutes per IP). Handle the failure case in your UI.

## Custom properties

Attach your own key/value context to a submission — merged into the auto-collected `app` metadata (alongside the bundle ID/package name and version). Values should be `string`, `number`, or `boolean`; nested objects/arrays aren't supported.

```ts
const result = await FeedbackJar.submit(userText, {
  properties: { flavor: 'foss', plan: 'pro' },
});
```

## Checking whether to ask for name/email

The organization's dashboard settings ("Ask for Name" / "Ask for Email") control whether submitters should be prompted. The SDK doesn't render any UI itself, so read this before building your own form:

```ts
const config = await FeedbackJar.getConfig();
if (config.ok) {
  showNameField = config.value.collectName;
  showEmailField = config.value.collectEmail;
}
```

## Remembering submitter identity

Name/email passed to `submit` are automatically remembered and reused on later calls, so you only need to ask once. Manage this directly with `setIdentity` / `getIdentity` / `clearIdentity`:

```ts
await FeedbackJar.setIdentity({ name: 'Ada Lovelace', email: 'ada@example.com' });

const identity = await FeedbackJar.getIdentity();
console.log(identity.name);

// e.g. on logout
await FeedbackJar.clearIdentity();
```

## Listing feedback

Fetch the public feedback feed for your organization. Supports pagination via a cursor.

### Promise

```ts
const result = await FeedbackJar.listFeedback({ limit: 20 });

if (result.ok) {
  for (const post of result.value.posts) {
    console.log(`${post.title} — ${post.upvotes} upvotes, ${post.status}`);
  }
  // result.value.nextCursor is defined when more pages exist
}
```

### Pagination

```ts
let cursor: string | undefined;

async function loadNextPage() {
  const result = await FeedbackJar.listFeedback({ limit: 20, cursor });
  if (result.ok) {
    renderPosts(result.value.posts);
    cursor = result.value.nextCursor; // pass this back in for the next page
  }
}
```

### Filter by board

```ts
const result = await FeedbackJar.listFeedback({
  boardId: 'your-board-id',
  limit: 10,
});
```

### Callback

```ts
FeedbackJar.listFeedback({ limit: 20 }, (result) => {
  if (result.ok) {
    renderPosts(result.value.posts);
  }
});
```

Each post carries `hasVoted` — whether this device's anonymous id has upvoted it
— so you can render a filled/empty vote button without an extra call.

## Voting

Guest upvoting must be enabled for your project (Settings → "Allow guest votes").
Check `FeedbackJar.getConfig()` → `allowVotes` before showing a vote button.

Votes are attributed to a random per-install id the SDK stores on-device (not a
device identifier — it resets if the app is reinstalled).

```ts
const result = await FeedbackJar.vote(postId);
if (result.ok) {
  console.log(result.value.upvotes, result.value.hasVoted); // 42, true
}

// toggle
await FeedbackJar.unvote(postId);

// read current state (e.g. on a detail screen)
const state = await FeedbackJar.getVoteState(postId);
```

`vote` / `unvote` are idempotent — calling `vote` twice is a no-op, not an error.

## Comments

Reading comments needs no identity. Posting requires guest comments to be
enabled (Settings → "Allow guest comments") — check `getConfig().allowComments`.

```ts
const result = await FeedbackJar.listComments(postId, { limit: 20 });
if (result.ok) {
  for (const comment of result.value.comments) {
    console.log(comment.authorName, comment.content);
    for (const reply of comment.replies) {
      console.log('  ↳', reply.authorName, reply.content);
    }
  }
}

// add a comment (name/email fall back to the remembered identity)
await FeedbackJar.addComment(postId, 'Please add dark mode!');

// reply to a top-level comment
await FeedbackJar.addComment(postId, 'Agreed', { parentId: comment.id });
```

Threads are two levels deep — you cannot reply to a reply. A name/email passed
here (or set via `setIdentity`) is remembered for the submitter; the email is
used only for reply notifications and is never linked to a real account unless
the person later signs into the web portal with it.

## Rich text

Post and comment content can contain light Markdown (**bold**, *italic*, `code`,
`[links](url)`, headings, lists, quotes, fenced code) and FeedbackJar mention
tokens — `#[Post title](postId)` for a post reference and
`@[Name](user:id)` for a person. `FeedbackJarBoard` renders all of this; list
previews are flattened to plain text.

In `FeedbackJarBoard`, tapping a `#[…]` post reference opens that post's detail
screen (fetched via `getPost` when it isn't already loaded). Bare links and
`[text](url)` open in the browser; `@[…]` mentions are styled but not linked.

Building your own UI? The same renderer is exported — no extra dependency:

```tsx
import { RichText, toPlainText, FeedbackJar } from '@feedbackjar/react-native-sdk';

<RichText
  content={post.content}
  onPostPress={async (postId) => {
    const res = await FeedbackJar.getPost(postId);
    if (res.ok) openDetail(res.value);
  }}
/>;

const preview = toPlainText(post.content); // for a truncated row
```

## Example component



```tsx
import React, { useState } from 'react';
import { Button, TextInput, View, Text } from 'react-native';
import { FeedbackJar } from '@feedbackjar/react-native-sdk';

export function FeedbackForm() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit() {
    if (!text.trim()) return;
    setStatus('Submitting…');
    const result = await FeedbackJar.submit(text);
    setStatus(result.ok ? 'Thanks for your feedback!' : `Error: ${result.error.message}`);
    if (result.ok) setText('');
  }

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Share your feedback…"
        multiline
      />
      <Button title="Submit" onPress={handleSubmit} />
      {status ? <Text>{status}</Text> : null}
    </View>
  );
}
```

## API reference

### `FeedbackJar`

| Method | Description |
| --- | --- |
| `configure({ widgetId, appVersion?, appBuild? })` | Configure the SDK. Call once before anything else. `appVersion`/`appBuild` override the native app-version metadata (needed in Expo Go). |
| `submit(content, options?): Promise<FeedbackJarResult<FeedbackResponse>>` | Submit feedback, optionally with `properties` merged into `app` metadata. Never rejects. |
| `submit(content, options, callback)` | Callback variant, main-thread safe. |
| `listFeedback(options?): Promise<FeedbackJarResult<FeedbackListResult>>` | List public feedback. `limit` is clamped to 1–50. |
| `listFeedback(options, callback)` | Callback variant. |
| `getPost(postId): Promise<FeedbackJarResult<FeedbackPost>>` | Fetch one public post — used to resolve `#[…]` mention jump-links. |
| `getConfig(): Promise<FeedbackJarResult<WidgetConfig>>` | Fetch whether the org asks for name/email. |
| `setIdentity({ name?, email? }): Promise<void>` | Remember a submitter's name/email for future `submit` calls; also synced to the server for this device. |
| `getIdentity(): Promise<FeedbackIdentity>` | The currently remembered identity, if any. |
| `clearIdentity(): Promise<void>` | Forget the remembered identity. |
| `vote(postId): Promise<FeedbackJarResult<VoteState>>` | Upvote a post as an anonymous guest. Idempotent. Needs `allowVotes`. |
| `unvote(postId): Promise<FeedbackJarResult<VoteState>>` | Remove this device's upvote. Idempotent. |
| `getVoteState(postId): Promise<FeedbackJarResult<VoteState>>` | Current upvote count + whether this device voted. |
| `listComments(postId, options?): Promise<FeedbackJarResult<FeedbackCommentListResult>>` | Public comment thread (two levels). `limit` clamped 1–50. |
| `addComment(postId, content, options?): Promise<FeedbackJarResult<{ id: string }>>` | Add a comment/reply as a guest. `options.parentId` to reply. Needs `allowComments`. |

### Components & helpers

| Export | Description |
| --- | --- |
| `<FeedbackJarBoard accentColor? boardId? onClose? />` | Drop-in board — list, upvote, detail, comments, submit. |
| `<RichText content onPostPress? />` | Render post/comment content: light Markdown + `#[…]` / `@[…]` mentions. |
| `toPlainText(content): string` | Flatten Markdown + mention tokens to one line (row previews). |

### `FeedbackJarResult<T>`

All methods return a discriminated union — nothing ever throws:

```ts
type FeedbackJarResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };
```

### `FeedbackResponse`

```ts
interface FeedbackResponse {
  postId: string;
  title: string;    // AI-generated title for the submission
  type: string;     // e.g. FEEDBACK, BUG, FEATURE_REQUEST
  boardId: string;
  status?: string;  // initial status, e.g. OPEN or PENDING (approval required)
}
```

### `FeedbackPost`

```ts
interface FeedbackPost {
  id: string;
  title: string;
  content: string;
  type: string;
  status: string;       // OPEN, IN_PROGRESS, COMPLETED, ...
  slug: string;
  boardId: string;
  voteCount: number;
  commentCount: number;
  upvotes: number;
  hasVoted: boolean;    // this device's anon id has upvoted
  authorName?: string;
  createdAt: string;    // ISO-8601
  updatedAt: string;    // ISO-8601
}
```

### `FeedbackListResult`

```ts
interface FeedbackListResult {
  posts: FeedbackPost[];
  nextCursor?: string;  // undefined when there are no more pages
}
```

### `WidgetConfig`

```ts
interface WidgetConfig {
  collectName: boolean;   // org asks for the submitter's name
  collectEmail: boolean;  // org asks for the submitter's email
  allowVotes: boolean;    // guest upvoting enabled
  allowComments: boolean; // guest commenting enabled
}
```

### `VoteState`

```ts
interface VoteState {
  upvotes: number;
  hasVoted: boolean;
}
```

### `FeedbackComment` / `FeedbackCommentListResult`

```ts
interface FeedbackComment {
  id: string;
  content: string;
  authorName: string;
  authorRole: string | null;  // 'owner' | 'admin' | 'member' when a team member
  isBot: boolean;
  parentId: string | null;
  createdAt: string;          // ISO-8601
  replies: FeedbackComment[]; // one level only
}

interface FeedbackCommentListResult {
  comments: FeedbackComment[];
  nextCursor?: string;
}
```

### `FeedbackIdentity`

```ts
interface FeedbackIdentity {
  name: string | null;
  email: string | null;
}
```

## Device metadata

Each submission automatically includes:

| Field | Source |
| --- | --- |
| `app.bundleId` / `app.packageName` | Native module |
| `app.version` / `app.versionName` | Native module, or `configure({ appVersion })` |
| `app.build` / `app.versionCode` | Native module, or `configure({ appBuild })` |
| `os.name` | `"iOS"` or `"Android"` |
| `os.version` | `Platform.Version` |
| `screen.width` / `screen.height` | `Dimensions.get('screen')` |
| `screen.scale` | pixel ratio |
| `locale.language` | Native locale API |
| `locale.region` | Native locale API |
| `locale.timezone` | `Intl.DateTimeFormat` |
| `sdk` | `"react-native"` |
| `sdkVersion` | SDK package version, e.g. `"0.6.0"` |
| `timestamp` | ISO-8601 UTC |

Every request (reads and writes) also carries an `X-FeedbackJar-SDK:
react-native/<version>` header identifying the client.

## Notes

- Feedback can be submitted anonymously, or with a name/email — the SDK never requires either.
- The anon id (for vote/comment attribution) and remembered name/email persist on-device. It is not a device identifier and resets on reinstall / clear-data.
- Storage resolves in this order: the SDK's own native module (`UserDefaults`/`SharedPreferences`, autolinked in bare / dev-client builds) → `@react-native-async-storage/async-storage` if installed → an in-memory fallback that logs a one-time warning and does not survive a reload.
- **Expo Go:** the native module can't load there. Run `npx expo install @react-native-async-storage/async-storage` (bundled in Expo Go) or the anon id regenerates on every reload, and pass `configure({ appVersion, appBuild })` or the dashboard shows the app version as `unknown`. A dev/bare build needs neither.
- `@react-native-async-storage/async-storage` is an optional peer dependency — the SDK never requires it.
- Private boards and non-public posts are never returned by `listFeedback`.
- All methods return a `FeedbackJarResult`; nothing throws on network/HTTP errors.
- Works out of the box with React Native ≥ 0.70 (native modules autolink).
