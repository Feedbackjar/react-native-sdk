import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FeedbackJar } from '../FeedbackJar';
import type { FeedbackPost, WidgetConfig } from '../models';
import { FeedbackDetail } from './FeedbackDetail';
import { NewFeedback } from './NewFeedback';
import { AccentProvider, DEFAULT_ACCENT, FONT, humanStatus, useTheme } from './theme';
import { VotePill } from './VotePill';

export interface FeedbackJarBoardProps {
  /** Accent colour for the vote state, primary button and links. */
  accentColor?: string;
  /** Restrict the feed to a single board. */
  boardId?: string;
  /** When provided, a "Close" affordance is shown in the header. */
  onClose?: () => void;
}

const PAGE = 20;

/** How long an optimistic post stays pinned before we give up waiting for it. */
const PENDING_TTL = 90_000;
/** Extra background refreshes after a submit, to catch the server-side reveal. */
const REVEAL_RETRIES_MS = [2500, 6000, 12000];

/** An optimistically-added post, pinned to the top until the server reveals it. */
type PendingPost = { post: FeedbackPost; until: number };

type Screen =
  | { name: 'board' }
  | { name: 'detail'; post: FeedbackPost }
  | { name: 'new' };

/**
 * A complete, drop-in feedback board: list + upvote + detail + comments +
 * submission. Built only on React Native primitives — no extra dependency.
 *
 * ```tsx
 * <FeedbackJarBoard accentColor="#e5484d" />
 * ```
 */
export function FeedbackJarBoard(props: FeedbackJarBoardProps) {
  return (
    <AccentProvider value={props.accentColor ?? DEFAULT_ACCENT}>
      <BoardInner {...props} />
    </AccentProvider>
  );
}

function BoardInner({ boardId, onClose }: FeedbackJarBoardProps) {
  const theme = useTheme();
  const [screen, setScreen] = useState<Screen>({ name: 'board' });
  const [config, setConfig] = useState<WidgetConfig>({
    collectName: false,
    collectEmail: false,
    allowVotes: false,
    allowComments: false,
  });

  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [pending, setPending] = useState<PendingPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const retryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      retryTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const load = useCallback(
    async (reset: boolean) => {
      const res = await FeedbackJar.listFeedback({
        limit: PAGE,
        boardId,
        cursor: reset ? undefined : cursor,
      });
      if (res.ok) {
        setError('');
        const batch = res.value.posts;
        if (reset) {
          // Drop optimistic rows the server has now revealed (or that expired).
          const now = Date.now();
          setPending((prev) =>
            prev.filter((p) => p.until > now && !batch.some((b) => b.id === p.post.id)),
          );
        }
        setPosts((prev) => (reset ? batch : [...prev, ...batch]));
        setCursor(res.value.nextCursor);
      } else {
        setError(res.error.message);
      }
    },
    [boardId, cursor],
  );

  useEffect(() => {
    FeedbackJar.getConfig().then((res) => {
      if (res.ok) setConfig(res.value);
    });
    load(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  async function onEndReached() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }

  function patchPost(id: string, upvotes: number, hasVoted: boolean) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, upvotes, hasVoted } : p)));
  }

  if (screen.name === 'new') {
    return (
      <NewFeedback
        config={config}
        onCancel={() => setScreen({ name: 'board' })}
        onDone={(created) => {
          if (created) {
            setPending((prev) => [
              { post: created, until: Date.now() + PENDING_TTL },
              ...prev.filter((p) => p.post.id !== created.id),
            ]);
            // The post may not be listable yet — poll a few times so it swaps
            // to the real row without the user pulling to refresh.
            retryTimers.current.forEach(clearTimeout);
            retryTimers.current = REVEAL_RETRIES_MS.map((ms) =>
              setTimeout(() => {
                load(true);
              }, ms),
            );
          }
          setScreen({ name: 'board' });
          refresh();
        }}
      />
    );
  }

  if (screen.name === 'detail') {
    return (
      <FeedbackDetail
        post={posts.find((p) => p.id === screen.post.id) ?? screen.post}
        config={config}
        onBack={() => setScreen({ name: 'board' })}
      />
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const feed = [
    ...pending.map((p) => p.post).filter((p) => !posts.some((q) => q.id === p.id)),
    ...posts,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={feed}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.h1, { color: theme.text }]}>Feedback</Text>
            <View style={styles.headerRight}>
              <Pressable accessibilityRole="button" onPress={() => setScreen({ name: 'new' })}>
                <Text style={[styles.action, { color: theme.accent }]}>New</Text>
              </Pressable>
              {onClose ? (
                <Pressable accessibilityRole="button" onPress={onClose}>
                  <Text style={[styles.action, { color: theme.textDim }]}>Close</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textDim }]}>
            {error || 'No feedback yet.'}
          </Text>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.accent} style={{ margin: 16 }} /> : null
        }
        renderItem={({ item }) => {
          const isPending =
            pending.some((p) => p.post.id === item.id) && !posts.some((q) => q.id === item.id);
          return (
            <Pressable
              disabled={isPending}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.divider },
                isPending && { opacity: 0.5 },
                pressed && !isPending && { opacity: 0.6 },
              ]}
              onPress={() => setScreen({ name: 'detail', post: item })}>
              <View style={styles.rowMain}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowBody, { color: theme.textDim }]} numberOfLines={2}>
                  {item.content}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.textDim }]}>
                  {isPending
                    ? item.status === 'PENDING'
                      ? 'Awaiting approval'
                      : 'Posting…'
                    : `${humanStatus(item.status)} · ${item.commentCount} comments`}
                </Text>
              </View>
              {config.allowVotes && !isPending ? (
                <VotePill
                  postId={item.id}
                  upvotes={item.upvotes}
                  hasVoted={item.hasVoted}
                  onChange={(u, v) => patchPost(item.id, u, v)}
                />
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  h1: { fontSize: FONT.body, fontWeight: '700' },
  headerRight: { flexDirection: 'row', gap: 16 },
  action: { fontSize: FONT.body, fontWeight: '700' },
  empty: { fontSize: FONT.small, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: 4 },
  rowTitle: { fontSize: FONT.body, fontWeight: '700' },
  rowBody: { fontSize: FONT.body, lineHeight: 20 },
  rowMeta: { fontSize: FONT.small },
});
