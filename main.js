import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ai from './openAiHelper.js';
import * as stabilityAi from './stabilityAiHelper.js';
import { createFolderIfNeeded } from './common-libraries/fileSystem.js';
import { getFormattedTime, envToBoolean, delay } from './common-libraries/shared.js';
import { toFileName, shortenString } from './common-libraries/strings.js';
import dotenv from 'dotenv';
dotenv.config();

let mainWindow;

setup();

async function generateImage(data) {
  const imagePath = `images/${data.id}.png`;
  const jsonPath  = `images/${data.id}.json`;

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

  if (data.widthAndHeight) {
    const [width, height] = data.widthAndHeight.split('x');
    params.width  = parseInt(width);
    params.height = parseInt(height);
  }
  else if (data.aspectRatio) {
    params.aspectRatio = data.aspectRatio;
  }

  console.log(`Generating ${data.model} image: ${data.prompt}`);

  switch (data.model) {
    case 'dall-e-3':
      await ai.saveImage(params);
      break;
    case 'stabilitydiffusion-3':
      await stabilityAi.saveImage(params);
      break;
    default:
      console.log('Invalid generateImage model', data.model);
      return;
  }

  fs.writeFileSync(jsonPath, JSON.stringify(imageInfo, null, 2));
  
  sendToRenderer('showImage', data);
}

async function setup(fullscreen = true) {
  console.clear();
  console.log(`-- Starting QuickImage --`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

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

  await mainWindow.loadFile('index.html'); 

  // mainWindow.on('close', () => { app.quit(); });
}

function sendToRenderer(type, data = undefined) {
  mainWindow.webContents.send(type, data);
}
