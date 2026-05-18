import { Button, Group, Modal, Text } from '@mantine/core';

type MoveToTrashModalProps = {
  opened: boolean;
  documentTitle: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function MoveToTrashModal({
  opened,
  documentTitle,
  loading,
  onClose,
  onConfirm,
}: MoveToTrashModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Doküman çöp kutusuna taşınsın mı?"
      centered
      radius="md"
    >
      <Text size="sm" c="dimmed" mb="lg">
        <strong>{documentTitle}</strong> kalıcı olarak silinmez. Çöp Kutusu
        sayfasından geri yükleyebilirsiniz.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={loading}>
          İptal
        </Button>
        <Button color="orange" loading={loading} onClick={onConfirm}>
          Çöp Kutusuna Taşı
        </Button>
      </Group>
    </Modal>
  );
}
