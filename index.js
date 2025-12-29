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

/* ================= IMAGE GENERATE ================= */
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required"
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
          size: "1024x1024"
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({
        success: false,
        error: data.error
      });
    }

    return res.json({
      success: true,
      image_url: data.data[0].url
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("Imagix AI server running on port " + PORT);
});