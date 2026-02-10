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
    const { prompt, profile } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const videoPrompt = `Cinematic movie scene of ${profile?.name || 'A person'} achieving: ${prompt}. High quality, photorealistic, 4k.`;

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: videoPrompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9',
      },
    });

    // Poll until done, with a 55s timeout (Vercel limit is 60s for serverless functions)
    const startTime = Date.now();
    const TIMEOUT_MS = 55000;

    while (!operation.done) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        return res.status(504).json({
          error: 'Video generation timed out. Please try again.',
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink =
      operation.response?.generatedVideos?.[0]?.video?.uri;

    if (!downloadLink) {
      return res.status(200).json({ videoUrl: null });
    }

    // Fetch the video server-side with the API key so the key is never exposed to the client.
    // Then return the video as a proxied base64 data URL, or stream it.
    // For simplicity and to avoid Vercel response size limits, we return a proxied URL
    // that the client can use. Since we can't persist a signed URL easily,
    // we fetch the video bytes and return them as base64.
    try {
      const separator = downloadLink.includes('?') ? '&' : '?';
      const authenticatedUrl = `${downloadLink}${separator}key=${apiKey}`;
      const videoResponse = await fetch(authenticatedUrl);

      if (!videoResponse.ok) {
        return res.status(200).json({ videoUrl: null });
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const base64Video = Buffer.from(videoBuffer).toString('base64');
      const contentType =
        videoResponse.headers.get('content-type') || 'video/mp4';

      return res.status(200).json({
        videoUrl: `data:${contentType};base64,${base64Video}`,
      });
    } catch (fetchError) {
      console.error('Video download error:', fetchError);
      return res.status(200).json({ videoUrl: null });
    }
  } catch (error: any) {
    console.error('Video Generation Error:', error);
    return res.status(200).json({ videoUrl: null });
  }
}
