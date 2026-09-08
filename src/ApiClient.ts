import type { FeedbackJarResult, FeedbackListResult, FeedbackPost, FeedbackResponse, WidgetConfig } from './models';

const BASE_URL = 'https://api.feedbackjar.com';

function buildHeaders(appId?: string): HeadersInit {
  const headers: Record<string, string> = {};
  if (appId) {
    headers['X-FeedbackJar-App-Id'] = appId;
  }
  return headers;
}

interface SubmitRequest {
  content: string;
  email?: string | null;
  userName?: string | null;
  metadata: object;
}

interface SubmitResponseBody {
  success: boolean;
  postId: string;
  title: string;
  type: string;
  boardId: string;
}

interface PostBody {
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

interface ListResponseBody {
  posts: PostBody[];
  nextCursor?: string;
}

interface ConfigResponseBody {
  collectName?: boolean;
  collectEmail?: boolean;
}

export async function submitFeedback(
  widgetId: string,
  payload: SubmitRequest,
  appId?: string,
): Promise<FeedbackJarResult<FeedbackResponse>> {
  try {
    const response = await fetch(`${BASE_URL}/widget/${widgetId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildHeaders(appId),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, error: new Error(`Submit failed: HTTP ${response.status}`) };
    }

    const data: SubmitResponseBody = await response.json();
    return {
      ok: true,
      value: {
        postId: data.postId,
        title: data.title,
        type: data.type,
        boardId: data.boardId,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function listFeedback(
  widgetId: string,
  boardId?: string,
  limit = 20,
  cursor?: string,
  appId?: string,
): Promise<FeedbackJarResult<FeedbackListResult>> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (boardId) params.append('boardId', boardId);
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts?${params.toString()}`,
      { headers: buildHeaders(appId) },
    );

    if (!response.ok) {
      return { ok: false, error: new Error(`List failed: HTTP ${response.status}`) };
    }

    const data: ListResponseBody = await response.json();
    const posts: FeedbackPost[] = data.posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      type: p.type,
      status: p.status,
      slug: p.slug,
      boardId: p.boardId,
      voteCount: p.voteCount,
      commentCount: p.commentCount,
      upvotes: p.upvotes,
      authorName: p.authorName,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return { ok: true, value: { posts, nextCursor: data.nextCursor } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function getConfig(
  widgetId: string,
  appId?: string,
): Promise<FeedbackJarResult<WidgetConfig>> {
  try {
    const response = await fetch(`${BASE_URL}/widget/${widgetId}/config`, {
      headers: buildHeaders(appId),
    });

    if (!response.ok) {
      return { ok: false, error: new Error(`Config fetch failed: HTTP ${response.status}`) };
    }

    const data: ConfigResponseBody = await response.json();
    return {
      ok: true,
      value: {
        collectName: data.collectName ?? false,
        collectEmail: data.collectEmail ?? false,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
