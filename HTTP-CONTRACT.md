# FeedbackJar widget-api — vote & comment HTTP contract

Base URL: `https://api.feedbackjar.com`
Implemented in `apps/widget-api/src/index.ts` + `packages/api/src/lib/widget-interactions.ts`.

All SDK users are anonymous. Each install generates a random UUID once, persists
it (native storage / UserDefaults / SharedPreferences / shared_preferences), and
sends it on every mutating call:

```
X-FeedbackJar-Anon-Id: <uuid>
X-FeedbackJar-App-Id:   <bundle id / package name>   (already sent by existing calls)
```

The server HMACs the anon id before storage (`ANONYMOUS_VOTE_HASH_SECRET`). If
the header is absent it falls back to an IP+UA hash, so old SDK versions keep
working. Never send a device identifier (IDFV / ANDROID_ID / advertising id).

## Endpoints

### `POST /widget/:widgetId/posts/:postId/vote`
Add the anon guest's upvote. Idempotent. Header: anon id.
- `200` → `{ "upvotes": number, "hasVoted": true }`
- `403` `{ "error": "Guest voting is disabled for this project." }` — org toggle off
- `403` `{ "error": "Guest voting is currently unavailable." }` — no anon id and no resolvable IP, or `ANONYMOUS_VOTE_HASH_SECRET` unset
- `404` `{ "error": "Post not found" }`

### `POST /widget/:widgetId/posts/:postId/unvote`
Remove the upvote. Idempotent. Header: anon id.
- `200` → `{ "upvotes": number, "hasVoted": false }`

### `GET /widget/:widgetId/posts/:postId/vote`
Read state. Header: anon id (optional — without it `hasVoted` is always false).
- `200` → `{ "upvotes": number, "hasVoted": boolean }`

### `GET /widget/:widgetId/posts/:postId/comments?limit=&cursor=`
Public comment thread, two levels. No identity needed.
- `limit` clamped 1–50 (default 20). `cursor` = previous response's `nextCursor`.
- `200` →
  ```json
  {
    "comments": [
      {
        "id": "string",
        "content": "string",
        "authorName": "string",
        "authorRole": "owner" | "admin" | "member" | null,
        "isBot": false,
        "parentId": null,
        "createdAt": "ISO-8601",
        "replies": [ { "...": "same shape", "parentId": "<root id>", "replies": [] } ]
      }
    ],
    "nextCursor": "string | null"
  }
  ```

### `POST /widget/:widgetId/posts/:postId/comments`
Add a public comment / reply as the anon guest. Header: anon id.
Body (JSON): `{ "content": string, "parentId"?: string, "name"?: string, "email"?: string }`
- `content` required, ≤ 20000 chars. `parentId` must be a root comment (no reply-to-reply).
- `name`/`email` optional — stored on an `AnonVoterProfile` keyed to the anon id
  and reused for later comments/votes; `email` is used only for reply/status
  notification mail and is never auto-linked to a real account.
- `201` → `{ "id": "string" }`
- `403` `{ "error": "Guest comments are disabled for this project." }`
- `400` `{ "error": "Cannot reply to a reply." | "Invalid parent comment." | "..." }`

### `POST /widget/:widgetId/identify`
Sync the guest's name/email to the server for this anon id (e.g. from
`setIdentity`). Header: anon id. Body: `{ "name"?: string, "email"?: string }`.
- `200` → `{}`

## Changed existing endpoints

### `GET /widget/:widgetId/posts`
Each post object gains `"hasVoted": boolean` (true only when the anon-id header
is sent and that guest voted on it).

### `GET /widget/:widgetId/config`
Gains `"allowVotes": boolean`, `"allowComments": boolean` (the org's
`allowAnonymousVotes` / `allowAnonymousComments`). Use these to show/hide vote
and comment UI.

## Rate limits (per IP)

- vote / unvote: 60 / min
- comment create: 10 / min
- everything else: shares the 120 / min widget read limiter

All errors are `{ "error": "<message>" }`. SDKs should surface `error` verbatim
in their `Result.error` and never throw.
