import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
    const { prompt, profile, referenceImages } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const personDesc = profile
      ? `${profile.name}, a ${profile.age}yo person in ${profile.location}`
      : 'A determined person';

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
        model: 'gemini-2.5-flash-image',
        contents: { parts },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return res.status(200).json({
            imageDataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          });
        }
      }

      return res.status(200).json({ imageDataUrl: null });
    } else {
      // Simple goal image
      const textPrompt = `Photorealistic, cinematic, high quality image of ${personDesc} embodying the success of: "${prompt}". Focus on the emotional peak of achievement. No text. 8k resolution.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: textPrompt }] },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return res.status(200).json({
            imageDataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          });
        }
      }

      return res.status(200).json({ imageDataUrl: null });
    }
  } catch (error: any) {
    console.error('Image Generation Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
