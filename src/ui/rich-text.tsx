import { useMemo, type ReactNode } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { FONT, RADIUS, useTheme } from './theme';

/**
 * Dependency-free renderer for the subset of Markdown feedback posts and comments
 * actually use, plus FeedbackJar mention tokens:
 *
 * - `#[Post title](postId)`            → post reference chip
 * - `@[Name](user:id | guest:id | post:id)` → user mention
 * - **bold**, *italic*, `code`, [links](url), bare URLs
 * - headings, `-`/`1.` lists, `>` quotes, ``` fenced code
 *
 * Single newlines are hard breaks (matches the web renderer's `remark-breaks`).
 */

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'postMention'; title: string; postId: string }
  | { t: 'userMention'; name: string };

type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'heading'; level: number; c: Inline[] }
  | { t: 'bullet'; items: Inline[][] }
  | { t: 'ordered'; items: Inline[][] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'code'; v: string };

const POST_MENTION = /^#\[([^\]]+)\]\(([^)]+)\)/;
const USER_MENTION = /^@\[([^\]]+)\]\((?:user|guest|post):([^)]+)\)/;
const CODE_SPAN = /^(`+)([\s\S]+?)\1/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const STRONG = /^(\*\*|__)([\s\S]+?)\1/;
const EM = /^(\*|_)(\S(?:[\s\S]*?\S)?|\S)\1/;
const AUTOLINK = /^(https?:\/\/[^\s<]+[^\s<.,:;"'!?)\]])/;
const NEXT_SPECIAL = /[`#@[*_]|https?:\/\//;

function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf });
    buf = '';
  };

  while (rest.length) {
    let m = CODE_SPAN.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'code', v: m[2].trim() });
      rest = rest.slice(m[0].length);
      continue;
    }
    m = POST_MENTION.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'postMention', title: m[1].trim(), postId: m[2].trim() });
      rest = rest.slice(m[0].length);
      continue;
    }
    m = USER_MENTION.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'userMention', name: m[1].trim() });
      rest = rest.slice(m[0].length);
      continue;
    }
    m = LINK.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'link', href: m[2], c: parseInline(m[1]) });
      rest = rest.slice(m[0].length);
      continue;
    }
    m = STRONG.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'strong', c: parseInline(m[2]) });
      rest = rest.slice(m[0].length);
      continue;
    }
    m = EM.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'em', c: parseInline(m[2]) });
      rest = rest.slice(m[0].length);
      continue;
    }
    m = AUTOLINK.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'link', href: m[1], c: [{ t: 'text', v: m[1] }] });
      rest = rest.slice(m[0].length);
      continue;
    }

    // Plain text — grab up to the next possibly-special character.
    const next = rest.slice(1).search(NEXT_SPECIAL);
    if (next === -1) {
      buf += rest;
      rest = '';
    } else {
      buf += rest.slice(0, next + 1);
      rest = rest.slice(next + 1);
    }
  }
  flush();
  return out;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^(```|~~~)/;
const QUOTE = /^>\s?/;
const BULLET = /^\s*[-*+]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (FENCE.test(line.trim())) {
      i++;
      const body: string[] = [];
      while (i < lines.length && !FENCE.test(lines[i].trim())) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ t: 'code', v: body.join('\n') });
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: 'heading', level: h[1].length, c: parseInline(h[2].trim()) });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const q: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        q.push(lines[i].replace(QUOTE, ''));
        i++;
      }
      blocks.push({ t: 'quote', c: parseInline(q.join('\n')) });
      continue;
    }

    if (BULLET.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(parseInline(lines[i].replace(BULLET, '')));
        i++;
      }
      blocks.push({ t: 'bullet', items });
      continue;
    }

    if (ORDERED.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && ORDERED.test(lines[i])) {
        items.push(parseInline(lines[i].replace(ORDERED, '')));
        i++;
      }
      blocks.push({ t: 'ordered', items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !FENCE.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ t: 'p', c: parseInline(para.join('\n')) });
  }

  return blocks;
}

/** Flatten markdown + mention tokens to readable one-line text (list previews). */
export function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/@\[([^\]]+)\]\((?:user|guest|post):[^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tint(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return 'transparent';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Ctx {
  accent: string;
  text: string;
  textDim: string;
  fieldBg: string;
  onPostPress?: (postId: string) => void;
}

function renderInline(nodes: Inline[], ctx: Ctx, prefix = ''): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${prefix}${i}`;
    switch (n.t) {
      case 'text':
        return <Text key={key}>{n.v}</Text>;
      case 'strong':
        return (
          <Text key={key} style={styles.strong}>
            {renderInline(n.c, ctx, `${key}.`)}
          </Text>
        );
      case 'em':
        return (
          <Text key={key} style={styles.em}>
            {renderInline(n.c, ctx, `${key}.`)}
          </Text>
        );
      case 'code':
        return (
          <Text key={key} style={[styles.code, { backgroundColor: ctx.fieldBg }]}>
            {n.v}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            style={{ color: ctx.accent }}
            onPress={() => {
              Linking.openURL(n.href).catch(() => {});
            }}>
            {renderInline(n.c, ctx, `${key}.`)}
          </Text>
        );
      case 'userMention':
        return (
          <Text key={key} style={[styles.strong, { color: ctx.accent }]}>
            @{n.name}
          </Text>
        );
      case 'postMention':
        return (
          <Text
            key={key}
            onPress={ctx.onPostPress ? () => ctx.onPostPress?.(n.postId) : undefined}
            style={[styles.mention, { color: ctx.accent, backgroundColor: tint(ctx.accent, 0.12) }]}>
            {' '}#{n.title}{' '}
          </Text>
        );
    }
  });
}

