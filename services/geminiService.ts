
import { GoogleGenAI, Type } from "@google/genai";
import { GameTheme } from "../types";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isQuotaError = err.message?.includes('429') || err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function generateNewTheme(score: number): Promise<GameTheme> {
  try {
    return await withRetry(async () => {
      // Create a new instance right before the call to ensure the latest API key is used
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: `Generate a prehistoric environmental theme for a game called 'T Rex Kecepirit' with current score ${score}. Create a unique and funny atmosphere based on IT or prehistoric seasons. Return JSON only.` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sky: { type: Type.STRING, description: "Hex color for the sky/background" },
              ground: { type: Type.STRING, description: "Hex color for the ground" },
              dino: { type: Type.STRING, description: "Hex color for the T-Rex body" },
              cactus: { type: Type.STRING, description: "Hex color for the obstacles/cacti" },
              particle: { type: Type.STRING, description: "Hex color for the dust trail" },
              themeName: { type: Type.STRING, description: "A short creative theme name" }
            },
            required: ["sky", "ground", "dino", "cactus", "particle", "themeName"],
          },
        },
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
      throw new Error("Empty AI response");
    });
  } catch (error) {
    console.error("Theme AI Error:", error);
    return {
      sky: "#f8fafc",
      ground: "#475569",
      dino: "#166534",
      cactus: "#064e3b",
      particle: "#b45309",
      themeName: "Jurassic Default"
    };
  }
}
