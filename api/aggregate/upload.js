import { supabase } from "../db";

const MONTH_MAP = {
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
  Jan: "01",
  Feb: "02",
  Mar: "03",
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

    // 1️⃣ Fetch districts once (for mapping)
    const { data: districts, error: dError } = await supabase
      .from("districts")
      .select("id, name");

    if (dError) throw dError;

    const districtMap = {};
    districts.forEach(d => {
      districtMap[d.name.toLowerCase()] = d.id;
    });

    // 2️⃣ Transform rows
    const formattedRows = rows.map(row => {
      const districtName = row.district_name?.trim();
      const month = row.month?.trim();
      const year = row.year;

      const district_id = districtMap[districtName?.toLowerCase()] || null;

      // Create month_date from month + year
      const monthNum = MONTH_MAP[month];
      const month_date = monthNum
        ? `${year}-${monthNum}-01`
        : null;

      return {
        district_name: districtName,
        month,
        disease_type: row.disease_type,

        cases: Number(row.cases) || 0,
        screening_target: Number(row.screening_target) || 0,
        screening_achieved: Number(row.screening_achieved) || 0,
        budget_allocated_lakhs: Number(row.budget_allocated_lakhs) || 0,
        budget_utilized_lakhs: Number(row.budget_utilized_lakhs) || 0,
        hr_sanctioned: Number(row.hr_sanctioned) || 0,
        hr_in_position: Number(row.hr_in_position) || 0,
        drug_availability_pct: Number(row.drug_availability_pct) || 0,

        district_id,
        month_date,
        created_at: new Date(),
      };
    });

    // 3️⃣ Insert into ncd_data
    const { error } = await supabase
      .from("ncd_data")
      .insert(formattedRows);

    if (error) throw error;

    res.status(200).json({
      success: true,
      inserted: formattedRows.length,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
}