function BlockView({ block, ctx }: { block: Block; ctx: Ctx }) {
  const base = { color: ctx.text, fontSize: FONT.body, lineHeight: 21 };

  switch (block.t) {
    case 'p':
      return <Text style={base}>{renderInline(block.c, ctx)}</Text>;
    case 'heading':
      return (
        <Text style={[base, styles.strong, block.level <= 1 && { fontSize: FONT.body + 2 }]}>
          {renderInline(block.c, ctx)}
        </Text>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: ctx.fieldBg }]}>
          <Text style={[base, { color: ctx.textDim }]}>{renderInline(block.c, ctx)}</Text>
        </View>
      );
    case 'bullet':
      return (
        <View style={styles.list}>
          {block.items.map((it, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[base, { color: ctx.textDim }]}>{'•'}</Text>
              <Text style={[base, styles.listText]}>{renderInline(it, ctx, `b${i}.`)}</Text>
            </View>
          ))}
        </View>
      );
    case 'ordered':
      return (
        <View style={styles.list}>
          {block.items.map((it, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[base, { color: ctx.textDim }]}>{i + 1}.</Text>
              <Text style={[base, styles.listText]}>{renderInline(it, ctx, `o${i}.`)}</Text>
            </View>
          ))}
        </View>
      );
    case 'code':
      return (
        <View style={[styles.codeBlock, { backgroundColor: ctx.fieldBg }]}>
          <Text style={[styles.codeBlockText, { color: ctx.text }]}>{block.v}</Text>
        </View>
      );
  }
}

export interface RichTextProps {
  content: string;
  /** Called with the target post id when a `#[…]` reference is tapped. */
  onPostPress?: (postId: string) => void;
}

/** Render feedback post / comment content with mentions and light Markdown. */
export function RichText({ content, onPostPress }: RichTextProps) {
  const theme = useTheme();
  const blocks = useMemo(() => parseBlocks(content), [content]);
  const ctx: Ctx = {
    accent: theme.accent,
    text: theme.text,
    textDim: theme.textDim,
    fieldBg: theme.fieldBg,
    onPostPress,
  };

  return (
    <View style={styles.root}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} ctx={ctx} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  code: { fontFamily: MONO, fontSize: FONT.small },
  mention: { fontWeight: '600', fontSize: FONT.small, borderRadius: 4, overflow: 'hidden' },
  quote: { borderLeftWidth: 2, paddingLeft: 10 },
  list: { gap: 4 },
  listItem: { flexDirection: 'row', gap: 8 },
  listText: { flex: 1 },
  codeBlock: { borderRadius: RADIUS, padding: 10 },
  codeBlockText: { fontFamily: MONO, fontSize: FONT.small, lineHeight: 19 },
});
