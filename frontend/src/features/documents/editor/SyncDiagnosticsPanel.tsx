import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconActivity } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useExperimentalPreference } from '../../settings/hooks/useSettingsPreferences';
import {
  getSyncDiagnosticsSnapshot,
  subscribeSyncDiagnostics,
  type SyncDiagnosticsSnapshot,
} from './editorSyncDiagnosticsStore';
import editorShell from './DocumentEditorShell.module.css';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('tr-TR');
  } catch {
    return '—';
  }
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={editorShell.syncDiagRow}>
      <Text span className={editorShell.syncDiagLabel}>
        {label}
      </Text>
      <Text span className={editorShell.syncDiagValue}>
        {value}
      </Text>
    </div>
  );
}

export function SyncDiagnosticsPanel() {
  const enabled = useExperimentalPreference('advancedSyncDiagnostics');
  const [open, setOpen] = useState(true);
  const [snap, setSnap] = useState<SyncDiagnosticsSnapshot>(() =>
    getSyncDiagnosticsSnapshot(),
  );

  useEffect(() => {
    if (!enabled) return;
    return subscribeSyncDiagnostics(() => {
      setSnap(getSyncDiagnosticsSnapshot());
    });
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <Box className={editorShell.syncDiagnosticsPanel}>
      <UnstyledButton
        className={editorShell.syncDiagnosticsHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <IconActivity size={16} />
        <Text span fw={600} size="sm">
          Senkron tanılama
        </Text>
        {open ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
      </UnstyledButton>
      {open ? (
        <div className={editorShell.syncDiagnosticsBody}>
          <Row
            label="Socket"
            value={snap.socketConnected ? 'Bağlı' : 'Bağlı değil'}
          />
          <Row label="Doküman" value={snap.documentId || '—'} />
          <Row label="Rol" value={snap.userRole} />
          <Row label="Son güncelleme" value={formatTime(snap.lastDocumentUpdateAt)} />
          <Row label="Yerel güncelleme" value={snap.localUpdateCount} />
          <Row label="Uzak güncelleme" value={snap.remoteUpdateCount} />
          <Row label="Bekleyen kuyruk" value={snap.pendingQueueLength} />
          <Row label="Kayıt durumu" value={snap.persistStatus} />
          <Row label="İşbirlikçi" value={snap.collaboratorCount} />
        </div>
      ) : null}
    </Box>
  );
}
