import type {
  FeedbackComment,
  FeedbackCommentListResult,
  FeedbackJarResult,
  FeedbackListResult,
  FeedbackPost,
  FeedbackResponse,
  VoteState,
  WidgetConfig,
} from './models';
import { SDK_IDENTIFIER } from './version';

const BASE_URL = 'https://api.feedbackjar.com';

function buildHeaders(appId?: string, anonId?: string): Record<string, string> {
  // Identifies the client on every request, e.g. "react-native/0.5.0".
  const headers: Record<string, string> = { 'X-FeedbackJar-SDK': SDK_IDENTIFIER };
  if (appId) {
    headers['X-FeedbackJar-App-Id'] = appId;
  }
  if (anonId) {
    headers['X-FeedbackJar-Anon-Id'] = anonId;
  }
  return headers;
}

async function errorFrom(
  response: { json(): Promise<unknown>; status: number },
  fallback: string,
): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) return new Error(body.error);
  } catch {
    // no JSON body
  }
  return new Error(`${fallback}: HTTP ${response.status}`);
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
  status?: string;
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
  hasVoted?: boolean;
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
  allowVotes?: boolean;
  allowComments?: boolean;
}

interface CommentBody {
  id: string;
  content: string;
  authorName: string;
  authorRole: string | null;
  isBot: boolean;
  parentId: string | null;
  createdAt: string;
  replies?: CommentBody[];
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
        status: data.status,
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
  anonId?: string,
): Promise<FeedbackJarResult<FeedbackListResult>> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (boardId) params.append('boardId', boardId);
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts?${params.toString()}`,
      { headers: buildHeaders(appId, anonId) },
    );

    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, 'List failed') };
    }

    const data: ListResponseBody = await response.json();
    const posts: FeedbackPost[] = data.posts.map(mapPost);

    return { ok: true, value: { posts, nextCursor: data.nextCursor } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function mapPost(p: PostBody): FeedbackPost {
  return {
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
    hasVoted: p.hasVoted ?? false,
    authorName: p.authorName,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function getPost(
  widgetId: string,
  postId: string,
  appId?: string,
  anonId?: string,
): Promise<FeedbackJarResult<FeedbackPost>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${encodeURIComponent(postId)}`,
      { headers: buildHeaders(appId, anonId) },
    );

    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, 'Post fetch failed') };
    }

    const data: PostBody = await response.json();
    return { ok: true, value: mapPost(data) };
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
      return { ok: false, error: await errorFrom(response, 'Config fetch failed') };
    }

    const data: ConfigResponseBody = await response.json();
    return {
      ok: true,
      value: {
        collectName: data.collectName ?? false,
        collectEmail: data.collectEmail ?? false,
        allowVotes: data.allowVotes ?? false,
        allowComments: data.allowComments ?? false,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function mapComment(c: CommentBody): FeedbackComment {
  return {
    id: c.id,
    content: c.content,
    authorName: c.authorName,
    authorRole: c.authorRole ?? null,
    isBot: c.isBot ?? false,
    parentId: c.parentId ?? null,
    createdAt: c.createdAt,
    replies: (c.replies ?? []).map(mapComment),
  };
}

async function voteRequest(
  widgetId: string,
  postId: string,
  action: 'vote' | 'unvote',
  appId: string | undefined,
  anonId: string,
): Promise<FeedbackJarResult<VoteState>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/${action}`,
      { method: 'POST', headers: buildHeaders(appId, anonId) },
    );
    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, `${action} failed`) };
    }
    const data = (await response.json()) as VoteState;
    return { ok: true, value: { upvotes: data.upvotes, hasVoted: data.hasVoted } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export function voteOnPost(
  widgetId: string,
  postId: string,
  appId: string | undefined,
  anonId: string,
): Promise<FeedbackJarResult<VoteState>> {
  return voteRequest(widgetId, postId, 'vote', appId, anonId);
}

export function unvotePost(
  widgetId: string,
  postId: string,
  appId: string | undefined,
  anonId: string,
): Promise<FeedbackJarResult<VoteState>> {
  return voteRequest(widgetId, postId, 'unvote', appId, anonId);
}

export async function getVoteState(
  widgetId: string,
  postId: string,
  appId: string | undefined,
  anonId: string,
): Promise<FeedbackJarResult<VoteState>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/vote`,
      { headers: buildHeaders(appId, anonId) },
    );
    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, 'Vote state fetch failed') };
    }
    const data = (await response.json()) as VoteState;
    return { ok: true, value: { upvotes: data.upvotes, hasVoted: data.hasVoted } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function listComments(
  widgetId: string,
  postId: string,
  limit = 20,
  cursor: string | undefined,
  appId: string | undefined,
): Promise<FeedbackJarResult<FeedbackCommentListResult>> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/comments?${params.toString()}`,
      { headers: buildHeaders(appId) },
    );
    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, 'Comment list failed') };
    }
    const data = (await response.json()) as {
      comments: CommentBody[];
      nextCursor?: string | null;
    };
    return {
      ok: true,
      value: {
        comments: data.comments.map(mapComment),
        nextCursor: data.nextCursor ?? undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function createComment(
  widgetId: string,
  postId: string,
  body: { content: string; parentId?: string; name?: string | null; email?: string | null },
  appId: string | undefined,
  anonId: string,
): Promise<FeedbackJarResult<{ id: string }>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildHeaders(appId, anonId) },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, 'Comment failed') };
    }
    const data = (await response.json()) as { id: string };
    return { ok: true, value: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function identify(
  widgetId: string,
  body: { name?: string | null; email?: string | null },
  appId: string | undefined,
  anonId: string,
): Promise<FeedbackJarResult<void>> {
  try {
    const response = await fetch(`${BASE_URL}/widget/${widgetId}/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildHeaders(appId, anonId) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { ok: false, error: await errorFrom(response, 'Identify failed') };
    }
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
