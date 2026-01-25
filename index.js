import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.json({ limit: "25mb" }));

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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

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

/* ================= IMAGE MODEL (GENERATE + EDIT) ================= */
app.post("/image", async (req, res) => {
  try {
    const { prompt, style, input_image_base64 } = req.body;

    if (!prompt) {
      return res.json({
        success: false,
        message: "Prompt missing"
      });
    }

    const finalStyle =
      style && style.trim().length > 0 ? style.trim() : "Realistic";

    const finalPrompt = ${prompt}\nStyle: ${finalStyle};

    // ✅ CASE 1: No input image -> NORMAL GENERATE
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
            size: "1024x1024",
            quality: "low",
            n: 1
          })
        }
      );

      const data = await response.json();

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

      return res.json({
        success: true,
        mode: "generate",
        image_base64: data.data[0].b64_json
      });
    }

    // ✅ CASE 2: input image present -> IMAGE EDIT
    let cleanBase64 = input_image_base64.trim();

    // remove "data:image/png;base64," if present
    if (cleanBase64.startsWith("data:image")) {
      cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
    }

    const imageBuffer = Buffer.from(cleanBase64, "base64");

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", finalPrompt);
    form.append("size", "1024x1024");
    form.append("n", "1");

    form.append("image", imageBuffer, {
      filename: "input.png",
      contentType: "image/png"
    });

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        ...form.getHeaders()
      },
      body: form
    });

    const data = await response.json();

    if (data.error) {
      return res.json({ success: false, error: data.error });
    }

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      return res.json({
        success: false,
        error: "No image returned (edit)",
        raw: data
      });
    }

    return res.json({
      success: true,
      mode: "edit",
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