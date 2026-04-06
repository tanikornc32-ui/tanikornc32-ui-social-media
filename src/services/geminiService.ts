import { GoogleGenAI, Type } from "@google/genai";
import { SWOTAnalysis, TOWSMatrix, Metric } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeSentiment(text: string): Promise<"positive" | "neutral" | "negative"> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the sentiment of the following social media comment for Autobacs: "${text}". Return only one word: positive, neutral, or negative.`,
  });
  const sentiment = response.text?.toLowerCase().trim();
  if (sentiment === "positive" || sentiment === "neutral" || sentiment === "negative") {
    return sentiment;
  }
  return "neutral";
}

export async function generateStrategicAnalysis(metrics: Metric[]): Promise<{ swot: SWOTAnalysis; tows: TOWSMatrix }> {
  const metricsSummary = metrics.map(m => `${m.platform}: ${m.likes} likes, ${m.views} views, ${m.comments} comments, rating: ${m.rating}`).join('\n');

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Based on the following social media metrics for Autobacs branches, generate a SWOT analysis and a TOWS matrix for strategic decision making.
    
    Metrics Summary:
    ${metricsSummary}
    
    Return the result in JSON format with the following structure:
    {
      "swot": {
        "strengths": ["string"],
        "weaknesses": ["string"],
        "opportunities": ["string"],
        "threats": ["string"]
      },
      "tows": {
        "so": ["string"],
        "wo": ["string"],
        "st": ["string"],
        "wt": ["string"]
      }
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          swot: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              threats: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["strengths", "weaknesses", "opportunities", "threats"]
          },
          tows: {
            type: Type.OBJECT,
            properties: {
              so: { type: Type.ARRAY, items: { type: Type.STRING } },
              wo: { type: Type.ARRAY, items: { type: Type.STRING } },
              st: { type: Type.ARRAY, items: { type: Type.STRING } },
              wt: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["so", "wo", "st", "wt"]
          }
        },
        required: ["swot", "tows"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
