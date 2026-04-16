import { supabase } from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { thread_id, role, content } = req.body;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert([{ thread_id, role, content }])
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ message: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
