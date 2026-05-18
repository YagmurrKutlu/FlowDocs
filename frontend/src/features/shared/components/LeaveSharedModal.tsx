import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { formatRoleLabel } from '../shared.utils';
import { useLeaveSharedWithMeMutation } from '../hooks/useSharedQueries';
import type { SharedWithMeDocument } from '../types/shared.types';
import styles from '../pages/SharedPage.module.css';

type LeaveSharedModalProps = {
  document: SharedWithMeDocument | null;
  opened: boolean;
  onClose: () => void;
};

export function LeaveSharedModal({ document, opened, onClose }: LeaveSharedModalProps) {
  const leaveMutation = useLeaveSharedWithMeMutation();

  const handleConfirm = () => {
    if (!document) return;

    void leaveMutation.mutate(document.id, {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          message: 'Paylaşım erişimi kaldırıldı.',
        });
        onClose();
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
    <Modal
      opened={opened}
      onClose={onClose}
      title="Paylaşımdan ayrıl?"
      centered
      radius="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Bu dokümana ait paylaşım erişiminiz kaldırılacak. Dokümana tekrar erişebilmek
          için yeniden paylaşılması gerekir.
        </Text>
        {document ? (
          <div className={styles.leaveDetailBox}>
            <p>
              <span className={styles.leaveDetailLabel}>Doküman</span>
              <strong>{document.title}</strong>
            </p>
            <p>
              <span className={styles.leaveDetailLabel}>Rolüm</span>
              <strong>{formatRoleLabel(document.myRole)}</strong>
            </p>
            <p>
              <span className={styles.leaveDetailLabel}>Paylaşan</span>
              <strong>{document.owner.name}</strong>
            </p>
          </div>
        ) : null}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={leaveMutation.isPending}>
            İptal
          </Button>
          <Button
            className={styles.leaveConfirmBtn}
            loading={leaveMutation.isPending}
            onClick={handleConfirm}
          >
            Erişimden Ayrıl
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
