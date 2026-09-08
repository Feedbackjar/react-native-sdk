export interface FeedbackResponse {
  postId: string;
  title: string;
  type: string;
  boardId: string;
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
}

/** Submitter identity (name/email) remembered across `FeedbackJar.submit` calls. */
export interface FeedbackIdentity {
  name: string | null;
  email: string | null;
}
