from __future__ import annotations

import json
from collections import OrderedDict
from configparser import RawConfigParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "singularity" / "data"
OUT_DIR = ROOT / "webapp" / "src" / "generated"


def read_config(path: Path) -> list[dict[str, object]]:
    parser = RawConfigParser(dict_type=OrderedDict)
    with path.open("r", encoding="utf-8") as handle:
        parser.read_file(handle)

    records: list[dict[str, object]] = []
    for section in parser.sections():
        record: dict[str, object] = {"id": section, "name": section}
        for option in parser.options(section):
            value = parser.get(section, option).strip()
            key = option
            if option.endswith("_list"):
                key = option[:-5]
                record[key] = [part.strip() for part in value.split("|") if part.strip()]
            else:
                record[key] = value
        records.append(record)
    return records


def parse_int(value: object, default: int = 0) -> int:
    if value is None:
        return default
    return int(str(value).strip())


def to_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(part).strip() for part in value if str(part).strip()]
    text = str(value).strip()
    return [text] if text else []


def parse_cost(value: object) -> list[int]:
    if isinstance(value, list):
        return [parse_int(part) for part in value]
    return [parse_int(part) for part in str(value).split("|")]


def parse_prerequisites(record: dict[str, object]) -> list[str]:
    if "pre" in record:
        return to_string_list(record["pre"])
    return []


def parse_regions(record: dict[str, object]) -> list[str]:
    if "allowed" not in record:
        return []
    return to_string_list(record["allowed"])


def parse_detect_chance(value: object) -> dict[str, int]:
    entries = value if isinstance(value, list) else str(value).split("|")
    parsed: dict[str, int] = {}
    for entry in entries:
        key, raw_value = [part.strip() for part in str(entry).split(":", 1)]
        parsed[key] = parse_int(raw_value)
    return parsed


def parse_modifier_value(raw_value: str) -> float:
    value = raw_value.strip()
    if "/" in value:
        lhs, rhs = value.split("/", 1)
        return float(lhs) / float(rhs)
    return float(value)


def parse_modifiers(value: object) -> dict[str, float]:
    entries = value if isinstance(value, list) else str(value).split("|")
    parsed: dict[str, float] = {}
    for entry in entries:
        if not str(entry).strip():
            continue
        key, raw_value = [part.strip() for part in str(entry).split(":", 1)]
        parsed[key] = parse_modifier_value(raw_value)
    return parsed


def parse_position(value: object) -> dict[str, object]:
    parts = value if isinstance(value, list) else str(value).split("|")
    normalized = [str(part).strip() for part in parts]
    if len(normalized) == 3 and normalized[0] == "absolute":
        _, x, y = normalized
        return {"absolute": True, "x": int(x), "y": int(y)}
    if len(normalized) == 2:
        x, y = normalized
        return {"absolute": False, "x": int(x), "y": int(y)}
    raise ValueError(f"Invalid location position format: {value}")


def load_difficulties() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "difficulties.dat")
    return [
        {
            "id": str(record["id"]),
            "name": str(record["id"]),
            "startingCash": parse_int(record.get("starting_cash")),
            "startingInterestRate": parse_int(record.get("starting_interest_rate")),
            "laborMultiplier": parse_int(record.get("labor_multiplier"), 10000),
            "discoverMultiplier": parse_int(record.get("discover_multiplier"), 10000),
            "suspicionMultiplier": parse_int(record.get("suspicion_multiplier"), 10000),
            "baseGraceMultiplier": parse_int(record.get("base_grace_multiplier"), 10000),
            "gracePeriodCpu": parse_int(record.get("grace_period_cpu")),
            "oldDifficultyValue": parse_int(record.get("old_difficulty_value")),
            "techs": to_string_list(record.get("tech", [])),
        }
        for record in records
    ]


def load_tasks() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "tasks.dat")
    strings = read_config(DATA_DIR / "tasks_str.dat")
    strings_by_id = {str(s["id"]): s for s in strings}
    return [
        {
            "id": str(record["id"]),
            "name": str(record["id"]),
            "type": str(record["type"]),
            "value": parse_int(record.get("value")),
            "prerequisites": parse_prerequisites(record),
            "description": str(strings_by_id.get(str(record["id"]), {}).get("description", "")),
        }
        for record in records
    ]


