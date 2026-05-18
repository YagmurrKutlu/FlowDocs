import { ActionIcon, Tooltip } from '@mantine/core';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useToggleFavoriteMutation } from '../../favorites/hooks/useFavoritesQueries';
import styles from './DocumentFavoriteButton.module.css';

type DocumentFavoriteButtonProps = {
  documentId: string;
  isFavorite: boolean;
  className?: string;
};

export function DocumentFavoriteButton({
  documentId,
  isFavorite,
  className,
}: DocumentFavoriteButtonProps) {
  const toggle = useToggleFavoriteMutation();
  const isLoading = toggle.isPending && toggle.variables?.documentId === documentId;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    void toggle.mutate(
      { documentId, isFavorite },
      {
        onSuccess: () => {
          notifications.show({
            color: 'green',
            message: isFavorite ? 'Favorilerden çıkarıldı.' : 'Favorilere eklendi.',
          });
        },
        onError: (error) => {
          let message = getApiErrorMessage(error);
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status === 410) {
              message = 'Bu doküman çöp kutusunda.';
            } else if (status === 403 || status === 404) {
              message = 'Bu dokümana erişiminiz artık yok.';
            }
          }
          notifications.show({
            color: 'red',
            message,
          });
        },
      },
    );
  };

  const starClass = isFavorite
    ? `${styles.starBtn} ${styles.starBtnFilled}`
    : styles.starBtn;

  return (
    <Tooltip
      label={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      withArrow
      position="top"
    >
      <ActionIcon
        className={[starClass, className].filter(Boolean).join(' ')}
        variant="subtle"
        color="yellow"
        aria-label={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        loading={isLoading}
        disabled={isLoading}
        loaderProps={{ size: 14 }}
        onClick={handleClick}
      >
        {isFavorite ? (
          <IconStarFilled size={18} color="#FBBF24" />
        ) : (
          <IconStar size={18} stroke={1.6} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
