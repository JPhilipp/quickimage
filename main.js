import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ai from './openAiHelper.js';
import * as stabilityAi from './stabilityAiHelper.js';
import { createFolderIfNeeded } from './common-libraries/fileSystem.js';
import { envToBoolean, delay } from './common-libraries/shared.js';
import isDevEnvironment from 'electron-is-dev';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

setup();

async function generateImage(data) {
  const imagePath = `${getImagesPath()}/${data.id}.png`;
  data.imagePath = imagePath;

  let imageInfo = {
    model: data.model,
    prompt: data.prompt,
    error: null
  };

  const backgroundRemovalSupported = isDevEnvironment;

  let params = {
    prompt: data.prompt,
    path: imagePath,
    doRemoveBackgroundInAddition: backgroundRemovalSupported,
    imageInfo: imageInfo
  };

  console.log(`Generating ${data.model} image: ${data.prompt}`);
  switch (data.model) {
    case 'dall-e-3':
      const [width, height] = data.widthAndHeight.split('x');
      params.width  = parseInt(width);
      params.height = parseInt(height);
      params.style = data.style;
      params.quality = data.quality;
      imageInfo.style = data.style;
      imageInfo.quality = data.quality;
      await ai.saveImage(params);
      break;

    case 'stabilitydiffusion-3':
      params.aspectRatio = data.aspectRatio;
      await stabilityAi.saveImage(params);
      break;

    default:
      console.log('Invalid generateImage model', data.model);
      return;
  }

  if (imageInfo.error) {
    let error = String(imageInfo.error);
    const prefix = 'Error: ';
    if (!error.startsWith(prefix)) { error = prefix + error; }
    data.error = error;

    sendToRenderer('showImageError', data);
  }
  else {
    const jsonPath = imagePath.replace('.png', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(imageInfo, null, 2));
    data.backgroundRemovalSupported = backgroundRemovalSupported;
    sendToRenderer('showImage', data);
  }
}

async function rendererRequestsNewestImages() {
  const max = 50;
  const jsons = await getNewestJsons(max);

  for (let i = 0; i < jsons.length; i++) {
    sendToRenderer('showImage', jsons[i]);
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

async function getNewestJsons(max) {
  const imagesPath = getImagesPath();
  const files = await fs.promises.readdir(imagesPath);
  const jsonFiles = files.filter(file => file.endsWith('.json')).sort().reverse();
  let limitedFiles = jsonFiles.slice(0, max);
  limitedFiles = limitedFiles.reverse();
  
  const results = await Promise.all(limitedFiles.map(async (file) => {
    const filePath = `${imagesPath}/${file}`;
    const fileContents = await fs.promises.readFile(filePath, 'utf-8');
    const json = JSON.parse(fileContents);
    
    json.id = path.basename(file, '.json');
    json.imagePath = `${getImagesPath()}/${json.id}.png`;
    if (!fs.existsSync(json.imagePath)) { return; }
    json.backgroundRemovalSupported = isDevEnvironment;

    return json;
  }));

  return results.filter(Boolean);
}

async function getSearchMatchingJsons(query) {
  query = query.toLowerCase();

  const imagesPath = getImagesPath();
  const files = await fs.promises.readdir(imagesPath);
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  const results = await Promise.all(jsonFiles.map(async (file) => {
    const filePath = `${imagesPath}/${file}`;
    const fileContents = await fs.promises.readFile(filePath, 'utf-8');
    const json = JSON.parse(fileContents);
    
    if (json.prompt && json.prompt.toLowerCase().includes(query)) {
      json.id = path.basename(file, '.json');
      json.imagePath = `${getImagesPath()}/${json.id}.png`;
      if (!fs.existsSync(json.imagePath)) { return; }
      json.backgroundRemovalSupported = isDevEnvironment;
      return json;
    }
  }));

  return results.filter(Boolean);
}

function getImagesPath() {
  return app.isPackaged ? `${process.resourcesPath}/../images` : 'images';
}

async function rendererRequestsApiKeysStatus() {
  const data = {
    "stabilitydiffusion-3": {
      exists: Boolean(process.env.STABILITY_API_KEY),
      name: "STABILITY_API_KEY",
      url: 'https://platform.openai.com/api-keys'
    },
    "dall-e-3": {
      exists: Boolean(process.env.OPENAI_API_KEY),
      name: "OPENAI_API_KEY",
      url: 'https://platform.stability.ai/account/keys'
    }
  };
  sendToRenderer('getApiKeysStatus', data);

  // sendPathsDebugInfo();
}

function sendPathsDebugInfo() {
  const pathsData = {
    userDataPath: app.getPath('userData'),
    imagesPath: getImagesPath(),
    resourcesPath: process.resourcesPath,
    tempPath: app.getPath('temp'),
    filename: __filename,
    dirname: __dirname
  };
  sendToRenderer('showDebugInfo', pathsData);
}

async function setup() {
  console.clear();
  console.log(`-- Starting QuickImage (isDevEnvironment: ${isDevEnvironment}) --`);

  createFolderIfNeeded(getImagesPath());

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

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
  ipcMain.on('requestApiKeysStatus', (event, data) => { rendererRequestsApiKeysStatus(); });
  ipcMain.on('requestNewestImages', (event, data) => { rendererRequestsNewestImages(); });
  
  await mainWindow.loadFile('index.html'); 

  // mainWindow.on('close', () => { app.quit(); });
}

function sendToRenderer(type, data = undefined) {
  mainWindow.webContents.send(type, data);
}
