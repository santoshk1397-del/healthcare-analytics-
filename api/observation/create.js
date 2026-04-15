import { supabase } from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { screening_id, disease_type, value, severity } = req.body;

    if (!screening_id || !disease_type) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { data, error } = await supabase
      .from("observations")
      .insert([
        {
          screening_id,
          disease_type,
          value,
          severity,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ observation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
