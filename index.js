import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Imagix AI Server Running");
});

app.post("/generate", async (req, res) => {
  const { prompt, style } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }

  res.json({
    success: true,
    prompt,
    style: style || "default",
    message: "API working (mock response)"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
