import { supabase } from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { patient_id, screening_date } = req.body;

  const { data, error } = await supabase
    .from("screenings")
    .insert([
      {
        patient_id,
        screening_date,
        health_worker_id: "demo",
      },
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error });

  res.status(200).json({ screening: data });
}
