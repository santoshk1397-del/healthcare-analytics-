import { supabase } from "../db.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  // GET — load messages for a thread
  if (req.method === "GET") {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Thread ID required" });

      const { data: thread, error: tErr } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("id", id)
        .single();

      if (tErr) throw tErr;

      // Check if expired
      if (new Date(thread.expires_at) < new Date()) {
        await supabase.from("chat_threads").delete().eq("id", id);
        return res.status(404).json({ error: "Thread expired" });
      }

      const { data: messages, error: mErr } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;

      return res.status(200).json({ thread, messages: messages || [] });
    } catch (err) {
      console.error("Thread load error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — create thread or save message
  if (req.method === "POST") {
    try {
      const { action, thread_id, role, content, title } = req.body;

      // Create new thread
      if (action === "create") {
        const { data, error } = await supabase
          .from("chat_threads")
          .insert([{
            title: title || "New conversation",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }])
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ thread: data });
      }

      // Save message to thread
      if (action === "message") {
        if (!thread_id || !role || !content) {
          return res.status(400).json({ error: "thread_id, role, content required" });
        }

        const { error: msgErr } = await supabase
          .from("chat_messages")
          .insert([{ thread_id, role, content }]);

        if (msgErr) throw msgErr;

        // Update thread timestamp + title if first user message
        const updates = { updated_at: new Date().toISOString() };
        if (role === "user" && title) {
          updates.title = title;
        }
        await supabase
          .from("chat_threads")
          .update(updates)
          .eq("id", thread_id);

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Invalid action" });
    } catch (err) {
      console.error("Thread save error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
