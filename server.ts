import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Configuración de rutas para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Aumentamos límites para recibir audio o imágenes base64 sin error 413
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Inicializar SDK de Google GenAI con API Key del entorno
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'dimelo-backend',
      },
    },
  });

  // Endpoint de NLP por texto/voz usando Gemini Structured Outputs para soportar múltiples tareas
  app.post("/api/parse-voice", async (req, res) => {
    try {
      const { transcript, currentDate } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "Falta el texto de la instrucción" });
      }

      const prompt = `Eres el asistente de productividad de Dímelo.
Analiza la solicitud y extrae UNA o VARIAS tareas o eventos mencionados en el texto.
Fecha actual: ${currentDate || new Date().toISOString()}.
Devuelve un objeto JSON con un array 'tasks' donde cada elemento tenga:
- title: string (título conciso de la tarea)
- date: string (YYYY-MM-DD)
- startTime: string (HH:MM formato 24h, ej. "09:00")
- durationMinutes: number (duración estimada, por defecto 60)
- reminderMinutes: number (minutos antes para recordar, por defecto 30)
- priority: string ("low" | "medium" | "high" | "urgent")
- category: string ("Trabajo" | "Personal" | "Estudio" | "Salud" | "Finanzas")
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `${prompt}\nSolicitud del usuario: "${transcript}"`,
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
                  },
                  required: ["title", "date", "startTime", "durationMinutes", "reminderMinutes", "priority", "category"],
                }
              }
            },
            required: ["tasks"],
          },
        },
      });

      const jsonText = response.text || '{"tasks":[]}';
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Error procesando voz en backend:", error);
      res.status(500).json({ error: error.message || "Error al procesar instrucción" });
    }
  });

  // Endpoint para procesar notas de audio con Gemini Multimodal
  app.post("/api/parse-audio", async (req, res) => {
    try {
      const { audioBase64, mimeType, currentDate } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Faltan datos de audio" });
      }

      const prompt = `Escucha este audio en español, transcríbelo y extrae los datos de la tarea para Dímelo.
Fecha actual: ${currentDate || new Date().toISOString()}.
Extrae: title, date, startTime, durationMinutes, reminderMinutes, priority, category.
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
              title: { type: Type.STRING },
              date: { type: Type.STRING },
              startTime: { type: Type.STRING },
              durationMinutes: { type: Type.NUMBER },
              reminderMinutes: { type: Type.NUMBER },
              priority: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["title", "date", "startTime", "durationMinutes", "reminderMinutes", "priority", "category"],
          },
        },
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Error procesando audio con IA:", error);
      res.status(500).json({ error: error.message || "Error al procesar audio" });
    }
  });

  // Endpoint para análisis visual de calendarios / imágenes (OCR inteligente)
  app.post("/api/parse-image", async (req, res) => {
    try {
      const { imageBase64, mimeType, currentDate } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Faltan datos de imagen" });
      }

      const prompt = `Analiza esta imagen (calendario, horario, asignaciones o apuntes) y extrae todas las tareas encontradas.
Fecha actual: ${currentDate || new Date().toISOString()}.
Devuelve un objeto JSON con un array 'tasks' donde cada tarea tenga: title, date, startTime, durationMinutes, priority, category, description.
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
      console.error("Error analizando imagen:", error);
      res.status(500).json({ error: error.message || "Error al analizar imagen" });
    }
  });

  // Endpoints mock para sincronización con integraciones externas
  app.post("/api/sync/google", async (req, res) => {
    const { action, eventData } = req.body;
    setTimeout(() => {
      res.json({ success: true, message: `Sincronizado con Google Calendar (${action || 'upsert'})`, syncId: 'gcal_' + Date.now(), data: eventData });
    }, 300);
  });

  app.post("/api/sync/notion", async (req, res) => {
    const { action, taskData } = req.body;
    setTimeout(() => {
      res.json({ success: true, message: `Sincronizado con Notion (${action || 'update'})`, pageId: 'notion_' + Date.now(), data: taskData });
    }, 300);
  });

  // Integración de middlewares de Vite en entorno de desarrollo
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[Dímelo] Servidor corriendo en http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Fallo al iniciar el servidor:", err);
});
