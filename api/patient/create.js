import { supabase } from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const patient = req.body;

    if (!patient || !patient.name) {
      return res.status(400).json({ error: "Missing patient data" });
    }

    const { data, error } = await supabase
      .from("patients")
      .insert([patient])
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ patient: data });

  } catch (err) {
    console.error("PATIENT CREATE ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
