
import { GoogleGenAI, Type } from "@google/genai";
import { GameTheme } from "../types";

export async function generateNewTheme(score: number): Promise<GameTheme> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player reached a score of ${score} in 'T Rex Kecepirit' (a funny dinosaur running game). Generate a prehistoric environmental theme that reflects a specific season (Spring, Summer, Autumn, Winter) or weather condition (Stormy, Sunny, Misty, Aurora). The T-Rex is distressed, so colors should be vibrant.`,
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
            themeName: { type: Type.STRING, description: "A funny environmental name, e.g., 'Winter in IT Department' or 'Thunderstorm SQL'" }
          },
          required: ["sky", "ground", "dino", "cactus", "particle", "themeName"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating theme:", error);
    return {
      sky: "#e0f2f1",
      ground: "#4e342e",
      dino: "#2e7d32",
      cactus: "#1b5e20",
      particle: "#795548",
      themeName: "Jurassic Default"
    };
  }
}
