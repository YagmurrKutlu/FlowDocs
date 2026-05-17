import puppeteer from 'puppeteer';
import type { ExportBuildContext } from './lexical-export.types';
import { buildFlowdocsExportHtml } from './lexical-export.template';

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });
  }
  return browserInstance;
}

export async function buildExportPdf(context: ExportBuildContext): Promise<Buffer> {
  const html = await buildFlowdocsExportHtml(context, { includeDocumentTitle: true });
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 60_000,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '14mm',
        left: '12mm',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
