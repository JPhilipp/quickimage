import fs from 'fs';

export async function createFolderIfNeeded(folderPath) {
  if (!fs.existsSync(folderPath)) {
    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
    }
    catch (error) {
      console.error('createFolderIfNeeded failed to create folder:', error);
    }
  }
}