import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ai from './openAiHelper.js';
import * as stabilityAi from './stabilityAiHelper.js';
import { createFolderIfNeeded } from './common-libraries/fileSystem.js';
import { envToBoolean, delay } from './common-libraries/shared.js';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageFolder = 'images';
let mainWindow;

setup();

async function generateImage(data) {
  createFolderIfNeeded(imageFolder);
  const imagePath = `${imageFolder}/${data.id}.png`;
  const jsonPath  = `${imageFolder}/${data.id}.json`;

  const imageInfo = {
    model: data.model,
    prompt: data.prompt
  };

  const params = {
    prompt: data.prompt,
    path: imagePath,
    doRemoveBackgroundInAddition: true,
    imageInfo: imageInfo
  };

  console.log(`Generating ${data.model} image: ${data.prompt}`);

  switch (data.model) {
    case 'dall-e-3':
      if (process.env.OPENAI_API_KEY) {
        const [width, height] = data.widthAndHeight.split('x');
        params.width  = parseInt(width);
        params.height = parseInt(height);
        params.style = data.style;
        params.quality = data.quality;
        imageInfo.style = data.style;
        imageInfo.quality = data.quality;
        await ai.saveImage(params);
      }
      break;

    case 'stabilitydiffusion-3':
      if (process.env.STABILITY_API_KEY) {
        params.aspectRatio = data.aspectRatio;
        await stabilityAi.saveImage(params);
      }
      break;

    default:
      console.log('Invalid generateImage model', data.model);
      return;
  }

  if (fs.existsSync(imagePath)) {
    fs.writeFileSync(jsonPath, JSON.stringify(imageInfo, null, 2));
  
    sendToRenderer('showImage', data);
  }
}

async function search(data) {
  const jsons = await getSearchMatchingJsons(data.query);

  if (jsons.length >= 1) {
    const maxResults = 100;
    for (let i = 0; i < jsons.length && i < maxResults; i++) {
      sendToRenderer('showImage', jsons[i]);
    }
  }
  else {
    sendToRenderer('showNoSearchResultsFound');
  }
}

async function getSearchMatchingJsons(query) {
  const directoryPath = path.join(__dirname, imageFolder);
  query = query.toLowerCase();

  const files = await fs.promises.readdir(directoryPath);
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  const results = await Promise.all(jsonFiles.map(async (file) => {
    const filePath = path.join(directoryPath, file);
    const fileContents = await fs.promises.readFile(filePath, 'utf-8');
    const json = JSON.parse(fileContents);
    
    if (json.prompt && json.prompt.toLowerCase().includes(query)) {
      json.id = path.basename(file, '.json');
      return json;
    }
  }));

  return results.filter(Boolean);
}

async function requestApiKeysStatus() {
  console.log('requestApiKeysStatus');
  const data = {
    "dall-e-3": {exists: Boolean(process.env.OPENAI_API_KEY), name: "OPENAI_API_KEY"},
    "stabilitydiffusion-3": {exists: Boolean(process.env.STABILITY_API_KEY), name: "STABILITY_API_KEY"}
  };
  sendToRenderer('getApiKeysStatus', data);
}

async function setup() {
  console.clear();
  console.log(`-- Starting QuickImage --`);

  await app.whenReady();

  mainWindow = new BrowserWindow({
    frame: true,
    fullscreen: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.maximize();

  mainWindow.once('ready-to-show', async () => {
    if (envToBoolean(process.env.SHOW_DEV_TOOLS)) {
      await delay(0.25);
      mainWindow.webContents.openDevTools();
    }
  });

  app.on('window-all-closed', async () => {
    const macPlatform = 'darwin';
    if (process.platform !== macPlatform) {
      app.quit();
    }
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.on('submitPrompt', (event, data) => { generateImage(data); });
  ipcMain.on('search', (event, data) => { search(data); });
  ipcMain.on('requestApiKeysStatus', (event, data) => { requestApiKeysStatus(); });

  await mainWindow.loadFile('index.html'); 

  // mainWindow.on('close', () => { app.quit(); });
}

function sendToRenderer(type, data = undefined) {
  mainWindow.webContents.send(type, data);
}
