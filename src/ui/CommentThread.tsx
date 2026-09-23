import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedbackComment } from '../models';
import { RichText } from './rich-text';
import { FONT, relativeTime, useTheme } from './theme';

function Row({
  comment,
  indented,
  onReply,
  onPostPress,
}: {
  comment: FeedbackComment;
  indented?: boolean;
  onReply?: () => void;
  onPostPress?: (postId: string) => void;
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
      <RichText content={comment.content} onPostPress={onPostPress} />
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
  onPostPress,
}: {
  comments: FeedbackComment[];
  /** When set, root comments show a "Reply" action. */
  onReply?: (comment: FeedbackComment) => void;
  /** Open a post referenced by a `#[…]` mention in a comment. */
  onPostPress?: (postId: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {comments.map((c) => (
        <View key={c.id} style={styles.group}>
          <Row
            comment={c}
            onReply={onReply ? () => onReply(c) : undefined}
            onPostPress={onPostPress}
          />
          {c.replies.map((r) => (
            <Row key={r.id} comment={r} indented onPostPress={onPostPress} />
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
  reply: { fontSize: FONT.small, fontWeight: '700', marginTop: 2 },
});
