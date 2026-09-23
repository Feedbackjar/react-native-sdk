# FeedbackJar SDK — prebuilt UI spec (Wave 2)

A drop-in feedback board that ships **inside the existing SDK package** with
**zero new external dependencies**. Built on the Wave 1 data API
(`FeedbackJar.listFeedback / vote / unvote / listComments / addComment / submit /
getConfig / setIdentity`).

Goal: a developer adds `<one component>` and gets a working votable feedback
board — the WishKit "no UI work" experience — without pulling any dependency.

## Design language (keep it cheap)

- **System font.** Two sizes only: body (~15) and small (~13). One bold weight
  for titles/counts; regular for everything else. No third size, no light weight.
- **Greys:** exactly three — primary text, secondary text, hairline divider.
  Plus the surface background.
- **One accent colour**, caller-overridable (`accentColor`), default
  `#e5484d` (FeedbackJar red). Used only for: the active vote state, the
  primary button, links.
- No shadows. No cards. Rows separated by a hairline divider. Generous vertical
  padding instead of borders.
- Respect the OS light/dark setting.
- Corner radius: one value (8) for buttons/inputs. Nothing else rounded.

## Screens

### 1. Board (list) — the main entry point

- Header row: title "Feedback" (bold) on the left, a "New" text button
  (accent) on the right.
- Scrollable list. **No virtualised list dependency** — a plain scroll
  container is fine (a board rarely exceeds a few dozen visible items; use the
  platform's native list only if it's first-party, e.g. RN `FlatList`).
- Pull-to-refresh. Infinite scroll via `nextCursor` (load more when near bottom).
- Row:
  - Title — bold, one line, ellipsised.
  - Content — secondary colour, max 2 lines, ellipsised.
  - Footer — small, secondary: `<Status> · <n> comments`.
  - Trailing: **vote pill** — up-chevron glyph + count, stacked or inline.
    Filled/accent when `hasVoted`, outline otherwise. Tapping it votes/unvotes
    **optimistically** (update count + state immediately, revert on error).
  - Tap the row (not the pill) → Detail.
- States: loading → centered spinner; empty → "No feedback yet." (secondary);
  error → message + "Retry" button.

### 2. Detail

- Back / close affordance per platform norm (modal = close, push = back).
- Title (bold), full content, then a small secondary line: `<authorName> ·
  <relative date>` (author optional).
- Vote pill (same component as the row), showing live count.
- Divider, then **Comments**:
  - `listComments(postId)` — render two-level threads. Root comment: author
    (bold, small) + relative date, then body. Replies indented one step under
    their root, same layout.
  - `authorRole` non-null → show a tiny accent tag after the name
    (e.g. "TEAM").
  - Load-more for `nextCursor`.
  - Empty → "No comments yet."
- Composer pinned to the bottom: single-line-growing text input + a send
  button (accent, disabled while empty/sending). On send → `addComment`,
  optimistic append, clear input. Replying: tapping "Reply" on a root comment
  sets a reply target shown above the input with an "×" to cancel; send passes
  `parentId`.
- Hidden entirely when `getConfig().allowComments` is false (just show the
  thread read-only if there are existing comments; hide the composer).

### 3. New feedback

- Reached from the board's "New" button. Modal/push per platform.
- Multiline text input, placeholder "Share your feedback…".
- If `getConfig().collectName` → a "Name" field. If `collectEmail` → an "Email"
  field. Prefill from `getIdentity()`. On submit, persist via `setIdentity`.
- Primary "Send" button (accent), disabled while empty/sending.
- `submit(text, { name, email })`. Success → toast/inline "Thanks for your
  feedback!" then pop back to the board and refresh. Error → inline message
  (surface `result.error.message` verbatim — it carries rate-limit text etc).

## Behaviour rules

- The UI never throws. Every data call is a `Result`; failure → an inline
  error state with the server message verbatim, plus a retry where sensible.
