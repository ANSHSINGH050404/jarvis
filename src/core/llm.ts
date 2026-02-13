import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";

config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const getAiResponse = async (prompt: any) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Use the GA version
      contents: prompt,
    });

    return response.text; 
  } catch (error) {
    console.error("API Error:", error);
  }
};
