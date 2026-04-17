import { supabase } from "../../db.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Delete expired threads first
    await supabase
      .from("chat_threads")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Fetch remaining threads
    const { data, error } = await supabase
      .from("chat_threads")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ threads: data || [] });
  } catch (err) {
    console.error("Thread list error:", err);
    return res.status(500).json({ error: err.message });
  }
}
