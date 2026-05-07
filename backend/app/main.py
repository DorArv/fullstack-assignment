"""
Backend API for the Sanctions Entity Explorer take-home assignment.

This service loads the sanctions dataset, provides fuzzy entity search,
and returns relation graphs for selected entities.
"""

import json
from difflib import SequenceMatcher
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Create API server
app = FastAPI(title="Sanctions Entity Explorer")

# Allow frontend requests from the local React app.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "sdn_sample.json"
# Load the sanctions dataset once at application startup.
with _DATA_PATH.open() as f:
    ENTITIES: list[dict] = json.load(f)

# Fast lookup by entity id for graph requests.
ENTITIES_BY_ID: dict[str, dict] = {e["id"]: e for e in ENTITIES}

SCORE_THRESHOLD = 0.3

# Simple heuristic:
# exact match > substring match > fuzzy similarity
def _score(entity: dict, query: str) -> float:
    """Score an entity against a search query. Returns a value in [0, 1]."""
    q = query.lower().strip()
    best = 0.0
    for text in [entity["name"]] + entity["aliases"]:
        t = text.lower()
        if q == t:
            return 1.0
        if q in t:
            best = max(best, 0.8)
        else:
            ratio = SequenceMatcher(None, q, t).ratio()
            best = max(best, ratio)
    return best


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

# Search entities by name and aliases.
@app.get("/api/search")
def search(q: str = Query(min_length=1)) -> list[dict]:
    scored = [
        {
            "id": e["id"],
            "name": e["name"],
            "type": e["type"],
            "primary_country": e["countries"][0] if e["countries"] else None,
            "countries": e["countries"],
            "programs": e["programs"],
            "score": round(_score(e, q), 3),
        }
        for e in ENTITIES
    ]
    # Filter weak matches and sort best results first.
    return sorted(
        [r for r in scored if r["score"] >= SCORE_THRESHOLD],
        key=lambda r: r["score"],
        reverse=True,
    )


# Return graph data for a selected entity.
@app.get("/api/entities/{entity_id}/graph")
def get_entity_graph(entity_id: str) -> dict:
    entity = ENTITIES_BY_ID.get(entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    nodes = [{"id": entity["id"], "name": entity["name"], "type": entity["type"]}]
    edges = []

    # Build neighbor nodes and edges from relations.
    for rel in entity["relations"]:
        neighbor = ENTITIES_BY_ID.get(rel["target_id"])
        if neighbor is None:
            continue
        nodes.append({"id": neighbor["id"], "name": neighbor["name"], "type": neighbor["type"]})
        edges.append({"source": entity["id"], "target": neighbor["id"], "type": rel["type"]})

    return {"center_id": entity["id"], "nodes": nodes, "edges": edges}
