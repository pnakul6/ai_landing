// Vercel serverless function: the browser calls /api/ai, and this file calls the free Gemini API.
// The API key lives in a Vercel environment variable, never in the website code.

const PROMPTS = {
  chat: "You are a friendly, concise assistant. Answer clearly in under 150 words.",
  summarize: "Summarize the user's text in 3 short bullet points. Output only the bullets.",
  rewrite: "Rewrite the user's text so it sounds professional and friendly. Keep the meaning. Output only the rewritten text.",
  explain: "Explain what the user's code does in simple language for a beginner, in under 120 words. Mention any obvious bug."
};

// Change models without editing code by setting these in Vercel.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || ""; // optional second model

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  const data = await r.json();
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
    // Try the main model up to 3 times if Google says it is overloaded (503),
    // then try the optional fallback model once.
    const attempts = [MODEL, MODEL, MODEL];
    if (FALLBACK_MODEL) attempts.push(FALLBACK_MODEL);

    let result;
    for (let i = 0; i < attempts.length; i++) {
      result = await callGemini(attempts[i], mode, text);
      if (result.status !== 503) break;      // success or a different error: stop retrying
      if (i < attempts.length - 1) await sleep(1000 * (i + 1));
    }

    if (result.status === 503) {
      return res.status(503).json({ error: "The AI is very busy right now. Please wait a few seconds and press Run again." });
    }
    if (result.status === 429) {
      return res.status(429).json({ error: "The free AI quota is used up for now. Please try again in a minute." });
    }
    if (!result.ok) {
      return res.status(502).json({ error: (result.data.error && result.data.error.message) || "The AI service returned an error." });
    }
    const parts = (result.data.candidates && result.data.candidates[0] && result.data.candidates[0].content && result.data.candidates[0].content.parts) || [];
    const output = parts.map(p => p.text || "").join("").trim();
    return res.status(200).json({ output: output || "No answer came back. Try rephrasing." });
  } catch (e) {
    return res.status(500).json({ error: "Could not reach the AI service." });
  }
};
