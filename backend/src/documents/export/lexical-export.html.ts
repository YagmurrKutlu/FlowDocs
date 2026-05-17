import type { ExportBuildContext } from './lexical-export.types';
import { buildFlowdocsExportHtml } from './lexical-export.template';

export async function buildExportHtml(context: ExportBuildContext): Promise<string> {
  return buildFlowdocsExportHtml(context, { includeDocumentTitle: true });
}
