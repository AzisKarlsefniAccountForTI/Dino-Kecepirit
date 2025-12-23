import { GoogleGenAI, Type } from "@google/genai";
import { GameTheme } from "../types";

export async function generateNewTheme(score: number): Promise<GameTheme> {
  try {
    // Selalu inisialisasi instance baru dengan literal process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player reached a score of ${score} in 'T Rex Kecepirit' (a funny dinosaur running game). Generate a prehistoric environmental theme that reflects a specific season or weather condition. The T-Rex is distressed, so colors should be vibrant.`,
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
            themeName: { type: Type.STRING, description: "A funny environmental name" }
          },
          required: ["sky", "ground", "dino", "cactus", "particle", "themeName"],
        },
      },
    });

    if (response && response.text) {
      return JSON.parse(response.text.trim());
    }
    throw new Error("Empty AI response");
  } catch (error) {
    console.error("Error generating theme:", error);
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