import { createContext, useContext, type ReactNode } from 'react';

const DocumentEditorCanEditContext = createContext(true);

export function DocumentEditorCapabilitiesProvider({
  canEdit,
  children,
}: {
  canEdit: boolean;
  children: ReactNode;
}) {
  return (
    <DocumentEditorCanEditContext.Provider value={canEdit}>
      {children}
    </DocumentEditorCanEditContext.Provider>
  );
}

export function useDocumentEditorCanEdit(): boolean {
  return useContext(DocumentEditorCanEditContext);
}
