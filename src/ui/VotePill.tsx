import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackJar } from '../FeedbackJar';
import { FONT, RADIUS, useTheme } from './theme';

interface Props {
  postId: string;
  upvotes: number;
  hasVoted: boolean;
  /** Called with the authoritative count/state after a successful toggle. */
  onChange?: (upvotes: number, hasVoted: boolean) => void;
}

/**
 * Up-chevron + count. Filled/accent when voted. Toggles optimistically and
 * rolls back on failure. The chevron is drawn with a rotated square — no icon
 * font or SVG dependency.
 */
export function VotePill({ postId, upvotes, hasVoted, onChange }: Props) {
  const theme = useTheme();
  const [local, setLocal] = useState({ upvotes, hasVoted });
  const [busy, setBusy] = useState(false);

  // Keep in sync when the parent list refreshes.
  if (!busy && (local.upvotes !== upvotes || local.hasVoted !== hasVoted)) {
    setLocal({ upvotes, hasVoted });
  }

  async function toggle() {
    if (busy) return;
    const prev = local;
    const next = prev.hasVoted
      ? { upvotes: Math.max(0, prev.upvotes - 1), hasVoted: false }
      : { upvotes: prev.upvotes + 1, hasVoted: true };
    setLocal(next);
    setBusy(true);
    const res = prev.hasVoted
      ? await FeedbackJar.unvote(postId)
      : await FeedbackJar.vote(postId);
    setBusy(false);
    if (res.ok) {
      setLocal(res.value);
      onChange?.(res.value.upvotes, res.value.hasVoted);
    } else {
      setLocal(prev); // rollback
    }
  }

  const active = local.hasVoted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${active ? 'Remove upvote' : 'Upvote'}, ${local.upvotes} votes`}
      onPress={toggle}
      style={[
        styles.pill,
        {
          borderColor: active ? theme.accent : theme.divider,
          backgroundColor: active ? theme.accent : 'transparent',
        },
      ]}>
      <View
        style={[
          styles.chevron,
          { borderTopColor: active ? '#fff' : theme.textDim, borderRightColor: active ? '#fff' : theme.textDim },
        ]}
      />
      <Text style={[styles.count, { color: active ? '#fff' : theme.text }]}>
        {local.upvotes}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    minWidth: 44,
  },
  chevron: {
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    marginTop: 2,
  },
  count: { fontSize: FONT.small, fontWeight: '700' },
});
