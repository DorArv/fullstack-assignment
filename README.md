# Sanctions Entity Explorer — Submission Notes

## Required Versions

| Tool    | Version  |
|---------|----------|
| Python  | 3.14+    |
| Node.js | 20+ (LTS)|
| uv      | latest   |
| pnpm    | 9+       |

## Setup & Run

Run both servers simultaneously in two terminals.

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

App: http://localhost:5173

## Architecture

```
backend/app/main.py     — single FastAPI file, 3 endpoints
frontend/src/App.tsx    — single React file, 2 components (App + GraphView)
data/sdn_sample.json    — fixture, loaded once on startup, not modified
```

### Backend endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Liveness check |
| `GET /api/search?q=<text>` | Fuzzy/partial name+alias search, ranked results |
| `GET /api/entities/{id}/graph` | Nodes and edges for an entity's relations |

Data is loaded from `data/sdn_sample.json` once at module startup into a list (for iteration) and a dict keyed by ID (for O(1) lookups). No database, no ORM.

### Frontend

- **Search view**: debounced text input (300ms) → results table → click a row to open the graph
- **Graph view**: static SVG with a radial layout — center node surrounded by directly related entities, edges labeled with relation type

Navigation is pure React state (`selectedId: string | null`). Going back restores the previous search query and results.

## Implementation Notes

### Search scoring

Three tiers, best score across all name/alias candidates wins:

1. Exact match → `1.0`
2. Query is a substring of the candidate → `0.8`
3. Fuzzy ratio via `difflib.SequenceMatcher` → raw ratio

Uses Python's built-in `difflib` — no extra dependencies needed.

### Graph layout

Neighbors are evenly distributed on a circle of radius 180px around the center node. Start angle is −90° (top), so the first neighbor appears directly above. SVG elements are rendered in order: edges → neighbors → center, so the center node always sits on top of line endpoints.

Edge labels use a white `<rect>` behind the `<text>` element to make them readable over the connecting lines, without needing a CSS filter.

## Tradeoffs and Simplifications

- **Single file per layer**: `main.py` (~85 lines) and `App.tsx` (~280 lines) are small enough that splitting into modules would add file-switching overhead for no real benefit at this scale.
- **No router**: two views managed with a single `selectedId` state is simpler and easier to follow than installing and configuring a router library.
- **No Pydantic response models**: `list[dict]` return types are sufficient for a read-only fixture; typed models would add boilerplate without improving correctness here.
- **No CSS file**: inline styles keep each component's appearance co-located with its markup.
- **`difflib` over `rapidfuzz`**: no extra dependency; accuracy is adequate for a 32-entity dataset and partial/fuzzy matching still works well for realistic investigator queries.
- **Fixed orbit radius**: works correctly for this dataset (max 3 relations per entity). A production implementation would compute the radius dynamically based on neighbor count.
- **Non-interactive graph**: as specified. A static SVG communicates the relation structure clearly without requiring D3, Cytoscape, or react-force-graph.
