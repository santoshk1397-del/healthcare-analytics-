import { supabase } from "../db.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("ncd_data")
      .select("*", { count: "exact" })
      .range(0, 9999);

    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
