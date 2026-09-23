export interface FeedbackResponse {
  postId: string;
  title: string;
  type: string;
  boardId: string;
  /** Initial post status, e.g. `OPEN` or `PENDING` (approval required). */
  status?: string;
}

export interface FeedbackPost {
  id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  slug: string;
  boardId: string;
  voteCount: number;
  commentCount: number;
  upvotes: number;
  /** Whether this device's anonymous id has upvoted this post. */
  hasVoted: boolean;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackListResult {
  posts: FeedbackPost[];
  nextCursor?: string;
}

export type FeedbackJarResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

export interface WidgetConfig {
  /** Whether the org asks submitters for their name ("Ask for Name"). */
  collectName: boolean;
  /** Whether the org asks submitters for their email ("Ask for Email"). */
  collectEmail: boolean;
  /** Whether guest upvoting is enabled for this project. */
  allowVotes: boolean;
  /** Whether guest commenting is enabled for this project. */
  allowComments: boolean;
}

/**
 * Org-signed `{userId, email, timestamp, signature}` payload — mirrors the JS
 * widget's `identify()` / portal auto-login payload. Sent as
 * `X-FeedbackJar-Identity` (base64 JSON) on vote/comment/list calls, and as an
 * `identity` body field on submit.
 */
export interface SignedIdentity {
  userId: string;
  email: string;
  timestamp: number;
  signature: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
}

/**
 * Submitter identity remembered across `FeedbackJar` calls.
 *
 * `userId`/`signature`/`timestamp` are set only via a **verified**
 * `setIdentity({userId, email, signature, timestamp})` call — when present
 * (and not expired), vote, comment, and submit all attach to this real,
 * server-verified user instead of the device's anonymous id.
 */
export interface FeedbackIdentity {
  name: string | null;
  email: string | null;
  userId: string | null;
  signature: string | null;
  /** Milliseconds since epoch — the exact value your backend signed. */
  timestamp: number | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
}

/** Upvote state for a single post. */
export interface VoteState {
  /** Current upvote count. */
  upvotes: number;
  /** Whether this device's anonymous id has upvoted. */
  hasVoted: boolean;
}

export interface FeedbackComment {
  id: string;
  content: string;
  authorName: string;
  /** Org role of the author when they're a team member (e.g. `owner`), else null. */
  authorRole: string | null;
  isBot: boolean;
  parentId: string | null;
  createdAt: string;
  replies: FeedbackComment[];
}

export interface FeedbackCommentListResult {
  comments: FeedbackComment[];
  nextCursor?: string;
}
