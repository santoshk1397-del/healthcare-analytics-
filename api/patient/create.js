import { supabase } from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, dob, gender, phone, district_id } = req.body;

    if (!name || !dob) {
      return res.status(400).json({ error: "Name and DOB required" });
    }

   const { error } = await supabase
      .from("patients")
      .insert([{
        name,
        dob,
        gender: gender || null,
        phone: phone || null,
        district_id: district_id ? Number(district_id) : null,
      }]);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("CREATE ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
