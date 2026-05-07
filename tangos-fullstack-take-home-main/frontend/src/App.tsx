import { type CSSProperties, useEffect, useState } from "react";

// --- Types ---

interface SearchResult {
  id: string;
  name: string;
  type: string;
  primary_country: string | null;
  countries: string[];
  programs: string[];
  score: number;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  center_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- Constants ---

const API_BASE = "http://localhost:8000";

const NODE_COLORS: Record<string, string> = {
  person: "#5b9bd5",
  organization: "#ed9c4e",
  vessel: "#5cb85c",
};

const SVG_W = 800;
const SVG_H = 520;
const CX = SVG_W / 2;
const CY = SVG_H / 2 - 20;
const ORBIT_R = 180;
const CENTER_R = 36;
const NODE_R = 28;

// --- Helpers ---

function nodeColor(type: string): string {
  return NODE_COLORS[type] ?? "#999";
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

// --- GraphView ---

function GraphView({ entityId, onBack }: { entityId: string; onBack: () => void }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/entities/${entityId}/graph`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load graph."))
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) return <p style={{ color: "#888" }}>Loading graph…</p>;
  if (error || !data) return <p style={{ color: "#c0392b" }}>{error ?? "Unknown error."}</p>;

  const center = data.nodes.find((n) => n.id === data.center_id);
  if (!center) return <p style={{ color: "#c0392b" }}>Invalid graph data.</p>;

  const neighbors = data.nodes.filter((n) => n.id !== data.center_id);

  // Map each node id to its (x, y) position in the SVG
  const positions: Record<string, { x: number; y: number }> = {
    [center.id]: { x: CX, y: CY },
  };
  neighbors.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(neighbors.length, 1) - Math.PI / 2;
    positions[n.id] = {
      x: CX + ORBIT_R * Math.cos(angle),
      y: CY + ORBIT_R * Math.sin(angle),
    };
  });

  return (
    <>
      <button onClick={onBack} style={{ marginBottom: "1rem", cursor: "pointer" }}>
        ← Back to search
      </button>
      <h2 style={{ marginBottom: "1rem" }}>{center.name}</h2>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", border: "1px solid #eee", borderRadius: 8, display: "block" }}
      >
        {/* Edges first so they render behind nodes */}
        {data.edges.map((edge, i) => {
          const s = positions[edge.source];
          const t = positions[edge.target];
          if (!s || !t) return null;
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2;
          const label = edge.type.replace(/_/g, " ");
          const labelW = label.length * 6.5;
          return (
            <g key={i}>
              <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#ccc" strokeWidth={1.5} />
              <rect x={mx - labelW / 2} y={my - 8} width={labelW} height={16} fill="white" rx={2} />
              <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#666">
                {label}
              </text>
            </g>
          );
        })}

        {/* Neighbor nodes */}
        {neighbors.map((n) => {
          const pos = positions[n.id];
          if (!pos) return null;
          return (
            <g key={n.id}>
              <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={nodeColor(n.type)} stroke="white" strokeWidth={2} />
              <text x={pos.x} y={pos.y + NODE_R + 16} textAnchor="middle" fontSize={11} fill="#333">
                {truncate(n.name, 22)}
              </text>
            </g>
          );
        })}

        {/* Center node last so it renders on top of edge lines */}
        <circle cx={CX} cy={CY} r={CENTER_R} fill={nodeColor(center.type)} stroke="white" strokeWidth={3} />
        <text x={CX} y={CY + CENTER_R + 16} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#333">
          {truncate(center.name, 22)}
        </text>
      </svg>

      <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "#555" }}>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color, display: "inline-block" }} />
            {type}
          </span>
        ))}
      </div>
    </>
  );
}

// --- App ---

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

      {selectedId ? (
        <GraphView entityId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}

const th: CSSProperties = { padding: "0.5rem 0.75rem" };
const td: CSSProperties = { padding: "0.5rem 0.75rem" };
