import { Button, Group, Modal, TextInput } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import modalStyles from './PermanentDeleteModal.module.css';
import pageStyles from '../pages/TrashPage.module.css';

export const PERMANENT_DELETE_CONFIRM_TEXT = 'KALICI OLARAK SİL';

type PermanentDeleteModalProps = {
  opened: boolean;
  mode: 'single' | 'bulk';
  titleText?: string;
  count?: number;
  loading: boolean;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function PermanentDeleteModal({
  opened,
  mode,
  titleText,
  count = 0,
  loading,
  confirmText,
  onConfirmTextChange,
  onClose,
  onConfirm,
}: PermanentDeleteModalProps) {
  const canConfirm =
    confirmText.trim().toUpperCase() === PERMANENT_DELETE_CONFIRM_TEXT;

  const title =
    mode === 'bulk'
      ? 'Seçili dokümanları kalıcı olarak sil?'
      : 'Dokümanı kalıcı olarak sil?';

  const description =
    mode === 'bulk'
      ? `${count} doküman kalıcı olarak silinecek. Bu işlem geri alınamaz.`
      : `Bu işlem geri alınamaz. ${titleText ?? 'Doküman'} ve ilişkili kayıtlar kalıcı olarak silinebilir.`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      radius="md"
      styles={{
        content: {
          border: '1px solid rgba(239, 68, 68, 0.45)',
          boxShadow: '0 0 32px rgba(239, 68, 68, 0.14)',
        },
      }}
    >
      {mode === 'bulk' && count > 0 ? (
        <span className={pageStyles.bulkCountBadge}>{count} doküman seçildi</span>
      ) : null}
      <div className={modalStyles.warningBox}>
        <IconAlertTriangle size={20} className={modalStyles.warningIcon} />
        <p className={modalStyles.description}>{description}</p>
      </div>
      <TextInput
        label={`Onay için "${PERMANENT_DELETE_CONFIRM_TEXT}" yazın`}
        placeholder={PERMANENT_DELETE_CONFIRM_TEXT}
        value={confirmText}
        onChange={(e) => onConfirmTextChange(e.currentTarget.value)}
        mb="lg"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={loading}>
          İptal
        </Button>
        <Button color="red" loading={loading} disabled={!canConfirm} onClick={onConfirm}>
          Kalıcı Sil
        </Button>
      </Group>
    </Modal>
  );
}
