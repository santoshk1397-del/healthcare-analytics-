import { supabase } from "../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      // create new thread
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("chat_threads")
        .insert([{ expires_at }])
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ thread_id: data.id });
    }

    if (req.method === "GET") {
      const { id } = req.query;

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return res.status(200).json({ messages: data });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
