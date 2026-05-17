/**
 * Recover latest non-empty document state from snapshot/update history.
 *
 * Usage:
 *   npm run recover:document -- --documentId=<cuid>
 *   npm run recover:document -- --documentId=<cuid> --userId=<cuid>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentStateRecoveryService } from '../src/documents/document-state-recovery.service';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

async function shutdownAndExit(app: { close: () => Promise<void> }, code: number): Promise<void> {
  const forceTimer = setTimeout(() => {
    process.exit(code);
  }, 5000);
  forceTimer.unref();

  try {
    await app.close();
  } catch {
    // ignore shutdown errors — result already known
  }

  clearTimeout(forceTimer);
  process.exit(code);
}

async function main(): Promise<void> {
  const documentId = readArg('documentId');
  const userId = readArg('userId');

  if (!documentId) {
    console.error('Missing --documentId=<id>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const recovery = app.get(DocumentStateRecoveryService);
    const result = await recovery.runRecovery(documentId, userId);
    console.log(JSON.stringify(result, null, 2));
    await shutdownAndExit(app, result.recovered ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await shutdownAndExit(app, 1);
  }
}

void main();
