import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from './api';
import { markBackupCompletedNow } from './user-settings';

const BACKUP_TABLES = [
  'prompts',
  'characters',
  'character_details',
  'gallery',
  'tags',
  'prompt_tags',
  'model_usage',
  'prompt_versions',
  'style_learning',
  'batch_tests',
  'batch_test_results',
] as const;

type BackupTableName = typeof BACKUP_TABLES[number];

export type TableRow = Record<string, unknown>;

export interface DatabaseBackupPayload {
  version: string;
  exported_at: string;
  data: Record<BackupTableName, TableRow[]>;
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getBackupDateStamp() {
  return new Date().toISOString().split('T')[0];
}

export async function createDatabaseBackupPayload(): Promise<DatabaseBackupPayload> {
  const queries = BACKUP_TABLES.map((table) => db.from(table).select('*'));
  const results = await Promise.all(queries);

  const data = {} as Record<BackupTableName, TableRow[]>;

  for (const [i, table] of BACKUP_TABLES.entries()) {
    const result = results[i];
    data[table] = (result?.data ?? []) as TableRow[];
  }

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    data,
  };
}

export async function exportDatabaseBackupJson() {
  const backup = await createDatabaseBackupPayload();
  const timestamp = getBackupDateStamp();
  downloadJson(backup, `nightcafe-companion-backup-${timestamp}.json`);
  markBackupCompletedNow();
}

export async function exportDatabaseAndImagesBackupZip() {
  const backup = await createDatabaseBackupPayload();
  const zip = new JSZip();
  const imagesFolder = zip.folder('images');

  const galleryRows = backup.data.gallery;
  const imageRows = galleryRows.filter((item) => {
    if (typeof item.image_url !== 'string') return false;
    if (!item.image_url.trim()) return false;
    if (item.media_type && item.media_type !== 'image') return false;
    return true;
  });

  const imageManifest: Array<Record<string, unknown>> = [];

  const imagePromises = imageRows.map(async (item, index) => {
    const imageUrl = String(item.image_url);

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const mimePart = blob.type.split('/')[1] || 'png';
      const extension = mimePart.includes('jpeg') ? 'jpg' : mimePart;
      const filename = `image_${index + 1}.${extension}`;

      if (imagesFolder) {
        imagesFolder.file(filename, blob);
      }

      imageManifest.push({
        id: item.id,
        title: item.title,
        image_url: imageUrl,
        filename,
      });
    } catch {
      imageManifest.push({
        id: item.id,
        title: item.title,
        image_url: imageUrl,
        filename: null,
        error: 'Failed to download image while creating backup',
      });
    }
  });

  await Promise.all(imagePromises);

  zip.file('database-backup.json', JSON.stringify(backup, null, 2));
  zip.file('images-manifest.json', JSON.stringify(imageManifest, null, 2));

  const timestamp = getBackupDateStamp();
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `nightcafe-companion-backup-with-images-${timestamp}.zip`);
  markBackupCompletedNow();
}
