import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedbackComment } from '../models';
import { FONT, relativeTime, useTheme } from './theme';

function Row({
  comment,
  indented,
  onReply,
}: {
  comment: FeedbackComment;
  indented?: boolean;
  onReply?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, indented && { marginLeft: 16, borderLeftColor: theme.divider, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 12 }]}>
      <Text style={styles.meta}>
        <Text style={[styles.author, { color: theme.text }]}>{comment.authorName}</Text>
        {comment.authorRole ? (
          <Text style={[styles.tag, { color: theme.accent }]}>{'  '}TEAM</Text>
        ) : null}
        <Text style={{ color: theme.textDim }}>{'  '}{relativeTime(comment.createdAt)}</Text>
      </Text>
      <Text style={[styles.body, { color: theme.text }]}>{comment.content}</Text>
      {onReply ? (
        <Pressable accessibilityRole="button" onPress={onReply}>
          <Text style={[styles.reply, { color: theme.accent }]}>Reply</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CommentThread({
  comments,
  onReply,
}: {
  comments: FeedbackComment[];
  /** When set, root comments show a "Reply" action. */
  onReply?: (comment: FeedbackComment) => void;
}) {
  return (
    <View style={styles.wrap}>
      {comments.map((c) => (
        <View key={c.id} style={styles.group}>
          <Row comment={c} onReply={onReply ? () => onReply(c) : undefined} />
          {c.replies.map((r) => (
            <Row key={r.id} comment={r} indented />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  group: { gap: 14 },
  row: { gap: 4 },
  meta: { fontSize: FONT.small },
  author: { fontWeight: '700' },
  tag: { fontWeight: '700', fontSize: FONT.small - 1 },
  body: { fontSize: FONT.body, lineHeight: 21 },
  reply: { fontSize: FONT.small, fontWeight: '700', marginTop: 2 },
});
