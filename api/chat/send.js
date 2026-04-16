export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { system, messages } = req.body;

    // Convert from Claude message format to Gemini format
    const geminiContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: system }],
          },
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || JSON.stringify(data.error) || "Gemini API error");
    }

    // Convert Gemini response back to Claude-like format
    const text = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .filter(Boolean)
      .join("\n") || "No response generated.";

    // Return in Claude-compatible format so frontend doesn't need changes
    return res.status(200).json({
      content: [{ type: "text", text }],
    });

  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
