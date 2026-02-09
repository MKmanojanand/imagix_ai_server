import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY;

async function logToFirebase(path, data) {
  if (!FIREBASE_DB_URL) return;
  try {
    await fetch(FIREBASE_DB_URL + path + ".json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch {}
}

app.get("/", (req, res) => {
  res.send("Imagix AI Server Running ✅");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    openai: !!OPENAI_API_KEY,
    pollinations: !!POLLINATIONS_KEY,
    firebase: !!FIREBASE_DB_URL
  });
});

app.post("/text", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    const prompt = req.body.prompt;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt missing" });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }]
        })
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(500).json(data);

    await logToFirebase("/admin/usage/text", {
      time: Date.now(),
      chars: prompt.length
    });

    res.json({
      success: true,
      reply: data.choices[0].message.content
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/image", async (req, res) => {
  try {
    const { prompt, style, input_image_base64, mode } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt missing" });
    }

    if (mode === "free") {

      const encoded = encodeURIComponent(prompt);
      const url =
        https://image.pollinations.ai/prompt/${encoded} +
        ?nologo=true&nofeed=true&seed=${Date.now()};

      const response = await fetch(url, {
        headers: POLLINATIONS_KEY
          ? { Authorization: Bearer ${POLLINATIONS_KEY} }
          : {}
      });

      if (!response.ok) {
        return res.status(500).json({ error: "Pollinations failed" });
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      await logToFirebase("/admin/usage/free_generate", {
        time: Date.now()
      });

      return res.json({
        success: true,
        mode: "free",
        image_base64: base64
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    const finalStyle = style && style.trim() ? style : "Realistic";
    const finalPrompt = prompt + "\nStyle: " + finalStyle;

    if (!input_image_base64) {

      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + OPENAI_API_KEY
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: finalPrompt,
            size: "1024x1024",
            quality: "low",
            n: 1
          })
        }
      );

      const data = await response.json();
      if (!response.ok) return res.status(500).json(data);

      await logToFirebase("/admin/usage/image_generate", {
        time: Date.now()
      });

      return res.json({
        success: true,
        mode: "generate",
        image_base64: data.data[0].b64_json
      });
    }

    let clean = input_image_base64;
    if (clean.startsWith("data:image")) {
      clean = clean.split(",")[1];
    }

    const imageBuffer = Buffer.from(clean, "base64");

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", finalPrompt);
    form.append("size", "1024x1024");
    form.append("image", imageBuffer, {
      filename: "input.png",
      contentType: "image/png"
    });

    const response = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + OPENAI_API_KEY,
          ...form.getHeaders()
        },
        body: form
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(500).json(data);

    await logToFirebase("/admin/usage/image_edit", {
      time: Date.now()
    });

    return res.json({
      success: true,
      mode: "edit",
      image_base64: data.data[0].b64_json
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Imagix AI server running on port", PORT);
});