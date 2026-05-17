import { Button, Group, Modal, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import styles from '../pages/TeamPage.module.css';

type CreateWorkspaceModalProps = {
  opened: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function CreateWorkspaceModal({
  opened,
  loading,
  onClose,
  onSubmit,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      setName('');
      setError(null);
    }
  }, [opened]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Çalışma alanı adı gerekli.');
      return;
    }
    if (trimmed.length < 2) {
      setError('En az 2 karakter girin.');
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Yeni çalışma alanı oluştur"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 4 }}
    >
      <TextInput
        label="Çalışma alanı adı"
        placeholder="Örn. Bitirme Projesi Ekibi"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        error={error ?? undefined}
        mb="lg"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose} disabled={loading}>
          İptal
        </Button>
        <Button
          className={styles.heroPrimaryBtn}
          loading={loading}
          onClick={handleSubmit}
        >
          Oluştur
        </Button>
      </Group>
    </Modal>
  );
}
