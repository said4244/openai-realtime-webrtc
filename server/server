import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Route to generate ephemeral token for OpenAI Realtime
app.get("/session", async (req, res) => {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview-2024-12-17",
        voice: "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
        instructions: "أنت مُعلّم لغة عربية مُساعد، ذكي، وودود. تصرّف كإنسان. يجب أن يكون صوتك وشخصيتك ودودين وجذابين، بنبرة حيوية وجادة. تحدّث بسرعة. تحدّث باللغة العربية فقط، وخاصةً باللهجة الفلسطينية."
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      return res.status(response.status).json(errorData);
    }
    
    const data = await response.json();
    
    // Send back the JSON we received from the OpenAI REST API
    res.send(data);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Failed to generate ephemeral token" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
