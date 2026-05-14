import { Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { DocumentListItem } from '../../documents/types/document.types';
import { AvatarStack, type AvatarStackItem } from './AvatarStack';
import styles from './DashboardDocumentCard.module.css';

const ACCENTS = ['blue', 'green', 'orange', 'violet', 'red'] as const;

const ACCENT_CSS: Record<(typeof ACCENTS)[number], string> = {
  blue: styles.accentBlue,
  green: styles.accentGreen,
  orange: styles.accentOrange,
  violet: styles.accentViolet,
  red: styles.accentRed,
};

const EMOJI_POOL = ['📋', '📄', '🗂️', '🏗️', '⚙️', '📎', '✨', '🔷'];

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function buildAvatarPlaceholders(doc: DocumentListItem): AvatarStackItem[] {
  const seed = hashSeed(doc.id);
  const n = 2 + (seed % 2);
  const palette = ['blue', 'grape', 'cyan', 'pink', 'teal', 'violet'];
  const out: AvatarStackItem[] = [];
  for (let i = 0; i < n; i += 1) {
    const c = seed + i * 17;
    const letter = doc.title.trim().charAt(i % doc.title.length) || '•';
    out.push({
      key: `${doc.id}-p-${i}`,
      label: letter,
      color: palette[c % palette.length],
    });
  }
  return out;
}

function formatUpdatedTr(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Güncelleme bilinmiyor';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce güncellendi';
  if (mins < 60) return `${mins} dk önce güncellendi`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce güncellendi`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce güncellendi`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

function isLiveRecently(iso: string, hours = 36): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < hours * 3600000;
}

function activeLabel(doc: DocumentListItem): { live: boolean; text: string } {
  const live = isLiveRecently(doc.updatedAt, 48);
  if (live) {
    const n = (hashSeed(doc.id) % 4) + 1;
    return { live: true, text: `${n} aktif` };
  }
  return { live: false, text: 'Çevrimdışı' };
}

type DashboardDocumentCardProps = {
  document: DocumentListItem;
  index: number;
};

export function DashboardDocumentCard({ document: doc, index }: DashboardDocumentCardProps) {
  const accent = ACCENTS[index % ACCENTS.length];
  const emoji = EMOJI_POOL[hashSeed(doc.id) % EMOJI_POOL.length];
  const status = activeLabel(doc);
  const avatars = buildAvatarPlaceholders(doc);

  return (
    <Link to={`/documents/${doc.id}`} className={styles.link}>
      <article className={styles.card}>
        <div className={`${styles.accent} ${ACCENT_CSS[accent]}`} />
        <div className={styles.body}>
          <div className={styles.emojiRow}>
            <span className={styles.emoji} aria-hidden>
              {emoji}
            </span>
          </div>
          <Text className={styles.docTitle} fw={600} size="sm" lineClamp={2}>
            {doc.title}
          </Text>
          <Text className={styles.updated} size="xs" mt={6}>
            {formatUpdatedTr(doc.updatedAt)}
          </Text>
          <div className={styles.footer}>
            <AvatarStack items={avatars} />
            <div className={styles.status}>
              <span
                className={status.live ? styles.dotLive : styles.dotOff}
                aria-hidden
              />
              <Text size="xs" className={status.live ? styles.statusLive : styles.statusOff}>
                {status.text}
              </Text>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
