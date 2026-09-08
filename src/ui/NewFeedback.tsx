import { useEffect, useState } from 'react';
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
import type { WidgetConfig } from '../models';
import { FONT, RADIUS, useTheme } from './theme';

interface Props {
  config: WidgetConfig;
  onDone: () => void;
  onCancel: () => void;
}

export function NewFeedback({ config, onDone, onCancel }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    FeedbackJar.getIdentity().then((id) => {
      if (id.name) setName(id.name);
      if (id.email) setEmail(id.email);
    });
  }, []);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    const res = await FeedbackJar.submit(text.trim(), {
      name: config.collectName ? name.trim() || null : null,
      email: config.collectEmail ? email.trim() || null : null,
    });
    setSending(false);
    if (res.ok) onDone();
    else setError(res.error.message);
  }

  const field = [styles.field, { backgroundColor: theme.fieldBg, color: theme.text }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onCancel}>
          <Text style={[styles.link, { color: theme.textDim }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>New feedback</Text>
        <View style={{ width: 52 }} />
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Share your feedback…"
        placeholderTextColor={theme.textDim}
        multiline
        style={[...field, styles.multiline]}
      />
      {config.collectName ? (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={theme.textDim}
          style={field}
        />
      ) : null}
      {config.collectEmail ? (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          style={field}
        />
      ) : null}

      {error ? <Text style={[styles.error, { color: theme.accent }]}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={send}
        disabled={!text.trim() || sending}
        style={[
          styles.button,
          { backgroundColor: theme.accent, opacity: !text.trim() || sending ? 0.5 : 1 },
        ]}>
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: FONT.body, fontWeight: '700' },
  link: { fontSize: FONT.body },
  field: {
    fontSize: FONT.body,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  error: { fontSize: FONT.small },
  button: {
    borderRadius: RADIUS,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: FONT.body, fontWeight: '700' },
});
