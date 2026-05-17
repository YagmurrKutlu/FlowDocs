import { Button, Modal, Select, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { CreateWorkspaceInvitePayload } from '../types/team.types';

type InviteMemberModalProps = {
  opened: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateWorkspaceInvitePayload) => void;
};

export function InviteMemberModal({
  opened,
  loading,
  onClose,
  onSubmit,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('E-posta adresi gerekli.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Geçerli bir e-posta girin.');
      return;
    }
    setError(null);
    onSubmit({ email: trimmed, role });
    setEmail('');
    setRole('EDITOR');
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Üye Davet Et"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 4 }}
    >
      <TextInput
        label="E-posta"
        placeholder="ornek@firma.com"
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
        error={error ?? undefined}
        mb="md"
      />
      <Select
        label="Rol"
        value={role}
        onChange={(v) => v && setRole(v as 'EDITOR' | 'VIEWER')}
        data={[
          { value: 'EDITOR', label: 'Editör' },
          { value: 'VIEWER', label: 'İzleyici' },
        ]}
        mb="lg"
      />
      <Button
        fullWidth
        variant="gradient"
        gradient={{ from: '#7C3AED', to: '#5B8CFF', deg: 135 }}
        loading={loading}
        onClick={handleSubmit}
      >
        Davet Oluştur
      </Button>
    </Modal>
  );
}
