import { notifications } from '@mantine/notifications';
import type { BulkTrashActionResponse } from '../types/trash.types';

export function notifyBulkRestoreResult(
  result: BulkTrashActionResponse,
  totalSelected: number,
) {
  const success = result.restoredCount ?? 0;
  const failed = result.failedCount;

  if (failed > 0) {
    notifications.show({
      color: 'orange',
      title: 'Bazı dokümanlar işlenemedi.',
      message: `${totalSelected} dokümandan ${success}'i geri yüklendi, ${failed}'i işlenemedi.`,
    });
    return;
  }

  notifications.show({
    color: 'green',
    message: `${success} doküman geri yüklendi.`,
  });
}

export function notifyBulkPermanentDeleteResult(
  result: BulkTrashActionResponse,
  totalSelected: number,
) {
  const success = result.deletedCount ?? 0;
  const failed = result.failedCount;

  if (failed > 0) {
    notifications.show({
      color: 'orange',
      title: 'Bazı dokümanlar işlenemedi.',
      message: `${totalSelected} dokümandan ${success}'i kalıcı silindi, ${failed}'i işlenemedi.`,
    });
    return;
  }

  notifications.show({
    color: 'green',
    message: `${success} doküman kalıcı olarak silindi.`,
  });
}
