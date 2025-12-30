import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ================= ROOT CHECK ================= */
app.get("/", (req, res) => {
  res.send("Imagix AI Server Running ✅");
});

/* ================= TEXT MODEL ================= */
app.post("/text", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.json({
        success: false,
        message: "Prompt missing"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.json({ success: false, error: data.error });
    }

    res.json({
      success: true,
      reply: data.choices[0].message.content
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* ================= IMAGE MODEL (1024x1024 • LOW • STABLE) ================= */
app.post("/image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.json({
        success: false,
        message: "Prompt missing"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: prompt,
          size: "1024x1024",   // ✅ STABLE SIZE
          quality: "low",      // ✅ LOW COST
          n: 1                 // ✅ SINGLE IMAGE
        })
      }
    );

    const data = await response.json();

    // Safety checks
    if (data.error) {
      return res.json({ success: false, error: data.error });
    }

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      return res.json({
        success: false,
        error: "No image returned",
        raw: data
      });
    }

    res.json({
      success: true,
      image_base64: data.data[0].b64_json
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("Imagix AI server running on port " + PORT);
});