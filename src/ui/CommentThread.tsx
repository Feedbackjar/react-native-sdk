import { StyleSheet, Text, View } from 'react-native';
import type { FeedbackComment } from '../models';
import { FONT, relativeTime, useTheme } from './theme';

function Row({ comment, indented }: { comment: FeedbackComment; indented?: boolean }) {
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
    </View>
  );
}

export function CommentThread({ comments }: { comments: FeedbackComment[] }) {
  return (
    <View style={styles.wrap}>
      {comments.map((c) => (
        <View key={c.id}>
          <Row comment={c} />
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
  row: { gap: 4 },
  meta: { fontSize: FONT.small },
  author: { fontWeight: '700' },
  tag: { fontWeight: '700', fontSize: FONT.small - 1 },
  body: { fontSize: FONT.body, lineHeight: 21 },
});
