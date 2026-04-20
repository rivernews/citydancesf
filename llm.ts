import { execPromise, _promisePool } from "./utilities";
import { type ImageModel } from "./models";
import { PARALLEL_ANALYZE_IMAGE } from "./consts";

export const getAnalyzeImageCommand = (image: ImageModel) => `
gemini -m flash-lite -p 'Extract text from image by URL at ${image.thumbnailImageUrl}. No filler words in your response, just answer the extracted text.' --output-format json --yolo | jq -r '.response'
`.trim();

export const fillByImageAnalysis = (images: ImageModel[]) => {
  return _promisePool<ImageModel>(
    images.map((image, index) => {
      return async () => {
        console.log(`Started asking gemini about class ${index+1}/${images.length}`)
        try {
          // Increase maxBuffer to avoid errors with large output (10MB here)
          const { stdout, stderr } = await execPromise(
            getAnalyzeImageCommand(image),
            { maxBuffer: 1024 * 1024 * 10 }
          );

          console.log(`--- Received class response ${index+1}/${images.length} ---`);
          image.thumbnailImageContent = (stdout as string || '').trim()

          // if (stderr) console.error('--- STDERR ---\n', stderr);
        } catch (error) {
          console.error('Error executing gemini:', error);
        }

        return image;
      }
    }),
    PARALLEL_ANALYZE_IMAGE
  )
}