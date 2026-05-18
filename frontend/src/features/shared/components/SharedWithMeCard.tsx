import { Avatar, Button } from '@mantine/core';
import { IconCopy, IconExternalLink, IconFileText, IconLogout } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { DocumentFavoriteButton } from '../../documents/components/DocumentFavoriteButton';
import { useOpenSharedDocument } from '../hooks/useOpenSharedDocument';
import {
  copyDocumentLink,
  displayPersonName,
  formatDateTime,
  formatRoleLabel,
  ownerInitial,
  previewSnippet,
  workspaceDisplayName,
} from '../shared.utils';
import type { SharedWithMeDocument } from '../types/shared.types';
import { LeaveSharedModal } from './LeaveSharedModal';
import styles from '../pages/SharedPage.module.css';

type SharedWithMeCardProps = {
  document: SharedWithMeDocument;
};

function resolveRoleBadgeClass(role: string): string {
  const r = role.toUpperCase();
  if (r === 'EDITOR') return styles.roleBadgeEditor;
  if (r === 'VIEWER') return styles.roleBadgeViewer;
  if (r === 'OWNER') return styles.roleBadgeOwner;
  return styles.roleBadge;
}

export function SharedWithMeCard({ document: doc }: SharedWithMeCardProps) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const { openDocument } = useOpenSharedDocument();
  const ownerName = displayPersonName(doc.owner.name);

  const handleCopyLink = async () => {
    const ok = await copyDocumentLink(doc.id);
    notifications.show({
      color: ok ? 'green' : 'red',
      message: ok ? 'Doküman bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
    });
  };

  return (
    <>
      <article className={styles.docCard}>
        <div className={styles.docCardHeader}>
          <div className={styles.docIconWrap} aria-hidden>
            <IconFileText size={22} stroke={1.6} />
          </div>
          <DocumentFavoriteButton documentId={doc.id} isFavorite={doc.isFavorite} />
        </div>
        <h2 className={styles.docTitle} title={doc.title}>
          {doc.title}
        </h2>
        <div className={styles.badgeRow}>
          <span className={styles.workspaceBadge} title={workspaceDisplayName(doc.workspaceName)}>
            {workspaceDisplayName(doc.workspaceName)}
          </span>
          <span className={`${styles.roleBadge} ${resolveRoleBadgeClass(doc.myRole)}`}>
            Rolüm: {formatRoleLabel(doc.myRole)}
          </span>
        </div>
        <div className={styles.ownerRow}>
          <Avatar size={28} radius="xl" className={styles.ownerAvatar}>
            {ownerInitial(ownerName)}
          </Avatar>
          <div className={styles.ownerText}>
            <span className={styles.ownerLabel}>Paylaşan</span>
            <strong className={styles.ownerName} title={ownerName}>
              {ownerName}
            </strong>
          </div>
        </div>
        <p className={styles.preview}>{previewSnippet(doc.previewContent)}</p>
        <ul className={styles.metaRow}>
          <li>
            <span className={styles.metaLabel}>Güncellendi</span>
            <span className={styles.metaValue}>{formatDateTime(doc.updatedAt)}</span>
          </li>
          <li>
            <span className={styles.metaLabel}>Paylaşım</span>
            <span className={styles.metaValue}>{formatDateTime(doc.sharedAt)}</span>
          </li>
          <li>
            <span className={styles.metaLabel}>Üye</span>
            <span className={styles.metaValue}>{doc.memberCount}</span>
          </li>
        </ul>
        <div className={styles.cardActions}>
          <Button
            className={styles.openBtn}
            size="sm"
            leftSection={<IconExternalLink size={14} />}
            onClick={() => openDocument(doc.id)}
          >
            Aç
          </Button>
          <Button
            className={styles.copyBtn}
            size="sm"
            leftSection={<IconCopy size={14} />}
            onClick={() => void handleCopyLink()}
          >
            Linki Kopyala
          </Button>
          <Button
            className={styles.leaveBtn}
            size="sm"
            leftSection={<IconLogout size={14} />}
            onClick={() => setLeaveOpen(true)}
          >
            Erişimden Ayrıl
          </Button>
        </div>
      </article>
      <LeaveSharedModal
        document={doc}
        opened={leaveOpen}
        onClose={() => setLeaveOpen(false)}
      />
    </>
  );
}
