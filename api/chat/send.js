export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { system, messages } = req.body;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Groq API error");

    // Convert OpenAI format to Claude-compatible format (frontend expects this)
    const text = data.choices?.[0]?.message?.content || "No response generated.";
    const usage = data.usage || null;
    return res.status(200).json({
      content: [{ type: "text", text }],
      usage,
    });

  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
