import { supabase } from "../db.js";

export default async function handler(req, res) {
  const user = req.user; // extracted from auth middleware

  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // fetch role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role_id, district_id")
    .eq("id", user.id)
    .single();

  // check role
  if (!["admin", "health_worker"].includes(profile.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // enforce district constraint
  const patient = req.body;

  if (
    profile.role !== "admin" &&
    patient.district_id !== profile.district_id
  ) {
    return res.status(403).json({ error: "Wrong district" });
  }

  // insert
  const { error } = await supabase.from("patients").insert([patient]);

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ success: true });
}
