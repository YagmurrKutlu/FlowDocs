import { Skeleton } from '@mantine/core';
import styles from '../pages/TrashPage.module.css';

export function TrashDocumentCardSkeleton() {
  return (
    <div className={styles.docCardSkeleton} aria-hidden>
      <Skeleton circle height={20} width={20} />
      <Skeleton circle height={44} width={44} />
      <div className={styles.docCardSkeletonBody}>
        <Skeleton height={20} width="55%" radius="md" mb={10} />
        <Skeleton height={14} width="35%" radius="md" mb={14} />
        <div className={styles.docCardSkeletonMeta}>
          <Skeleton height={36} radius="md" />
          <Skeleton height={36} radius="md" />
          <Skeleton height={36} radius="md" />
          <Skeleton height={36} radius="md" />
        </div>
      </div>
      <div className={styles.docCardSkeletonActions}>
        <Skeleton height={36} radius="md" />
        <Skeleton height={36} radius="md" />
      </div>
    </div>
  );
}
