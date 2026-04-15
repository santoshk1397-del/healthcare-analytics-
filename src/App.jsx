import { useEffect, useState } from "react";
import Papa from "papaparse";

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Load data from backend (keep this)
  const loadData = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/aggregate/list");
      const json = await res.json();

      setData(json.data || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Initial load
  useEffect(() => {
    loadData();
  }, []);

  // 🔥 UPDATED: Upload handler (NO demo logic)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          setLoading(true);

          const res = await fetch("/api/aggregate/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              rows: result.data,
            }),
          });

          const json = await res.json();

          if (!res.ok) throw new Error(json.error);

          alert(`Uploaded ${json.inserted} rows`);

          // 🔥 reload real data instead of demo reset
          await loadData();

        } catch (err) {
          console.error(err);
          alert("Upload failed");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div className="app-container">

      {/* 🔹 HEADER */}
      <h1>NCD Analytics Dashboard</h1>

      {/* 🔹 UPLOAD SECTION (UPDATED) */}
      <div className="upload-section">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
        />

        <button onClick={loadData}>
          Refresh Data
        </button>
      </div>

      {/* 🔹 LOADING */}
      {loading && <p>Loading...</p>}

      {/* 🔹 EMPTY STATE */}
      {!loading && data.length === 0 && (
        <p>No data available. Upload a CSV to begin.</p>
      )}

      {/* 🔹 YOUR EXISTING UI CAN STAY BELOW */}
      {/* Replace or keep your charts/cards here */}

      {!loading && data.length > 0 && (
        <>
          {/* Example: simple summary */}
          <div className="summary">
            <p>Total Rows: {data.length}</p>
          </div>

          {/* Example: table (you likely already have charts — keep them) */}
          <table>
            <thead>
              <tr>
                <th>District</th>
                <th>Month</th>
                <th>Disease</th>
                <th>Cases</th>
                <th>Target</th>
                <th>Achieved</th>
                <th>Drug %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td>{row.district_name}</td>
                  <td>{row.month}</td>
                  <td>{row.disease_type}</td>
                  <td>{row.cases}</td>
                  <td>{row.screening_target}</td>
                  <td>{row.screening_achieved}</td>
                  <td>{row.drug_availability_pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

    </div>
  );
}
