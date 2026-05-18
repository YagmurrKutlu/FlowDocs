import { Button, Checkbox } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconExternalLink, IconFileText, IconDownload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../../shared/api/errors';
import {
  copyDocumentLink,
  displayPersonName,
  formatDateTime,
  formatMemberCount,
  formatRoleLabel,
  previewSnippet,
  workspaceDisplayName,
} from '../documents.utils';
import { useDeleteDocumentMutation } from '../hooks/useDocumentsQueries';
import type { DocumentListItem } from '../types/document.types';
import { DocumentActionsMenu } from './DocumentActionsMenu';
import { DocumentExportModal } from './DocumentExportModal';
import { DocumentFavoriteButton } from './DocumentFavoriteButton';
import { MoveToTrashModal } from './MoveToTrashModal';
import { RenameDocumentModal } from './RenameDocumentModal';
import { getDocumentAccent } from '../document-accent';
import styles from '../pages/DocumentsPage.module.css';

type DocumentManagementCardProps = {
  document: DocumentListItem;
  selected: boolean;
  onToggleSelect: (documentId: string) => void;
};

function resolveRoleBadgeClass(role: string | undefined): string {
  const r = (role ?? '').toUpperCase();
  if (r === 'EDITOR') return styles.roleBadgeEditor;
  if (r === 'VIEWER') return styles.roleBadgeViewer;
  if (r === 'OWNER') return styles.roleBadgeOwner;
  return styles.roleBadge;
}

export function DocumentManagementCard({
  document: doc,
  selected,
  onToggleSelect,
}: DocumentManagementCardProps) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteDocumentMutation();
  const [exportOpened, { open: openExport, close: closeExport }] = useDisclosure(false);
  const [renameOpened, { open: openRename, close: closeRename }] = useDisclosure(false);
  const [trashOpened, { open: openTrash, close: closeTrash }] = useDisclosure(false);

  const ownerName = displayPersonName(doc.owner?.name);
  const role = doc.role ?? 'VIEWER';
  const workspaceName = workspaceDisplayName(doc.workspaceName);
  const accent = getDocumentAccent(doc.id);

  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleCopyLink = async () => {
    const ok = await copyDocumentLink(doc.id);
    notifications.show({
      color: ok ? 'green' : 'red',
      message: ok ? 'Doküman bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
    });
  };

  const handleOpen = () => {
    navigate(`/documents/${doc.id}`);
  };

  const handleShare = () => {
    navigate(`/documents/${doc.id}?share=open`);
  };

  const confirmMoveToTrash = () => {
    void deleteMutation.mutate(doc.id, {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          message: 'Doküman çöp kutusuna taşındı.',
        });
        closeTrash();
      },
      onError: (error) => {
        notifications.show({
          color: 'red',
          message: getApiErrorMessage(error),
        });
      },
    });
  };

  return (
    <>
      <article
        className={`${styles.docCard} ${selected ? styles.docCardSelected : ''}`}
        data-accent={accent}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleOpen();
        }}
        role="button"
        tabIndex={0}
      >
        <div className={styles.docCardHeader}>
          <div className={styles.docCardHeaderLeft} onClick={stop}>
            <Checkbox
              className={`${styles.cardCheckbox} ${styles.cardCheckboxAccent}`}
              checked={selected}
              aria-label={`${doc.title} seç`}
              onChange={() => onToggleSelect(doc.id)}
            />
            <div className={styles.docIconWrap} aria-hidden>
              <IconFileText size={22} stroke={1.6} />
            </div>
          </div>
          <div className={styles.docCardHeaderActions} onClick={stop}>
            <DocumentFavoriteButton
              className={styles.cardFavoriteWrap}
              documentId={doc.id}
              isFavorite={doc.isFavorite ?? false}
            />
            <DocumentActionsMenu
              document={doc}
              onShare={handleShare}
              onRename={openRename}
              onTrash={openTrash}
              onCopyLink={() => void handleCopyLink()}
            />
          </div>
        </div>
        <h2 className={styles.docTitle} title={doc.title}>
          {doc.title}
        </h2>
        <div className={styles.badgeRow}>
          <span className={styles.workspaceBadge} title={workspaceName}>
            {workspaceName}
          </span>
          <span className={`${styles.roleBadge} ${resolveRoleBadgeClass(role)}`}>
            {formatRoleLabel(role)}
          </span>
          {doc.isShared ? (
            <span className={styles.sharedPill}>Paylaşıldı</span>
          ) : null}
        </div>
        <p className={styles.ownerLine}>
          Sahip: <strong title={ownerName}>{ownerName}</strong>
        </p>
        <p className={styles.preview}>{previewSnippet(doc.previewContent)}</p>
        <ul className={styles.metaRow}>
          <li>
            <span className={styles.metaLabel}>Üye</span>
            <span className={styles.metaValue}>{formatMemberCount(doc.memberCount)}</span>
          </li>
          <li>
            <span className={styles.metaLabel}>Oluşturulma</span>
            <span className={styles.metaValue}>{formatDateTime(doc.createdAt)}</span>
          </li>
          <li>
            <span className={styles.metaLabel}>Güncellendi</span>
            <span className={styles.metaValue}>{formatDateTime(doc.updatedAt)}</span>
          </li>
        </ul>
        <div className={styles.cardActions} onClick={stop}>
          <Button
            className={styles.openBtn}
            size="sm"
            leftSection={<IconExternalLink size={14} />}
            onClick={handleOpen}
          >
            Aç
          </Button>
          <Button
            className={styles.exportBtn}
            size="sm"
            leftSection={<IconDownload size={14} />}
            onClick={openExport}
          >
            Dışa Aktar
          </Button>
        </div>
      </article>

      <DocumentExportModal
        opened={exportOpened}
        onClose={closeExport}
        documentId={doc.id}
      />
      {doc.canEdit ? (
        <RenameDocumentModal
          opened={renameOpened}
          documentId={doc.id}
          currentTitle={doc.title}
          onClose={closeRename}
        />
      ) : null}
      <MoveToTrashModal
        opened={trashOpened}
        documentTitle={doc.title}
        workspaceName={workspaceName}
        role={role}
        loading={deleteMutation.isPending}
        onClose={closeTrash}
        onConfirm={confirmMoveToTrash}
      />
    </>
  );
}
