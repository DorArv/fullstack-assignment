import json
from difflib import SequenceMatcher
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Sanctions Entity Explorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "sdn_sample.json"
with _DATA_PATH.open() as f:
    ENTITIES: list[dict] = json.load(f)

SCORE_THRESHOLD = 0.3


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
    return sorted(
        [r for r in scored if r["score"] >= SCORE_THRESHOLD],
        key=lambda r: r["score"],
        reverse=True,
    )
