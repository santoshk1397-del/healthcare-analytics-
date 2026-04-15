import { supabase } from "../db.js";

export default async function handler(req, res) {
  const { data } = await supabase.from("patients").select("*");
  res.status(200).json({ patients: data });
}
