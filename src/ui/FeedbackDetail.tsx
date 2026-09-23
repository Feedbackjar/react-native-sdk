import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FeedbackJar } from '../FeedbackJar';
import type { FeedbackComment, FeedbackPost, WidgetConfig } from '../models';
import { CommentThread } from './CommentThread';
import { RichText } from './rich-text';
import { FONT, RADIUS, humanStatus, relativeTime, useTheme } from './theme';
import { VotePill } from './VotePill';

interface Props {
  post: FeedbackPost;
  config: WidgetConfig;
  onBack: () => void;
  /** Open a post referenced by a `#[…]` mention. */
  onPostPress?: (postId: string) => void;
  /**
   * Called at send time for each comment. Return a name/email to attach to
   * it. Omit a field to use the remembered identity.
   */
  commentIdentity?: () => { name?: string; email?: string } | undefined;
  /** Called with the authoritative vote count/state once it is known. */
  onVoteChange?: (upvotes: number, hasVoted: boolean) => void;
}

export function FeedbackDetail({
  post,
  config,
  onBack,
  onPostPress,
  commentIdentity,
  onVoteChange,
}: Props) {
  const theme = useTheme();
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<FeedbackComment | null>(null);
  // Seeded from the list row's cached values; refreshed below with the
  // authoritative count from the server.
  const [voteState, setVoteState] = useState({ upvotes: post.upvotes, hasVoted: post.hasVoted });

  const load = useCallback(async () => {
    const res = await FeedbackJar.listComments(post.id, { limit: 50 });
    if (res.ok) {
      setComments(res.value.comments);
      setError('');
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }, [post.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the vote count/state from the server once — the `post` prop may
  // carry a stale copy cached from the list.
  useEffect(() => {
    if (!config.allowVotes) return;
    let cancelled = false;
    FeedbackJar.getVoteState(post.id).then((res) => {
      if (cancelled || !res.ok) return;
      setVoteState(res.value);
      onVoteChange?.(res.value.upvotes, res.value.hasVoted);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, config.allowVotes]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const identity = commentIdentity?.();
    const res = await FeedbackJar.addComment(post.id, draft.trim(), {
      parentId: replyTo?.id,
      name: identity?.name,
      email: identity?.email,
    });
    setSending(false);
    if (res.ok) {
      setDraft('');
      setReplyTo(null);
      load();
    } else {
      setError(res.error.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text style={[styles.link, { color: theme.accent }]}>‹ Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: theme.text }]}>{post.title}</Text>
          {config.allowVotes ? (
            <VotePill
              postId={post.id}
              upvotes={voteState.upvotes}
              hasVoted={voteState.hasVoted}
              onChange={(upvotes, hasVoted) => {
                setVoteState({ upvotes, hasVoted });
                onVoteChange?.(upvotes, hasVoted);
              }}
            />
          ) : null}
        </View>
        <Text style={[styles.meta, { color: theme.textDim }]}>
          {humanStatus(post.status)}
          {post.authorName ? ` · ${post.authorName}` : ''} · {relativeTime(post.createdAt)}
        </Text>
        <View style={styles.bodyWrap}>
          <RichText content={post.content} onPostPress={onPostPress} />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        <Text style={[styles.section, { color: theme.text }]}>Comments</Text>
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 12 }} />
        ) : comments.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textDim }]}>
            {error || 'No comments yet.'}
          </Text>
        ) : (
          <CommentThread
            comments={comments}
            onReply={config.allowComments ? setReplyTo : undefined}
            onPostPress={onPostPress}
          />
        )}
        {error && comments.length > 0 ? (
          <Text style={[styles.empty, { color: theme.accent }]}>{error}</Text>
        ) : null}
      </ScrollView>

      {config.allowComments ? (
        <View style={[styles.composerWrap, { borderTopColor: theme.divider }]}>
          {replyTo ? (
            <View style={styles.replyBar}>
              <Text style={[styles.replyLabel, { color: theme.textDim }]} numberOfLines={1}>
                Replying to {replyTo.authorName}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={() => setReplyTo(null)}>
                <Text style={[styles.replyLabel, { color: theme.textDim }]}>×</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={theme.textDim}
            multiline
            style={[styles.input, { backgroundColor: theme.fieldBg, color: theme.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            onPress={send}
            disabled={!draft.trim() || sending}
            style={[
              styles.send,
              { backgroundColor: theme.accent, opacity: !draft.trim() || sending ? 0.5 : 1 },
            ]}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>↑</Text>}
          </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  link: { fontSize: FONT.body },
  content: { padding: 20, paddingTop: 4, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: FONT.body, fontWeight: '700', lineHeight: 22 },
  meta: { fontSize: FONT.small },
  bodyWrap: { marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 20 },
  section: { fontSize: FONT.body, fontWeight: '700', marginBottom: 12 },
  empty: { fontSize: FONT.small, marginTop: 8 },
  composerWrap: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  replyLabel: { fontSize: FONT.small, flexShrink: 1 },
  input: {
    flex: 1,
    fontSize: FONT.body,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxHeight: 120,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
