// import { path } from './node_modules/path/path.js';
// import { fileURLToPath } from './node_modules/url/url.js';
import { ObjectId } from './node_modules/bson/lib/bson.mjs';

document.querySelector('#prompt-submit-button').addEventListener('click', () => { submitPrompt(); });
document.querySelector('#model').addEventListener('change', (event) => { modelChanged(event); });

document.querySelector('#search').addEventListener('search', () => { search(); });

window.electronAPI.receiveMessage('showImage', (data) => { showImage(data); });
window.electronAPI.receiveMessage('showNoSearchResultsFound', (data) => { showNoSearchResultsFound(data); });


function submitPrompt() {
  const id = new ObjectId().toString();
  const result = getCreateResultElement(id);
  result.classList.add('spinner');

  const data = {
    id: id,
    prompt: document.querySelector('#prompt').value,
    model: document.querySelector('#model').value
  };

  switch (data.model) {
    case 'dall-e-3':
      const widthAndHeight = document.querySelector('#size').value;
      data.widthAndHeight = widthAndHeight;
      data.style = document.querySelector('#style').value;
      data.quality = document.querySelector('#quality').value;
      break;
    case 'stabilitydiffusion-3':
      data.aspectRatio = document.querySelector('#aspect-ratio').value;
      break;
    default:
      console.log('Invalid submitPrompt model', model);
      return;
  }

  window.electronAPI.sendMessage('submitPrompt', data);
}

function getCreateResultElement(id) {
  let result = document.getElementById(id);
  if (!result) {
    const results = document.getElementById('image-results');
    
    result = document.createElement('div');
    result.id = id;
    result.classList.add('image-result');

    results.insertBefore(result, results.firstChild);
  }
  return result;  
}  

function modelChanged(event) {
  const model = event.target.value;
  const modelSettings = document.querySelector('.model-settings');
  for (const child of modelSettings.children) {
    child.style.display = child.id === `model-settings-${model}` ? 'block' : 'none';
  }
}

function showImage(data) {
  removeElement('search-results-spinner');
  const result = getCreateResultElement(data.id);
  result.classList.remove('spinner');
  
  // const __filename = fileURLToPath(import.meta.url);
  // const __dirname = path.dirname(__filename);

  // const imagePath = path.join(__dirname, `./images/${data.id}.png`);
  // const imagePathWithoutBackground = imagePath.replace('.png', '-background-removed.png');
  
  const imagePath = `images/${data.id}.png`;
  const imagePathWithoutBackground = imagePath.replace('.png', '-background-removed.png');

  const image = document.createElement('img');
  image.src = imagePath;
  result.appendChild(image);

  const prompt = document.createElement('div');
  prompt.classList.add('image-prompt');
  prompt.innerText = data.prompt;
  result.appendChild(prompt);

  const model = document.createElement('div');
  model.classList.add('image-model');
  model.innerText = getModelTitle(data.model);
  result.appendChild(model);

  const downloadButton = document.createElement('button');
  downloadButton.innerText = '💾';
  downloadButton.classList.add('download-button');
  result.appendChild(downloadButton);
  
  image.addEventListener('click', () => {
    image.src = image.src.includes('-background-removed.png') ?
      imagePath : imagePathWithoutBackground;
  });

  downloadButton.addEventListener('click', () => {
    downloadImage(image.src, getFileName(image.src));
  });
}

function showNoSearchResultsFound(data) {
  removeElement('search-results-spinner');
 
  const results = document.getElementById('image-results');
  const noResults = document.createElement('div');
  noResults.id = 'no-search-results-found';
  noResults.innerText = 'No results found...';
  results.appendChild(noResults);
}

function removeElement(id) {
  const element = document.getElementById(id);
  if (element) { element.remove(); }
}

function getFileName(imagePath) {
  const lastSlash = imagePath.lastIndexOf('/');
  const lastBackslash = imagePath.lastIndexOf('\\');
  const lastSeparator = Math.max(lastSlash, lastBackslash);
  return imagePath.substring(lastSeparator + 1);
}

function downloadImage(imagePath, fileName) {
  const link = document.createElement('a');
  link.href = imagePath;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getModelTitle(model) {
  const titles = {
    'dall-e-3': 'Dall-E 3',
    'stabilitydiffusion-3': 'Stability Diffusion 3'
  };
  return titles[model];
}

function search() {
  const query = document.getElementById('search').value;
  const results = document.getElementById('image-results');
  results.innerHTML = '';

  if (query) {
    const spinner = document.createElement('div');
    spinner.id = 'search-results-spinner';
    spinner.classList.add('spinner');
    results.appendChild(spinner);

    window.electronAPI.sendMessage('search', { query: query });
  }
}
