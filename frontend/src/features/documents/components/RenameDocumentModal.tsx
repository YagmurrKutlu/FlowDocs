import { Button, Group, Modal, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useRenameDocumentMutation } from '../hooks/useDocumentsQueries';

type RenameDocumentModalProps = {
  opened: boolean;
  documentId: string;
  currentTitle: string;
  onClose: () => void;
};

export function RenameDocumentModal({
  opened,
  documentId,
  currentTitle,
  onClose,
}: RenameDocumentModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const renameMutation = useRenameDocumentMutation();

  useEffect(() => {
    if (opened) {
      setTitle(currentTitle);
    }
  }, [opened, currentTitle]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (trimmed.length < 2) {
      notifications.show({
        color: 'red',
        message: 'Başlık en az 2 karakter olmalıdır.',
      });
      return;
    }

    void renameMutation.mutate(
      { documentId, title: trimmed },
      {
        onSuccess: () => {
          notifications.show({
            color: 'green',
            message: 'Doküman adı güncellendi.',
          });
          onClose();
        },
        onError: (error) => {
          notifications.show({
            color: 'red',
            message: getApiErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Doküman adını değiştir"
      centered
      radius="md"
    >
      <TextInput
        label="Yeni başlık"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={renameMutation.isPending}>
          İptal
        </Button>
        <Button loading={renameMutation.isPending} onClick={handleSubmit}>
          Kaydet
        </Button>
      </Group>
    </Modal>
  );
}
