import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize GoogleGenAI SDK server-side
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Voice & Text NLP Parser API endpoint using Gemini Structured Outputs
  app.post("/api/parse-voice", async (req, res) => {
    try {
      const { transcript, currentDate } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const prompt = `You are a productivity AI assistant for Dímelo.
Analyze the user spoken request and extract task/calendar details.
Current date/time context: ${currentDate || new Date().toISOString()}.
Extract:
- title: string (concise task title)
- date: string (YYYY-MM-DD format for when the task is scheduled)
- startTime: string (HH:MM in 24-hour format, e.g., "13:00". Default to "09:00" if unspecified)
- durationMinutes: number (estimated duration in minutes, default 60)
- reminderMinutes: number (minutes before start to remind, e.g. 15, default 15)
- priority: string ("low" | "medium" | "high" | "urgent")
- category: string ("Work" | "Personal" | "Study" | "Health" | "Finance")
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `${prompt}\nUser request: "${transcript}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Task title" },
              date: { type: Type.STRING, description: "YYYY-MM-DD date" },
              startTime: { type: Type.STRING, description: "HH:MM 24hr start time" },
              durationMinutes: { type: Type.NUMBER, description: "Duration in minutes" },
              reminderMinutes: { type: Type.NUMBER, description: "Minutes before start for reminder" },
              priority: { type: Type.STRING, description: "low, medium, high, or urgent" },
              category: { type: Type.STRING, description: "Work, Personal, Study, Health, or Finance" },
            },
            required: ["title", "date", "startTime", "durationMinutes", "reminderMinutes", "priority", "category"],
          },
        },
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini parse-voice error:", error);
      res.status(500).json({ error: error.message || "Failed to parse voice command with AI" });
    }
  });

  // Audio Recording Parser API endpoint using Gemini Multimodal Audio
  app.post("/api/parse-audio", async (req, res) => {
    try {
      const { audioBase64, mimeType, currentDate } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      const prompt = `You are a productivity AI assistant for Dímelo.
Listen to this audio recording in Spanish, transcribe the user request, and extract task/calendar details.
Current date/time context: ${currentDate || new Date().toISOString()}.
Extract:
- title: string (concise task title in Spanish)
- date: string (YYYY-MM-DD format for when the task is scheduled)
- startTime: string (HH:MM in 24-hour format, e.g., "13:00". Default to "09:00" if unspecified)
- durationMinutes: number (estimated duration in minutes, default 60)
- reminderMinutes: number (minutes before start to remind, default 30)
- priority: string ("low" | "medium" | "high" | "urgent")
- category: string ("Trabajo" | "Personal" | "Estudio" | "Salud" | "Finanzas")
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/webm",
              data: audioBase64
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Task title" },
              date: { type: Type.STRING, description: "YYYY-MM-DD date" },
              startTime: { type: Type.STRING, description: "HH:MM 24hr start time" },
              durationMinutes: { type: Type.NUMBER, description: "Duration in minutes" },
              reminderMinutes: { type: Type.NUMBER, description: "Minutes before start for reminder" },
              priority: { type: Type.STRING, description: "low, medium, high, or urgent" },
              category: { type: Type.STRING, description: "Trabajo, Personal, Estudio, Salud, or Finanzas" },
            },
            required: ["title", "date", "startTime", "durationMinutes", "reminderMinutes", "priority", "category"],
          },
        },
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini parse-audio error:", error);
      res.status(500).json({ error: error.message || "Failed to parse audio with AI" });
    }
  });

  // Image Parser API endpoint using Gemini Multimodal Vision
  app.post("/api/parse-image", async (req, res) => {
    try {
      const { imageBase64, mimeType, currentDate } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const prompt = `You are a productivity AI assistant for Dímelo.
Analyze this image (which could be a calendar, schedule, assignment list, meeting notes, syllabus, etc.) in Spanish.
Extract all tasks, assignments, events, or deadlines found in the image.
Current date/time context: ${currentDate || new Date().toISOString()}.
Return a JSON object with an array of tasks under property "tasks", where each task has:
- title: string (concise task title in Spanish)
- date: string (YYYY-MM-DD format)
- startTime: string (HH:MM in 24hr format, default "09:00")
- durationMinutes: number (default 60)
- reminderMinutes: number (default 30)
- priority: string ("low" | "medium" | "high" | "urgent")
- category: string ("Trabajo" | "Personal" | "Estudio" | "Salud" | "Finanzas")
- description: string (details or source context from image)
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: imageBase64
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    date: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    durationMinutes: { type: Type.NUMBER },
                    reminderMinutes: { type: Type.NUMBER },
                    priority: { type: Type.STRING },
                    category: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["title", "date", "startTime", "durationMinutes", "priority", "category"]
                }
              }
            },
            required: ["tasks"]
          }
        },
      });

      const jsonText = response.text || '{"tasks":[]}';
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini parse-image error:", error);
      res.status(500).json({ error: error.message || "Failed to parse image with AI" });
    }
  });

  // Mock / Integration Sync endpoints
  app.post("/api/sync/google", async (req, res) => {
    const { action, eventData } = req.body;
    // Simulate bidirectional sync with Google Calendar API
    setTimeout(() => {
      res.json({ success: true, message: `Synced with Google Calendar successfully (${action || 'upsert'})`, syncId: 'gcal_' + Date.now(), data: eventData });
    }, 500);
  });

  app.post("/api/sync/notion", async (req, res) => {
    const { action, taskData } = req.body;
    // Simulate synchronization with Notion databases
    setTimeout(() => {
      res.json({ success: true, message: `Synced with Notion database successfully (${action || 'update'})`, pageId: 'notion_' + Date.now(), data: taskData });
    }, 500);
  });

  // Vite middleware for frontend development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Dímelo server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
