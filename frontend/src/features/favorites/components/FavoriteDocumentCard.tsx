import { ActionIcon, Button, Checkbox, Tooltip } from '@mantine/core';
import {
  IconCopy,
  IconExternalLink,
  IconFileText,
  IconStarFilled,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { getApiErrorMessage } from '../../../shared/api/errors';
import {
  copyDocumentLink,
  formatDateTime,
  formatRoleLabel,
  previewSnippet,
  workspaceDisplayName,
} from '../favorites.utils';
import { useRemoveFavoriteMutation } from '../hooks/useFavoritesQueries';
import type { FavoriteDocumentItem } from '../types/favorites.types';
import styles from '../pages/FavoritesPage.module.css';

type FavoriteDocumentCardProps = {
  item: FavoriteDocumentItem;
  selected: boolean;
  removeLoading?: boolean;
  onToggleSelect: (documentId: string) => void;
};

export function FavoriteDocumentCard({
  item,
  selected,
  removeLoading,
  onToggleSelect,
}: FavoriteDocumentCardProps) {
  const removeMutation = useRemoveFavoriteMutation();
  const isRemoving = removeLoading ?? removeMutation.isPending;

  const handleRemove = () => {
    void removeMutation.mutate(item.id, {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          message: 'Favorilerden çıkarıldı.',
        });
      },
      onError: (error) => {
        notifications.show({
          color: 'red',
          message: getApiErrorMessage(error),
        });
      },
    });
  };

  const handleCopyLink = async () => {
    const ok = await copyDocumentLink(item.id);
    notifications.show({
      color: ok ? 'green' : 'red',
      message: ok ? 'Doküman bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
    });
  };

  const workspaceLabel = workspaceDisplayName(item.workspaceName);
  const roleLabel = formatRoleLabel(item.role);

  return (
    <article className={`${styles.favCard} ${selected ? styles.favCardSelected : ''}`}>
      <Checkbox
        className={styles.cardCheckbox}
        checked={selected}
        onChange={() => onToggleSelect(item.id)}
        aria-label={`${item.title} seç`}
      />
      <div className={styles.favCardHeader}>
        <div className={styles.docIconWrap} aria-hidden>
          <IconFileText size={22} stroke={1.6} />
        </div>
        <Tooltip label="Favorilerden çıkar" withArrow position="top">
          <ActionIcon
            className={styles.cardStarBtn}
            variant="subtle"
            aria-label="Favorilerden çıkar"
            loading={isRemoving}
            disabled={isRemoving}
            onClick={handleRemove}
          >
            <IconStarFilled size={18} color="#FBBF24" />
          </ActionIcon>
        </Tooltip>
      </div>
      <h2 className={styles.favTitle} title={item.title}>
        {item.title}
      </h2>
      <div className={styles.badgeRow}>
        <span className={styles.workspaceBadge} title={workspaceLabel}>
          {workspaceLabel}
        </span>
        <span className={styles.roleBadge}>{roleLabel}</span>
      </div>
      <p className={styles.preview}>{previewSnippet(item.previewContent)}</p>
      <ul className={styles.metaRow}>
        <li>
          <span className={styles.metaLabel}>Güncellendi</span>
          <span className={styles.metaValue}>{formatDateTime(item.updatedAt)}</span>
        </li>
        <li>
          <span className={styles.metaLabel}>Favoriye eklendi</span>
          <span className={styles.metaValue}>{formatDateTime(item.favoritedAt)}</span>
        </li>
        <li>
          <span className={styles.metaLabel}>Üye sayısı</span>
          <span className={styles.metaValue}>{item.memberCount}</span>
        </li>
      </ul>
      <div className={styles.cardActions}>
        <Button
          className={styles.openBtn}
          component={Link}
          to={`/documents/${item.id}`}
          size="sm"
          leftSection={<IconExternalLink size={14} />}
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
          className={styles.removeBtn}
          size="sm"
          loading={isRemoving}
          onClick={handleRemove}
        >
          Favoriden Çıkar
        </Button>
      </div>
    </article>
  );
}
