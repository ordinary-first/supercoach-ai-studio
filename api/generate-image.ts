import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

/** Compress base64 image to 400x400 JPEG ~30-50KB */
async function compressImage(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, 'base64');
  const compressed = await sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
  return `data:image/jpeg;base64,${compressed.toString('base64')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { prompt, profile, referenceImages, childTexts } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const personDesc = profile
      ? `${profile.name}, a ${profile.age}yo person in ${profile.location}`
      : 'A determined person';

    // Build context from child node texts for richer, more relevant images
    const childContext = Array.isArray(childTexts) && childTexts.length > 0
      ? ` This goal encompasses these sub-goals: ${childTexts.join(', ')}.`
      : '';

    if (referenceImages && referenceImages.length > 0) {
      // Visualization image with reference images
      const parts: any[] = [
        {
          text: `Photorealistic, cinematic image of ${personDesc} embodying: "${prompt}". Use the provided reference images as visual context (face likeness, objects, style). No text overlay. 8k resolution.`,
        },
      ];

      for (const base64Image of referenceImages) {
        const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          const compressed = await compressImage(part.inlineData.data);
          return res.status(200).json({ imageDataUrl: compressed });
        }
      }

      return res.status(200).json({ imageDataUrl: null });
    } else {
      // Simple goal image — include child context for more relevant imagery (Nano Banana Pro)
      const textPrompt = `Photorealistic, cinematic, high quality image of ${personDesc} embodying the success of: "${prompt}".${childContext} Focus on the emotional peak of achievement. No text overlay, no watermarks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: textPrompt }] },
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          const compressed = await compressImage(part.inlineData.data);
          return res.status(200).json({ imageDataUrl: compressed });
        }
      }

      return res.status(200).json({ imageDataUrl: null });
    }
  } catch (error: any) {
    console.error('Image Generation Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