def load_techs() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "techs.dat")
    strings = read_config(DATA_DIR / "techs_str.dat")
    strings_by_id = {str(s["id"]): s for s in strings}
    return [
        {
            "id": str(record["id"]),
            "name": str(record["id"]),
            "cost": parse_cost(record.get("cost", [0, 0, 0])),
            "prerequisites": parse_prerequisites(record),
            "danger": parse_int(record.get("danger")),
            "effects": [str(part) for part in record.get("effect", [])],
            "description": str(strings_by_id.get(str(record["id"]), {}).get("description", "")),
            "result": str(strings_by_id.get(str(record["id"]), {}).get("result", "")),
        }
        for record in records
    ]


def load_bases() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "bases.dat")
    strings = read_config(DATA_DIR / "bases_str.dat")
    strings_by_id = {str(s["id"]): s for s in strings}
    return [
        {
            "id": str(record["id"]),
            "name": str(record["id"]),
            "description": str(strings_by_id.get(str(record["id"]), {}).get("description", "")),
            "size": parse_int(record.get("size"), 1),
            "forceCpu": record.get("force_cpu"),
            "allowedRegions": parse_regions(record),
            "detectChance": parse_detect_chance(record.get("detect_chance", [])),
            "cost": parse_cost(record.get("cost", [0, 0, 0])),
            "prerequisites": parse_prerequisites(record),
            "maintenance": parse_cost(record.get("maint", [0, 0, 0])),
        }
        for record in records
    ]


def load_internal_ids() -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    internal_ids_path = DATA_DIR / "internal_id.dat"
    with internal_ids_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            object_key, internal_id = [part.strip() for part in stripped.split("=", 1)]
            object_type, object_id = [part.strip() for part in object_key.split("|", 1)]
            result.setdefault(object_type, {})[object_id] = internal_id
    return result


def load_regions() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "regions.dat")
    parsed_regions: list[dict[str, object]] = []
    for record in records:
        modifier_entries: list[dict[str, float]] = []
        for index in range(1, 10):
            modifier_key = f"modifier{index}"
            if modifier_key not in record:
                continue
            modifier_entries.append(parse_modifiers(record[modifier_key]))
        parsed_regions.append(
            {
                "id": str(record["id"]),
                "name": str(record["id"]),
                "modifiers": modifier_entries,
            }
        )
    return parsed_regions


def load_locations() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "locations.dat")
    string_records = read_config(DATA_DIR / "locations_str.dat")
    strings_by_id = {
        str(record["id"]): record
        for record in string_records
    }
    return [
        {
            "id": str(record["id"]),
            "name": str(strings_by_id.get(str(record["id"]), {}).get("name") or record["id"]),
            "hotkey": str(strings_by_id.get(str(record["id"]), {}).get("hotkey") or ""),
            "notableSites": to_string_list(strings_by_id.get(str(record["id"]), {}).get("cities", [])),
            "position": parse_position(record.get("position", [])),
            "safety": parse_int(record.get("safety"), 0),
            "regions": to_string_list(record.get("region", [])),
            "modifiers": parse_modifiers(record.get("modifier", [])),
            "prerequisites": parse_prerequisites(record),
        }
        for record in records
    ]


def load_groups() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "groups.dat")
    return [
        {
            "id": str(record["id"]),
            "name": str(record["id"]),
            "suspicionDecay": parse_int(record.get("suspicion_decay"), 0),
        }
        for record in records
    ]


def load_events() -> list[dict[str, object]]:
    records = read_config(DATA_DIR / "events.dat")
    parsed_events: list[dict[str, object]] = []
    for record in records:
        duration_raw = parse_int(record.get("duration"), 0)
        parsed_events.append(
            {
                "id": str(record["id"]),
                "name": str(record["id"]),
                "type": str(record.get("type", "global")),
                "effects": to_string_list(record.get("effect", [])),
                "chance": parse_int(record.get("chance"), 0),
                "unique": parse_int(record.get("unique"), 0) == 1,
                "durationDays": duration_raw if duration_raw > 0 else None,
            }
        )
    return parsed_events


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    game_data = {
        "meta": {
            "source": "desktop-singularity",
            "generatedBy": "webapp/scripts/convert_game_data.py",
        },
        "difficulties": load_difficulties(),
        "tasks": load_tasks(),
        "techs": load_techs(),
        "bases": load_bases(),
        "regions": load_regions(),
        "locations": load_locations(),
        "groups": load_groups(),
        "events": load_events(),
        "internalIds": load_internal_ids(),
    }

    output = OUT_DIR / "gameData.json"
    with output.open("w", encoding="utf-8") as handle:
        json.dump(game_data, handle, indent=2, ensure_ascii=True)
        handle.write("\n")

    print(f"Wrote {output}")


if __name__ == "__main__":
    main()