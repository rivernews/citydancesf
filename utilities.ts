import { Buffer } from 'node:buffer';
import { exec } from "child_process";
import { promisify } from 'util';
// Promisify the exec function
export const execPromise = promisify(exec);

import sharp from 'sharp';

import { ImageModel } from "./models";

export const fetchImageAsBase64 = async (url: string) => {
  const urlObject = new URL(url)
  urlObject.search = '';
  urlObject.hash = '';
  const response = await fetch(urlObject.toString());
  let buffer: Buffer<any> = Buffer.from(await response.arrayBuffer());
  
  const contentType = response.headers.get('content-type');
  // check if needs conversion
  if (!contentType?.includes('jpg') && !contentType?.includes('jpeg')) {
    buffer = await sharp(buffer)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toBuffer()
  }

  let base64String = buffer.toString('base64');

  // Qwen accepted image format
  // https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-guide
  return `data:image/jpeg;base64,${base64String}`
}

export async function _promisePool<T>(
  tasks: (() => Promise<T>)[], 
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();

  for (const [index, task] of tasks.entries()) {
    // Wrap task to store result and remove itself from active set upon completion
    const p = task().then((res) => {
      results[index] = res;
      executing.delete(p);
    });
    
    executing.add(p);

    // If limit is reached, wait for at least one task to finish before starting next
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining active tasks to finish
  await Promise.all(executing);
  return results;
}

export const fillImageBase64 = async (images: ImageModel[]) => {
  return await Promise.all(
      images.map(async (image) => {
      image.thumbnailImageBase64String = await fetchImageAsBase64(image.thumbnailImageUrl);
      image.thumbnailImageUrl = '';
      delete image.link;
      return image;
    })
  )
}