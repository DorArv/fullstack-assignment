import { useEffect, useState } from "react";

interface SearchResult {
  id: string;
  name: string;
  type: string;
  primary_country: string | null;
  countries: string[];
  programs: string[];
  score: number;
}

const API_BASE = "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/search?q=${encodeURIComponent(query)}`
        );
        setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Sanctions Entity Explorer</h1>

      <input
        type="search"
        placeholder="Search by name or alias…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "0.6rem 0.75rem",
          fontSize: "1rem",
          boxSizing: "border-box",
          border: "1px solid #ccc",
          borderRadius: 4,
        }}
      />

      {loading && (
        <p style={{ color: "#888", marginTop: "1rem" }}>Searching…</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p style={{ color: "#888", marginTop: "1rem" }}>No results for "{query}".</p>
      )}

      {results.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "1.5rem",
            fontSize: "0.95rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={th}>Type</th>
              <th style={th}>Country</th>
              <th style={th}>Programs</th>
              <th style={th}>Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{ borderBottom: "1px solid #eee", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f7f7f7")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                <td style={td}>{r.name}</td>
                <td style={td}>{r.type}</td>
                <td style={td}>{r.primary_country ?? "—"}</td>
                <td style={td}>{r.programs.join(", ")}</td>
                <td style={td}>{r.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedId && (
        <p style={{ marginTop: "1.5rem", color: "#555" }}>
          Selected: <strong>{selectedId}</strong> — graph view coming next.
        </p>
      )}
    </main>
  );
}

const th: React.CSSProperties = { padding: "0.5rem 0.75rem" };
const td: React.CSSProperties = { padding: "0.5rem 0.75rem" };
