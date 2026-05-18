import { ActionIcon, Menu } from '@mantine/core';
import {
  IconCopy,
  IconDotsVertical,
  IconDownload,
  IconPencil,
  IconShare3,
  IconTrash,
} from '@tabler/icons-react';
import type { DocumentListItem } from '../types/document.types';
import styles from '../pages/DocumentsPage.module.css';

type DocumentActionsMenuProps = {
  document: DocumentListItem;
  onShare: () => void;
  onRename: () => void;
  onTrash: () => void;
  onCopyLink: () => void;
  onExport?: () => void;
  stopPropagation?: (event: React.MouseEvent) => void;
};

export function DocumentActionsMenu({
  document: doc,
  onShare,
  onRename,
  onTrash,
  onCopyLink,
  onExport,
  stopPropagation,
}: DocumentActionsMenuProps) {
  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    stopPropagation?.(event);
  };

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          className={styles.cardMenuBtn}
          variant="subtle"
          color="gray"
          aria-label="Daha fazla işlem"
          onClick={stop}
        >
          <IconDotsVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown className={styles.actionsDropdown} onClick={stop}>
        {onExport ? (
          <Menu.Item
            leftSection={<IconDownload size={16} />}
            onClick={(e) => {
              stop(e);
              onExport();
            }}
          >
            Dışa Aktar
          </Menu.Item>
        ) : null}
        {doc.canShare ? (
          <Menu.Item
            leftSection={<IconShare3 size={16} />}
            onClick={(e) => {
              stop(e);
              onShare();
            }}
          >
            Paylaş
          </Menu.Item>
        ) : null}
        {doc.canEdit ? (
          <Menu.Item
            leftSection={<IconPencil size={16} />}
            onClick={(e) => {
              stop(e);
              onRename();
            }}
          >
            Yeniden Adlandır
          </Menu.Item>
        ) : null}
        {doc.canDelete ? (
          <Menu.Item
            color="orange"
            leftSection={<IconTrash size={16} />}
            onClick={(e) => {
              stop(e);
              onTrash();
            }}
          >
            Çöp Kutusuna Taşı
          </Menu.Item>
        ) : null}
        <Menu.Item
          leftSection={<IconCopy size={16} />}
          onClick={(e) => {
            stop(e);
            onCopyLink();
          }}
        >
          Linki Kopyala
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
