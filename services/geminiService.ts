
import { GoogleGenAI, Type } from "@google/genai";
import { GameTheme } from "../types";

export async function generateNewTheme(score: number): Promise<GameTheme> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a prehistoric environmental theme for a game called 'T Rex Kecepirit' with current score ${score}. Create a unique and funny atmosphere based on IT or prehistoric seasons.`,
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
            themeName: { type: Type.STRING, description: "A creative theme name" }
          },
          required: ["sky", "ground", "dino", "cactus", "particle", "themeName"],
        },
      },
    });

    if (response && response.text) {
      const cleanedText = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanedText);
    }
    throw new Error("Empty AI response");
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