- Read `getConfig()` once on mount; cache for the session. Drives:
  `allowVotes` (hide vote pills if false), `allowComments` (hide composer),
  `collectName` / `collectEmail` (new-feedback fields).
- Vote & comment actions are optimistic with rollback.
- No analytics, no network beyond the SDK. No permissions.
- Accessibility: real button roles, labels on the vote pill
  ("Upvote, 12 votes"), respects dynamic type / font scale.

## Per-platform public API

Configuration stays `FeedbackJar.configure({ widgetId })` (already required).
The UI entry points take only presentation options.

### React Native — `@feedbackjar/react-native-sdk`
```tsx
import { FeedbackJarBoard } from '@feedbackjar/react-native-sdk';

<FeedbackJarBoard
  accentColor="#e5484d"   // optional
  boardId="..."            // optional filter
  onClose={() => {}}       // optional; shows a close affordance when set
/>
```
- Pure RN primitives: `View`, `Text`, `Pressable`, `TextInput`, `FlatList`,
  `ActivityIndicator`, `RefreshControl`, `Modal`, `useColorScheme`. No
  `react-native-svg`, no icon font — draw the chevron with two `View`s / a
  Unicode glyph `▲`.
- Also export `openFeedbackJar()` returning an element for modal use, or keep
  it simple: just the component, the host app decides navigation.
- New files under `src/ui/`. Re-export from `src/index.ts`.

### Flutter — `feedbackjar`
```dart
import 'package:feedbackjar/feedbackjar.dart';

FeedbackJarBoard(accentColor: Color(0xFFE5484D), boardId: '...');
// helper:
showFeedbackJar(context);
```
- Material widgets only (already available via `flutter`). No new pub deps.
- New files under `lib/src/ui/`. Export from `lib/feedbackjar.dart`.

### Swift — `FeedbackJar`
```swift
import FeedbackJar
import SwiftUI

FeedbackJarBoard(accentColor: .init(red: 0.9, green: 0.28, blue: 0.30))
// UIKit:
let vc = FeedbackJarViewController()
```
- SwiftUI (system framework — not an external dependency). Provide a
  `UIHostingController` subclass `FeedbackJarViewController` for UIKit callers.
- Single `FeedbackJar` product, no new targets. New files under
  `Sources/FeedbackJar/UI/`. Gate with `#if canImport(SwiftUI)`.

### Kotlin — `com.feedbackjar:feedbackjar`
Two UIs, one module, **no forced dependency**:

1. **Views (baseline, zero-dep)** — framework classes only (`LinearLayout`,
   `ScrollView`, `TextView`, `EditText`, `Button`, `View`; no `RecyclerView`,
   no `ConstraintLayout`, no `material`).
   ```kotlin
   val board = FeedbackJarView(context)          // a FrameLayout subclass
   // or
   startActivity(Intent(context, FeedbackJarActivity::class.java))
   ```
2. **Compose (opt-in)** — `@Composable fun FeedbackJarBoard(accentColor: Color)`.
   Compose deps declared `compileOnly` so the `.aar` carries no transitive
   Compose dependency:
   ```kotlin
   dependencies {
       compileOnly("androidx.compose.runtime:runtime:<v>")
       compileOnly("androidx.compose.foundation:foundation:<v>")
       compileOnly("androidx.compose.material3:material3:<v>")
   }
   android { buildFeatures { compose = true } }
   ```
   If `compileOnly` Compose proves fragile (compiler-plugin alignment), fall
   back to: ship only the Views UI + a documented copy-paste `@Composable`
   recipe in the README built on the public data API.
- New files under `feedbackjar/src/main/kotlin/com/feedbackjar/sdk/ui/`.

## Deliverables per platform

- The board + detail + new-feedback UI per this spec.
- README: a "Prebuilt UI" section with the one-liner to drop it in, the
  `accentColor` option, and a screenshot-free description.
- Version: another minor bump (rn 0.3.0, flutter 1.4.0, kotlin 0.3.0).
- Build/analyze/lint clean.
