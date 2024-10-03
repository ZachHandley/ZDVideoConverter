import { defineHook } from '@directus/extensions-sdk';
import { convertVideo } from './videoProcessor';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export default defineHook(({ action }, { services, database, getSchema }) => {
  action('files.upload', async ({ payload, key, collection }) => {
    if (collection !== 'directus_files' || !payload.type?.startsWith('video/') || payload.type === 'video/mp4') {
      return;
    }

    const { FilesService } = services;
    const schema = await getSchema();
    const filesService = new FilesService({ schema, knex: database });
    let tempDir: string | undefined;

    try {
      // Create a temporary directory
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directus-video-converter-'));

      // Get the full file path
      const file = await filesService.readOne(key);
      const fileStream = await filesService.getAsset(key);

      // Save the file to the temp directory
      const tempFilePath = path.join(tempDir, file.filename_download);
      await fs.writeFile(tempFilePath, fileStream);

      // Convert video
      const { buffer: convertedBuffer, filename: convertedFilename } = await convertVideo(await fs.readFile(tempFilePath), file.filename_download);

      // Update file in Directus
      await filesService.updateOne(key, {
        filename_download: convertedFilename,
        type: 'video/mp4',
        filesize: convertedBuffer.length,
      });

      // Replace the file content
      await filesService.uploadOne(convertedBuffer, {
        ...file,
        filename_download: convertedFilename,
        type: 'video/mp4',
        storage: file.storage,
      }, key);

      console.log(`Video file optimized and replaced successfully. File ID: ${key}`);

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Video optimization failed:', error);
    } finally {
      // Clean up temp directory
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  });
});