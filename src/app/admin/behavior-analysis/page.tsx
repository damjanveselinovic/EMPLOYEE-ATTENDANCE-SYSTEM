"use client";

import { useEffect, useState } from "react";
import { Chart } from "react-google-charts";

type BehaviorResult = {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  riskScore: number;
  features: Record<string, number>;
};

type ApiResponse = {
  generatedAt: string;
  results: BehaviorResult[];
};

export default function BehaviorAnalysisPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/behavior-analysis");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Greska (${res.status})`);
        }
        const json: ApiResponse = await res.json();
        if (!cancelled) {
          setData(json);
          localStorage.setItem("behaviorAnalysisLastRun", json.generatedAt);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Nepoznata greska");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData =
    data && data.results.length > 0
      ? [
          ["Zaposleni", "Risk score", { role: "style" }],
          ...data.results.map((r) => {
            const pct = Math.round(r.riskScore * 100);
            const color = r.riskScore > 0.1 ? "#dc2626" : "#3b82f6"; // crveno ako strci
            return [`${r.firstName} ${r.lastName}`, pct, color];
          }),
        ]
      : null;

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "8px" }}>
        Analiza ponašanja zaposlenih
      </h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        Procena rizika od burnout-a na osnovu obrasca prisustva u poslednjih ~2
        meseca (Random Forest / Gradient Boosting model, treniran na sintetičkim
        podacima).
      </p>

      {loading && <p>Učitavanje analize...</p>}

      {error && (
        <p style={{ color: "#dc2626" }}>
          Greška pri učitavanju analize: {error}
        </p>
      )}

      {data && data.results.length === 0 && <p>Nema aktivnih korisnika.</p>}

      {chartData && (
        <div style={{ marginBottom: "32px" }}>
          <Chart
            chartType="BarChart"
            width="100%"
            height={`${data!.results.length * 45 + 60}px`}
            data={chartData}
            options={{
              title: "Risk score po zaposlenom (%)",
              legend: { position: "none" },
              hAxis: { title: "Risk score (%)", minValue: 0, maxValue: 100 },
              chartArea: { width: "60%" },
            }}
          />
        </div>
      )}

      {data && data.results.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th style={{ padding: "8px" }}>Zaposleni</th>
              <th style={{ padding: "8px" }}>Email</th>
              <th style={{ padding: "8px" }}>Risk score</th>
              <th style={{ padding: "8px" }}>Prosek sati (recent)</th>
              <th style={{ padding: "8px" }}>Odstupanje od baseline-a</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr
                key={r.userId}
                style={{
                  borderBottom: "1px solid #eee",
                  backgroundColor: r.riskScore > 0.1 ? "#fef2f2" : undefined,
                  fontWeight: r.riskScore > 0.1 ? 600 : 400,
                }}
              >
                <td style={{ padding: "8px" }}>
                  {r.firstName} {r.lastName}
                </td>
                <td style={{ padding: "8px" }}>{r.email}</td>
                <td style={{ padding: "8px" }}>
                  {(r.riskScore * 100).toFixed(2)}%
                </td>
                <td style={{ padding: "8px" }}>
                  {r.features.avg_hours_recent.toFixed(1)}h
                </td>
                <td style={{ padding: "8px" }}>
                  {r.features.hours_deviation >= 0 ? "+" : ""}
                  {r.features.hours_deviation.toFixed(1)}h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <p style={{ marginTop: "16px", fontSize: "0.85rem", color: "#999" }}>
          Generisano: {new Date(data.generatedAt).toLocaleString("sr-RS")}
        </p>
      )}
    </div>
  );
}
