import { supabase } from "../db.js";

export default async function handler(req, res) {
  try {
    let allData = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("ncd_data")
        .select("*")
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    res.status(200).json({ data: allData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
