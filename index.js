import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Imagix AI Server Running");
});

app.post("/generate", async (req, res) => {
  try {
    const { prompt, size } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: Bearer ${process.env.OPENAI_API_KEY},
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: prompt,
          size: size || "1024x1024",
        }),
      }
    );

    const data = await response.json();

    if (!data.data) {
      return res.status(500).json(data);
    }

    res.json({
      success: true,
      image_url: data.data[0].url,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Imagix AI server running on port", PORT);
});