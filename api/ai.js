// Vercel serverless function: the browser calls /api/ai, and this file calls the free Gemini API.
// The API key lives in a Vercel environment variable, never in the website code.

const PROMPTS = {
  chat: "You are a friendly, concise assistant. Answer clearly in under 150 words.",
  summarize: "Summarize the user's text in 3 short bullet points. Output only the bullets.",
  rewrite: "Rewrite the user's text so it sounds professional and friendly. Keep the meaning. Output only the rewritten text.",
  explain: "Explain what the user's code does in simple language for a beginner, in under 120 words. Mention any obvious bug."
};

// Models are tried in this order. If one is busy (503), out of free quota (429)
// or retired (404), the next one is tried automatically.
// To change the list without editing code, set GEMINI_MODELS in Vercel
// as comma-separated names, e.g.  gemini-flash-lite-latest,gemini-3.5-flash-lite
const DEFAULT_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash"
];
const MODELS = (process.env.GEMINI_MODELS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const MODEL_LIST = MODELS.length ? MODELS : DEFAULT_MODELS;

async function callGemini(model, mode, text) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPTS[mode] }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 1024 }
      })
    }
  );
  let data = {};
  try { data = await r.json(); } catch (e) {}
  return { status: r.status, ok: r.ok, data };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const { mode, text } = req.body || {};
  if (!PROMPTS[mode] || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing mode or text." });
  }
  if (text.length > 4000) {
    return res.status(400).json({ error: "Text is too long (max 4000 characters)." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "The server has no API key yet. Add GEMINI_API_KEY in Vercel settings." });
  }

  try {
    let last;
    for (const model of MODEL_LIST) {
      last = await callGemini(model, mode, text);
      if (last.ok) {
        const parts = (last.data.candidates && last.data.candidates[0] && last.data.candidates[0].content && last.data.candidates[0].content.parts) || [];
        const output = parts.map(p => p.text || "").join("").trim();
        return res.status(200).json({ output: output || "No answer came back. Try rephrasing." });
      }
      // Busy, out of quota, or model not available: try the next model.
      if (![503, 429, 404, 500].includes(last.status)) break;
    }

    if (last.status === 503 || last.status === 500) {
      return res.status(503).json({ error: "The free AI is very busy right now. Please wait a few seconds and press Run again." });
    }
    if (last.status === 429 || last.status === 404) {
      return res.status(429).json({ error: "The free AI quota is used up for now. Please try again in a minute." });
    }
    return res.status(502).json({ error: (last.data.error && last.data.error.message) || "The AI service returned an error." });
  } catch (e) {
    return res.status(500).json({ error: "Could not reach the AI service." });
  }
};
