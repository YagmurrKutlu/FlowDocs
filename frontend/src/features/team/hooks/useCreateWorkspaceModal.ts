import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useCreateWorkspaceMutation } from './useTeamQueries';

export function useCreateWorkspaceModal(options?: {
  onCreated?: (workspaceId: string) => void;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const createWorkspace = useCreateWorkspaceMutation(options);

  const handleSubmit = async (name: string) => {
    try {
      await createWorkspace.mutateAsync(name);
      notifications.show({
        message: 'Çalışma alanı oluşturuldu.',
        color: 'green',
      });
      close();
    } catch (error) {
      const message = getApiErrorMessage(error);
      notifications.show({
        title: 'Çalışma alanı oluşturulamadı',
        message:
          message !== 'Something went wrong. Please try again.'
            ? message
            : 'Çalışma alanı oluşturulamadı.',
        color: 'red',
      });
    }
  };

  return {
    opened,
    open,
    close,
    handleSubmit,
    isPending: createWorkspace.isPending,
  };
}
