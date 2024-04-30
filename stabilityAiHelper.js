import fs from "node:fs";
import axios from "axios";
import FormData from "form-data";
import dotenv from 'dotenv';
import sharp from "sharp";
import { removeBackground } from '@imgly/background-removal-node';
import * as pathTools from "path";

dotenv.config();
const apiKey = process.env.STABILITY_KEY;

const statusComplete = 200;
const statusStillRunning = 202;

export async function saveImage({prompt = '', path = '', doRemoveBackground = false, doRemoveBackgroundInAddition = false, aspectRatio = '1:1', contextForErrorLogging = "Stability ImageToText"} = {}) {
  // API Reference: https://platform.stability.ai/docs/api-reference#tag/Generate/paths/~1v2beta~1stable-image~1generate~1sd3/post

  let success = false;

  const format = getExtensionWithoutDot(path);

  const formData = {
    prompt: prompt,
    output_format: format,
    aspect_ratio: aspectRatio
  };

  console.log(formData);
  
  let response;
  try {
    response = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/generate/sd3`,
      axios.toFormData(formData, new FormData()),
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "image/*"
        },
      },
    );
  }
  catch (error) {
    await logError(error, `${contextForErrorLogging}. Prompt: ${prompt}`);
  }

  if (response) {
    try {
      if (response.status === statusComplete) {
        let imageBuffer = Buffer.from(response.data);
        fs.writeFileSync(path, imageBuffer);

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
          const newImageBuffer = Buffer.from(await blob.arrayBuffer());
          fs.writeFileSync(removedBackgroundPath, newImageBuffer);
        }

        success = true;

      }
      else {
        console.log(`${contextForErrorLogging} issue, ${response.status}: ${response.data.toString()}`);
      }
    }
    catch (error) {
      await logError(error, contextForErrorLogging);
    }
  }

  return success;
}

export async function saveImageCore({prompt = '', path = '', style = '', doRemoveBackground = false, contextForErrorLogging = "StabilityCore ImageToText"} = {}) {
  // API Reference: https://platform.stability.ai/docs/api-reference#tag/Generate/paths/~1v2beta~1stable-image~1generate~1core/post

  let success = false;

  const format = getExtensionWithoutDot(path);

  const formData = {
    prompt: prompt,
    style_preset: style,
    output_format: format,
    // aspect_ratio: ratio,
    // seed: seed,
    // negative_prompt: negativePrompt,
  };
  
  let response;
  try {
    response = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/generate/core`,
      axios.toFormData(formData, new FormData()),
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: { 
          Authorization: `Bearer ${apiKey}`, 
          Accept: "image/*" 
        },
      },
    );
  }
  catch (error) {
    await logError(error, contextForErrorLogging);
  }

  if (response) {
    try {
      if (response.status === statusComplete) {
        let imageBuffer = Buffer.from(response.data);
        fs.writeFileSync(path, imageBuffer);

        if (doRemoveBackground) {
          const blob = await removeBackground(path);
          const newImageBuffer = Buffer.from(await blob.arrayBuffer());
          fs.writeFileSync(path, newImageBuffer);
        }

        success = true;

      }
      else {
        console.log(`${contextForErrorLogging} issue, ${response.status}: ${response.data.toString()}`);
      }
    }
    catch (error) {
      await logError(error, contextForErrorLogging);
    }
  }

  return success;
}

export async function getVideoFromImage({imageBuffer, contextForErrorLogging = "Stability ImageToVideo"} = {}) {
  // API Reference: https://platform.stability.ai/docs/api-reference#tag/Image-to-Video/paths/~1v2beta~1image-to-video/post
  // Stability's API is apparently broken, it never returns a video.

  const targetWidth = 1024;
  const targetHeight = 576;

  const resizedImageBuffer = await sharp(imageBuffer)
    .resize({ width: targetWidth })
    .extract({ width: targetWidth, height: targetHeight, left: 0, top: 0 })
    .toBuffer();

  const cfgScaleDefault = 1.8;
  const motionBucketIdDefault = 127;
    
  const data = new FormData();
  data.append("image", resizedImageBuffer, "image.png");
  data.append("seed", 0);
  data.append("cfg_scale", cfgScaleDefault);
  data.append("motion_bucket_id", motionBucketIdDefault);
  
  console.log("Sending image to video...");
  const response = await axios.request({
    url: `https://api.stability.ai/v2beta/image-to-video`,
    method: "post",
    validateStatus: undefined,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...data.getHeaders(),
    },
    data: data,
  });
  
  const generationId = response.data.id;
  console.log("generationID:", generationId);

  const responseVideo = await axios.request({
    url: `https://api.stability.ai/v2beta/image-to-video/result/${generationId}`,
    method: "GET",
    validateStatus: undefined,
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "video/*",
    },
  });
  
  let videoBuffer;
  const checkFrequencySeconds = 0.25;

  while (!videoBuffer) {
    await delay(checkFrequencySeconds);
    const currentTime = new Date().toLocaleTimeString();
    console.log("Checking for video...", currentTime, responseVideo.status);
    
    if (responseVideo.status === statusComplete) {
      videoBuffer = Buffer.from(responseVideo.data);
    }
    else if (responseVideo.status !== statusStillRunning)  {
      console.log(`${contextForErrorLogging} error ${responseVideo.status}: ${responseVideo.data.toString()}`);
      break;
    }
  }

  return videoBuffer;
}

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function getExtensionWithoutDot(path) {
  const extensionWithDot = pathTools.extname(path);
  return extensionWithDot.slice(1);
}

async function logError(error, contextForErrorLogging) {
  let errorMessage;
  const prefix = "stabilityAi issue:";
  if (error.response) {
    console.error(prefix, contextForErrorLogging, error.response.status, error.response.data);
    errorMessage = JSON.stringify(error.response.status) + " " + JSON.stringify(error.response.data);
  }
  else {
    console.error(prefix, contextForErrorLogging, error.message);
    errorMessage = JSON.stringify(error.message);
  }
}
