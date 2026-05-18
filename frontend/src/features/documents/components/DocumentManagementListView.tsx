import { Checkbox } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
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

type DocumentManagementListViewProps = {
  documents: DocumentListItem[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (documentId: string) => void;
  onToggleSelectAll: () => void;
};

function resolveRoleBadgeClass(role: string | undefined): string {
  const r = (role ?? '').toUpperCase();
  if (r === 'EDITOR') return styles.roleBadgeEditor;
  if (r === 'VIEWER') return styles.roleBadgeViewer;
  if (r === 'OWNER') return styles.roleBadgeOwner;
  return styles.roleBadge;
}

function DocumentListRow({
  doc,
  selected,
  onToggleSelect,
}: {
  doc: DocumentListItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteDocumentMutation();
  const [exportOpened, { open: openExport, close: closeExport }] = useDisclosure(false);
  const [renameOpened, { open: openRename, close: closeRename }] = useDisclosure(false);
  const [trashOpened, { open: openTrash, close: closeTrash }] = useDisclosure(false);

  const role = doc.role ?? 'VIEWER';
  const workspaceName = workspaceDisplayName(doc.workspaceName);
  const ownerName = displayPersonName(doc.owner?.name);
  const accent = getDocumentAccent(doc.id);

  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleOpen = () => navigate(`/documents/${doc.id}`);

  const handleCopyLink = async () => {
    const ok = await copyDocumentLink(doc.id);
    notifications.show({
      color: ok ? 'green' : 'red',
      message: ok ? 'Doküman bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
    });
  };

  const confirmMoveToTrash = () => {
    void deleteMutation.mutate(doc.id, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Doküman çöp kutusuna taşındı.' });
        closeTrash();
      },
      onError: (error) => {
        notifications.show({ color: 'red', message: getApiErrorMessage(error) });
      },
    });
  };

  return (
    <>
      <tr
        className={`${styles.listRow} ${selected ? styles.listRowSelected : ''}`}
        data-accent={accent}
        onClick={handleOpen}
      >
        <td className={styles.listCellCheck} onClick={stop}>
          <Checkbox
            checked={selected}
            aria-label={`${doc.title} seç`}
            onChange={() => onToggleSelect(doc.id)}
          />
        </td>
        <td className={styles.listCellDoc}>
          <div className={styles.listDocMain}>
            <span className={`${styles.listDocIcon} ${styles.listDocIconAccent}`} aria-hidden>
              <IconFileText size={18} />
            </span>
            <div className={styles.listDocText}>
              <span className={styles.listDocTitle} title={doc.title}>
                {doc.title}
              </span>
              <span className={styles.listDocPreview}>{previewSnippet(doc.previewContent)}</span>
              <span className={styles.listDocOwner}>Sahip: {ownerName}</span>
            </div>
          </div>
        </td>
        <td className={styles.listCellWorkspace}>
          <span className={styles.workspaceBadge} title={workspaceName}>
            {workspaceName}
          </span>
        </td>
        <td className={styles.listCellRole}>
          <span className={`${styles.roleBadge} ${resolveRoleBadgeClass(role)}`}>
            {formatRoleLabel(role)}
          </span>
          {doc.isShared ? <span className={styles.sharedPill}>Paylaşıldı</span> : null}
        </td>
        <td className={styles.listCellMembers}>{formatMemberCount(doc.memberCount)}</td>
        <td className={styles.listCellUpdated}>{formatDateTime(doc.updatedAt)}</td>
        <td className={styles.listCellFavorite} onClick={stop}>
          <DocumentFavoriteButton
            className={styles.listFavoriteWrap}
            documentId={doc.id}
            isFavorite={doc.isFavorite ?? false}
          />
        </td>
        <td className={styles.listCellActions} onClick={stop}>
          <DocumentActionsMenu
            document={doc}
            onShare={() => navigate(`/documents/${doc.id}?share=open`)}
            onRename={openRename}
            onTrash={openTrash}
            onCopyLink={() => void handleCopyLink()}
            onExport={openExport}
          />
        </td>
      </tr>

      <DocumentExportModal opened={exportOpened} onClose={closeExport} documentId={doc.id} />
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

export function DocumentManagementListView({
  documents,
  selectedIds,
  allSelected,
  onToggleSelect,
  onToggleSelectAll,
}: DocumentManagementListViewProps) {
  return (
    <div className={styles.listScroll}>
      <table className={styles.listTable}>
        <thead>
          <tr>
            <th className={styles.listCellCheck}>
              <Checkbox
                checked={allSelected}
                indeterminate={selectedIds.size > 0 && !allSelected}
                aria-label="Tümünü seç"
                onChange={onToggleSelectAll}
              />
            </th>
            <th>Doküman</th>
            <th>Çalışma Alanı</th>
            <th>Rol</th>
            <th>Üyeler</th>
            <th>Son Güncelleme</th>
            <th>Favori</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <DocumentListRow
              key={doc.id}
              doc={doc}
              selected={selectedIds.has(doc.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
