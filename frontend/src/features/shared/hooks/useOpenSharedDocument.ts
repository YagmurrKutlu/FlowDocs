import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { probeDocumentAccess } from '../shared.utils';

export function useOpenSharedDocument() {
  const navigate = useNavigate();

  const openDocument = (documentId: string, options?: { share?: boolean }) => {
    void (async () => {
      const result = await probeDocumentAccess(documentId);
      if (!result.ok) {
        notifications.show({
          color: 'red',
          message: result.message,
        });
        return;
      }

      const query = options?.share ? '?share=open' : '';
      navigate(`/documents/${documentId}${query}`);
    })();
  };

  return { openDocument };
}
