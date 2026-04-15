import { supabase } from "../db.js";

const MONTH_MAP = {
  Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09",
  Oct: "10", Nov: "11", Dec: "12",
  Jan: "01", Feb: "02", Mar: "03",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rows } = req.body;

    if (!rows || !rows.length) {
      return res.status(400).json({ error: "No data provided" });
    }

    // 🔹 fetch districts
    const { data: districts } = await supabase
      .from("districts")
      .select("id, name");

    const districtMap = {};
    districts.forEach(d => {
      districtMap[d.name.toLowerCase()] = d.id;
    });

    // 🔹 transform rows
    const formatted = rows.map(r => {
      const districtName = r.district_name?.trim();
      const month = r.month?.trim();
      const year = r.year;

      const monthNum = MONTH_MAP[month];
      const month_date = monthNum
        ? `${year}-${monthNum}-01`
        : null;

      return {
        district_name: districtName,
        month,
        disease_type: r.disease_type,

        cases: Number(r.cases) || 0,
        screening_target: Number(r.screening_target) || 0,
        screening_achieved: Number(r.screening_achieved) || 0,
        budget_allocated_lakhs: Number(r.budget_allocated_lakhs) || 0,
        budget_utilized_lakhs: Number(r.budget_utilized_lakhs) || 0,
        hr_sanctioned: Number(r.hr_sanctioned) || 0,
        hr_in_position: Number(r.hr_in_position) || 0,
        drug_availability_pct: Number(r.drug_availability_pct) || 0,

        district_id: districtMap[districtName?.toLowerCase()] || null,
        month_date,
        created_at: new Date(),
      };
    });

    // ✅ ALWAYS APPEND (no delete, no replace)
    const { error } = await supabase
      .from("ncd_data")
      .insert(formatted);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      inserted: formatted.length,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
}
