
import json
from collections import defaultdict
from pathlib import Path

SRC = Path("/Users/josev/NBA-Stats-Page-Website")
OUT = Path(__file__).parent / "public" / "json"
OUT.mkdir(parents=True, exist_ok=True)


def split_file(src_path: Path, prefix: str, year_from):
    print(f"\nLoading {src_path.name} ({src_path.stat().st_size / 1024**2:.0f} MB)...")
    with open(src_path) as f:
        rows = json.load(f)
    print(f"  {len(rows):,} rows")

    by_year = defaultdict(list)
    for r in rows:
        by_year[year_from(r)].append(r)

    print(f"  Writing {len(by_year)} per-season files to {OUT}/")
    for year, season_rows in sorted(by_year.items()):
        out_path = OUT / f"{prefix}_{year}.json"
        with open(out_path, "w") as f:
            json.dump(season_rows, f, separators=(",", ":"))
        size_mb = out_path.stat().st_size / 1024**2
        print(f"    {prefix}_{year}.json: {len(season_rows):>6,} rows, {size_mb:>5.1f} MB")


# Player stats: SEASON_YEAR is like "2004-05" -> 2004
split_file(
    SRC / "nba_player_stats_2004_2026.json",
    prefix="players",
    year_from=lambda r: int(r["SEASON_YEAR"].split("-")[0]),
)

# Games: SEASON_ID is like "22004" (leading 2 = regular season) -> 2004
split_file(
    SRC / "nba_games_2004_2026.json",
    prefix="games",
    year_from=lambda r: int(r["SEASON_ID"][1:]),
)

print("\nDone.")
