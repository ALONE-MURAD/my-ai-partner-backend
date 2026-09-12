import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "My AI Partner Backend is running ❤️"
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, partner = "AI Partner" } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(GEMINI_API_KEY),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  `You are ${partner}, a friendly AI partner. ` +
                  `Reply naturally, warmly and concisely. ` +
                  `The user may speak Bangla or English. ` +
                  `Reply in the language the user uses.`
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(500).json({
        success: false,
        error: data?.error?.message || "Gemini API error"
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!reply) {
      return res.status(500).json({
        success: false,
        error: "Empty Gemini response"
      });
    }

    res.json({
      success: true,
      reply: reply
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
