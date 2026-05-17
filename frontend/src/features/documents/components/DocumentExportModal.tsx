import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrandHtml5,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconMarkdown,
} from '@tabler/icons-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/errors';
import {
  exportDocumentFile,
  type DocumentExportFormat,
} from '../api/documents.api';

interface DocumentExportModalProps {
  opened: boolean;
  onClose: () => void;
  documentId: string;
}

const EXPORT_OPTIONS: {
  format: DocumentExportFormat;
  label: string;
  description: string;
  icon: typeof IconFileTypePdf;
  color: string;
}[] = [
  {
    format: 'pdf',
    label: 'PDF olarak indir',
    description: 'A4 düzeninde yazdırılabilir belge',
    icon: IconFileTypePdf,
    color: 'red',
  },
  {
    format: 'docx',
    label: 'DOCX olarak indir',
    description: 'Microsoft Word / LibreOffice uyumlu',
    icon: IconFileTypeDocx,
    color: 'blue',
  },
  {
    format: 'html',
    label: 'HTML olarak indir',
    description: 'Tarayıcıda açılabilir web sayfası',
    icon: IconBrandHtml5,
    color: 'orange',
  },
  {
    format: 'markdown',
    label: 'Markdown olarak indir',
    description: 'Düz metin ve .md araçları için',
    icon: IconMarkdown,
    color: 'gray',
  },
];

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DocumentExportModal({
  opened,
  onClose,
  documentId,
}: DocumentExportModalProps) {
  const [loadingFormat, setLoadingFormat] = useState<DocumentExportFormat | null>(null);

  const handleExport = async (format: DocumentExportFormat) => {
    setLoadingFormat(format);
    try {
      const { blob, filename } = await exportDocumentFile(documentId, format);
      downloadBlob(blob, filename);
      notifications.show({
        title: 'Dışa aktarma tamamlandı',
        message: `${filename} indirildi.`,
        color: 'green',
      });
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Dışa aktarma başarısız',
        message: getApiErrorMessage(error) || 'Belge dışa aktarılamadı. Lütfen tekrar deneyin.',
        color: 'red',
      });
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Dışarı Aktar"
      centered
      size="md"
      overlayProps={{ backgroundOpacity: 0.45, blur: 4 }}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Belgenin güncel kayıtlı içeriği seçtiğiniz formatta indirilir. Düzenleme modu gerekmez.
        </Text>
        {EXPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isLoading = loadingFormat === option.format;
          const isDisabled = loadingFormat !== null && !isLoading;
          return (
            <Button
              key={option.format}
              type="button"
              variant="light"
              color={option.color}
              size="md"
              justify="flex-start"
              loading={isLoading}
              disabled={isDisabled}
              onClick={() => void handleExport(option.format)}
              styles={{ inner: { justifyContent: 'flex-start' } }}
            >
              <Group gap="sm" wrap="nowrap" w="100%">
                <ThemeIcon size={36} radius="md" variant="light" color={option.color}>
                  <Icon size={20} />
                </ThemeIcon>
                <Stack gap={0} align="flex-start" style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600}>
                    {option.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {option.description}
                  </Text>
                </Stack>
              </Group>
            </Button>
          );
        })}
      </Stack>
    </Modal>
  );
}
