import { GoogleGenAI } from "@google/genai";
import { Adjustments, BoundingBox } from '../types';

export class GeminiQuotaError extends Error {
  constructor() {
    super("Cota da API Gemini excedida (429).");
    this.name = "GeminiQuotaError";
  }
}

const getAiClient = () => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found for Gemini");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper: Wait function
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Retry logic for 429 errors
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.code === 429 || (error?.message && error.message.includes('429')) || (error?.message && error.message.includes('Quota'));
    
    if (isRateLimit) {
        if (retries > 0) {
            console.warn(`Cota excedida (429). Tentando novamente em ${delay/1000}s...`);
            await wait(delay);
            return retryWithBackoff(fn, retries - 1, delay * 2);
        } else {
            throw new GeminiQuotaError();
        }
    }
    throw error;
  }
}

export const analyzeImageForEnhancement = async (base64Image: string): Promise<Partial<Adjustments>> => {
  const ai = getAiClient();
  if (!ai) return {};

  return retryWithBackoff(async () => {
    try {
      const modelId = 'gemini-2.5-flash-image';
      const prompt = `
        Analyze this image and suggest photo editing adjustments to improve its quality professionally.
        Return ONLY a valid JSON object. Do not use markdown formatting or backticks.
        The JSON object must contain these integer properties (scale where 100 is neutral/original):
        - brightness (range 50-150)
        - contrast (range 50-150)
        - saturation (range 50-150)
        - warmth (range 0-50, where 0 is neutral)
      `;

      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt }
          ]
        }
      });

      let text = response.text || "{}";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      let data;
      try {
          data = JSON.parse(text);
      } catch (e) {
          return {};
      }
      
      return {
        brightness: typeof data.brightness === 'number' ? data.brightness : 100,
        contrast: typeof data.contrast === 'number' ? data.contrast : 100,
        saturation: typeof data.saturation === 'number' ? data.saturation : 100,
        warmth: typeof data.warmth === 'number' ? data.warmth : 0,
      };

    } catch (error) {
      console.error("Gemini AI Error:", error);
      throw error; // Throw to trigger retry
    }
  });
};

export const removeBackgroundWithAI = async (base64Image: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) throw new Error("API Key missing");

  return retryWithBackoff(async () => {
    const modelId = 'gemini-2.5-flash-image';
    
    // Prompt altamente específico para gerar um PNG transparente (Alpha mask behavior simulation)
    const prompt = `
      Extract the main subject from this image and return it as a standalone PNG image with a transparent background (alpha channel). 
      Ensure precise edge detection. 
      Return ONLY the image.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt }
        ]
      }
    });

    // Check for image parts in the response
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data; // Return the base64 of the new image
        }
      }
    }
    
    // Se não retornou imagem, pode ter retornado texto explicando que não conseguiu
    const textOutput = candidates?.[0]?.content?.parts?.[0]?.text;
    console.warn("AI Text response instead of image:", textOutput);
    
    throw new Error("A IA não retornou uma imagem transparente válida. Tente uma imagem com o objeto mais definido.");
  });
};

export const detectPrivacyObjects = async (base64Image: string): Promise<BoundingBox[] | null> => {
  const ai = getAiClient();
  if (!ai) return [];

  try {
    return await retryWithBackoff(async () => {
        const modelId = 'gemini-2.5-flash-image';
        
        // PROMPT ULTRA-AGRESSIVO PARA PRIVACIDADE
        // Instruções para priorizar falsos positivos sobre falsos negativos
        const prompt = `
        Analyze this image for STRICT PRIVACY PROTECTION.
        Your task is to detect EVERY human face and vehicle license plate to apply redaction.
        
        DETECTION RULES:
        1. FACES: Detect all faces. Include frontal, side profile, looking down, partially covered, background faces, blurry faces, and reflections.
        2. PLATES: Detect all license plates on cars, motorcycles, trucks. Include angled, blurry, or distant plates.
        
        CRITICAL: Be extremely aggressive. If you are even 10% sure it might be a face or a plate, INCLUDE IT. It is better to blur too much than to miss a private detail.

        Return a JSON object with a key "boxes" containing an array of bounding boxes.
        Each box must be an array of 4 integers [ymin, xmin, ymax, xmax] scaled from 0 to 1000.
        Example: {"boxes": [[100, 200, 300, 400]]}
        If ABSOLUTELY nothing is found, return {"boxes": []}.
        Return ONLY valid JSON.
        `;

        const response = await ai.models.generateContent({
        model: modelId,
        contents: {
            parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt }
            ]
        }
        });

        let text = response.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(text);
        if (data.boxes && Array.isArray(data.boxes)) {
        return data.boxes.map((box: number[]) => ({
            ymin: box[0],
            xmin: box[1],
            ymax: box[2],
            xmax: box[3]
        }));
        }
        return [];
    });

  } catch (error) {
    if (error instanceof GeminiQuotaError || (error as any).name === 'GeminiQuotaError') {
        throw error;
    }
    console.error("Gemini Privacy Detection Error:", error);
    return null; 
  }
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};