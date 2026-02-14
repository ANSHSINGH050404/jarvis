import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

console.log(`🧪 Testing Gemini API with Model: ${modelName}`);

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY missing");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

async function test() {
  try {
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    console.log("🤖 Response:", response.text());
    console.log("✅ API Key is working!");
  } catch (err: any) {
    console.error("❌ Gemini API Error:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

test();
