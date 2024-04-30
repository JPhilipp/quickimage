import fetch from 'node-fetch';
import fs from 'fs';
import sharp from 'sharp';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { removeIndents } from './common-libraries/strings.js';
import { removeBackground } from '@imgly/background-removal-node';

dotenv.config();

const openai = new OpenAI(process.env.OPENAI_API_KEY);
export const minutesTemporaryImageUrlIsValid = 60;
const defaultJsonSystemMessage = "You are a helpful assistant designed to output JSON.";
const tabReplacement = '  ';

export async function getTextJson({prompt = '', contextForErrorLogging = "ChatGPT", model = "gpt-4-turbo"} = {}) {
  // API Reference: https://platform.openai.com/docs/api-reference/chat/create
  
  prompt = removeIndents(prompt, tabReplacement);
  // console.log("Prompt before API call:", prompt);

  let response;
  try {
    response = await openai.chat.completions.create({
      messages: [
        { role: "system", content: defaultJsonSystemMessage },
        { role: "user", content: prompt }
      ],
      model: model,
      response_format: { "type": "json_object" },
      // max_tokens: 1000
    });
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
    return;
  }

  const data = response.choices[0].message.content;
  try {
    return JSON.parse(data);
  }
  catch (error) {
    console.error("Error parsing AI JSON", error, data);
  }
}

export async function getTextJsonWithImageAnalysis(prompt, base64JpegImage, contextForErrorLogging = "ChatGPT Vision") {
  // Reference: https://platform.openai.com/docs/guides/vision

  const model = "gpt-4-turbo";

  prompt = removeIndents(prompt, tabReplacement);
  // console.log("Prompt:", prompt);

  let response;
  try {
    response = await openai.chat.completions.create({
      messages: [
        { role: "system", content: defaultJsonSystemMessage },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                "url": `data:image/jpeg;base64,${base64JpegImage}`
              },
            },
          ],
        }
      ],
      model: model,
      response_format: { "type": "json_object" },
      // max_tokens: 1000
    });
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
    return;
  }

  const data = response.choices[0].message.content;
  try {
    return JSON.parse(data);
  }
  catch (error) {
    console.error("Error parsing AI JSON", error, data);
  }
}

export async function getImageURL({prompt = '', width = 1024, height = 1024, model = "dall-e-3", contextForErrorLogging = "Dall-E"} = {}) {
  // API Reference: https://platform.openai.com/docs/api-reference/images/create
  
  let imageUrl;

  let response;
  try {
    response = await openai.images.generate({
      model: model,
      prompt: prompt,
      size: `${width}x${height}`,
      style: "vivid",
      quality: "standard"
    });
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
    return;
  }

  try {
    imageUrl = response.data[0].url;
  }
  catch (error) {
    console.error("Error generating AI image", error);
  }

  return imageUrl;
}

export async function saveImage({prompt = '', path = '', doRemoveBackground = false, doRemoveBackgroundInAddition = false, width = 1024, height = 1024, saveAsJpg = false, saveAsJpgInAddition = false, contextForErrorLogging = "Dall-E", model = "dall-e-3", imageInfo = {revisedPrompt: null, temporaryLiveUrl: null}} = {}) {
  // API Reference: https://platform.openai.com/docs/api-reference/images/create
  
  let success;

  let response;
  try {
    response = await openai.images.generate({
      model: model,
      prompt: prompt,
      size: `${width}x${height}`,
      style: "vivid",
      quality: "standard"
    });
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
    return;
  }

  try {
    const imageUrl = response.data[0].url;
    imageInfo.temporaryLiveUrl = imageUrl;
    imageInfo.revisedPrompt = response.data[0].revised_prompt;
    
    if (saveAsJpg || saveAsJpgInAddition) {
      const jpegPath = path.replace('.png', '.jpg');
      await saveImageAsJpg(imageUrl, jpegPath);
    }

    if (!saveAsJpg) {
      const file = fs.createWriteStream(path);
      const imageResponse = await fetch(imageUrl);

      await new Promise((resolve, reject) => {
          imageResponse.body.pipe(file);
          imageResponse.body.on('error', reject);
          file.on('finish', resolve);
      });

      if (doRemoveBackground || doRemoveBackgroundInAddition) {
        const removedBackgroundPath = doRemoveBackgroundInAddition ?
          path.replace('.png', '-background-removed.png') : path;
        let removeBackgroundConfig = {
          debug: false,
          output: {
            format: 'image/png',
            quality: 1.0
          }
        };
        const blob = await removeBackground(path, removeBackgroundConfig);
        const buffer = Buffer.from(await blob.arrayBuffer());
        fs.writeFileSync(removedBackgroundPath, buffer);
      }
    }

    success = true;
  }
  catch (error) {
    console.error("Error saving AI image", error);
    success = false;
  }

  return success;
}

async function saveImageAsJpg(imageUrl, outputPath, quality = 90) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${imageUrl}: ${response.statusText}`);

    const buffer = await response.buffer();

    await sharp(buffer)
      .jpeg({
        quality: quality,
      })
      .toFile(outputPath);

  } catch (error) {
    console.error("Error saving image as JPG", error);
  }
}

export async function getSpeech({ text = "", contextForErrorLogging = "Text-to-Speech getSpeech", speed = 1.0, model = "tts-1", voice = "echo", responseFormat = 'mp3' } = {}) {
  // API Reference: https://platform.openai.com/docs/api-reference/audio
  // Voices: https://platform.openai.com/docs/guides/text-to-speech/voice-options

  text = text.trim().replace(/\s\s+/g, ' ');

  let audio;
  try {
    audio = await openai.audio.speech.create({
      model: model,
      voice: voice,
      input: text,
      speed: speed,
      response_format: responseFormat
    });
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
    return false;
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  return buffer;
}

export async function getAudioTranscript(audioPath, language = "en", contextForErrorLogging = "Whisper Transcript") {
  // API Reference: https://platform.openai.com/docs/guides/speech-to-text/quickstart

  const model = "whisper-1";

  let response;
  try {
    response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: model,
      language: language,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"]
    });
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
    return;
  }

  return response;
}

async function logError(error, contextForErrorLogging) {
  let errorMessage;
  const prefix = "ai logError:";
  if (error.response) {
    console.error(prefix, contextForErrorLogging, error.response.status, error.response.data);
    errorMessage = JSON.stringify(error.response.status) + " " + JSON.stringify(error.response.data);
  }
  else {
    console.error(prefix, contextForErrorLogging, error.message);
    errorMessage = JSON.stringify(error.message);
  }
}
