import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

/* ================= FIREBASE LOGGER ================= */

async function logToFirebase(path, data) {
  if (!FIREBASE_DB_URL) return;

  try {
    await fetch(
      FIREBASE_DB_URL + path + ".json",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }
    );
  } catch (e) {
    console.log("Firebase log failed");
  }
}

/* ================= BASIC ROUTES ================= */

app.get("/", (req, res) => {
  res.send("Imagix AI Server Running ✅");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    port: PORT,
    hasKey: !!OPENAI_API_KEY,
    hasFirebase: !!FIREBASE_DB_URL
  });
});

/* ================= TEXT API ================= */

app.post("/text", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "OPENAI_API_KEY missing"
      });
    }

    const prompt = req.body.prompt;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
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

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: "OpenAI error",
        raw: data
      });
    }

    // 🔥 Firebase log
    await logToFirebase("/admin/usage/text", {
      time: Date.now(),
      chars: prompt.length
    });

    return res.json({
      success: true,
      reply: data.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ================= IMAGE API ================= */

app.post("/image", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "OPENAI_API_KEY missing"
      });
    }

    const prompt = req.body.prompt;
    const style = req.body.style;
    const input_image_base64 = req.body.input_image_base64;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Prompt missing"
      });
    }

    const finalStyle =
      style && style.trim().length > 0 ? style.trim() : "Realistic";

    const finalPrompt = prompt + "\nStyle: " + finalStyle;

    /* ===== IMAGE GENERATE (512x512 CHEAP) ===== */

    if (!input_image_base64 || input_image_base64.trim().length === 0) {

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
            prompt: finalPrompt,
            size: "512x512",
            quality: "low",
            n: 1
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.data || !data.data[0]) {
        return res.status(500).json({
          success: false,
          message: "Image generation failed",
          raw: data
        });
      }

      // 🔥 Firebase log
      await logToFirebase("/admin/usage/image_generate", {
        time: Date.now(),
        size: "512x512"
      });

      return res.json({
        success: true,
        mode: "generate",
        image_base64: data.data[0].b64_json
      });
    }

    /* ===== IMAGE EDIT ===== */

    let cleanBase64 = input_image_base64;
    if (cleanBase64.startsWith("data:image")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }

    const imageBuffer = Buffer.from(cleanBase64, "base64");

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", finalPrompt);
    form.append("size", "512x512");
    form.append("n", "1");
    form.append("image", imageBuffer, {
      filename: "input.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + OPENAI_API_KEY,
          ...form.getHeaders()
        },
        body: form
      }
    );

    const data = await response.json();

    if (!response.ok || !data.data || !data.data[0]) {
      return res.status(500).json({
        success: false,
        message: "Image edit failed",
        raw: data
      });
    }

    // 🔥 Firebase log
    await logToFirebase("/admin/usage/image_edit", {
      time: Date.now(),
      size: "512x512"
    });

    return res.json({
      success: true,
      mode: "edit",
      image_base64: data.data[0].b64_json
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ================= START SERVER ================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log("Imagix AI server running on port " + PORT);
});