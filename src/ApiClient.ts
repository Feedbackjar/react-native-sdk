import type {
  FeedbackComment,
  FeedbackCommentListResult,
  FeedbackJarResult,
  FeedbackListResult,
  FeedbackPost,
  FeedbackResponse,
  SignedIdentity,
  VoteState,
  WidgetConfig,
} from './models';
import { SDK_IDENTIFIER } from './version';

const BASE_URL = 'https://api.feedbackjar.com';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 bytes for `str`, without relying on `TextEncoder` (not guaranteed
 * across every Hermes/JSC version this SDK supports). */
function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i) as number;
    if (code > 0xffff) i++; // consumed a surrogate pair
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/** Dependency-free base64 encode — no `Buffer`/`btoa` assumed available. */
function base64Encode(str: string): string {
  const bytes = utf8Bytes(str);
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] as number;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 0x03) << 4) | (b2 === undefined ? 0 : b2 >> 4)];
    result += b2 === undefined ? '=' : BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 === undefined ? 0 : b3 >> 6)];
    result += b3 === undefined ? '=' : BASE64_CHARS[b3 & 0x3f];
  }
  return result;
}

/**
 * [identity] is the org-signed identity payload — sent as `X-FeedbackJar-Identity`
 * so the server attributes the vote/comment/`hasVoted` lookup to this real user
 * instead of the anonymous id. Omitted (falls back to anonymous) when absent.
 */
function buildHeaders(
  appId?: string,
  anonId?: string,
  identity?: SignedIdentity | null,
): Record<string, string> {
  // Identifies the client on every request, e.g. "react-native/0.5.0".
  const headers: Record<string, string> = { 'X-FeedbackJar-SDK': SDK_IDENTIFIER };
  if (appId) {
    headers['X-FeedbackJar-App-Id'] = appId;
  }
  if (anonId) {
    headers['X-FeedbackJar-Anon-Id'] = anonId;
  }
  if (identity) {
    headers['X-FeedbackJar-Identity'] = base64Encode(JSON.stringify(identity));
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
  identity?: SignedIdentity | null;
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
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<FeedbackListResult>> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (boardId) params.append('boardId', boardId);
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts?${params.toString()}`,
      { headers: buildHeaders(appId, anonId, identity) },
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
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<FeedbackPost>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${encodeURIComponent(postId)}`,
      { headers: buildHeaders(appId, anonId, identity) },
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
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<VoteState>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/${action}`,
      { method: 'POST', headers: buildHeaders(appId, anonId, identity) },
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
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<VoteState>> {
  return voteRequest(widgetId, postId, 'vote', appId, anonId, identity);
}

export function unvotePost(
  widgetId: string,
  postId: string,
  appId: string | undefined,
  anonId: string,
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<VoteState>> {
  return voteRequest(widgetId, postId, 'unvote', appId, anonId, identity);
}

export async function getVoteState(
  widgetId: string,
  postId: string,
  appId: string | undefined,
  anonId: string,
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<VoteState>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/vote`,
      { headers: buildHeaders(appId, anonId, identity) },
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
  identity?: SignedIdentity | null,
): Promise<FeedbackJarResult<{ id: string }>> {
  try {
    const response = await fetch(
      `${BASE_URL}/widget/${widgetId}/posts/${postId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildHeaders(appId, anonId, identity) },
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
