import { supabase } from "../db.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("observations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({ observations: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
