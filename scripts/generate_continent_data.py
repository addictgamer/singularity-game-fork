#!/usr/bin/env python3
"""
Generate continent boundary data from earth.jpg for interactive map regions.
Uses Douglas-Peucker simplification (via skimage.measure.approximate_polygon)
to produce shape-accurate continent outlines in 0-100 normalized coordinates.
"""

import json
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label, binary_closing, binary_dilation
from skimage import measure

EARTH_IMAGE = Path(__file__).parent.parent / "webapp" / "public" / "earth.jpg"
OUTPUT_FILE = Path(__file__).parent.parent / "webapp" / "src" / "generated" / "continentData.json"

# Douglas-Peucker tolerance in pixels (lower = more points, truer shape)
SIMPLIFICATION_TOLERANCE = 4.0

# Minimum land mass size in pixels to include
MIN_PIXELS = 1500

# Seeded continent anchors in normalized (0-100) map coordinates.
# These are aligned to the game's location map so connected landmasses
# (Americas, Eurasia/Africa) can be split into gameplay-expected regions.
CONTINENT_SEEDS = [
    ("north_america", "North America", 25.0, 29.0),
    ("south_america", "South America", 33.0, 61.0),
    ("europe", "Europe", 55.0, 20.0),
    ("asia", "Asia", 77.0, 29.0),
    ("africa", "Africa", 55.0, 46.0),
    ("australia", "Australia", 85.0, 64.0),
    ("antarctica", "Antarctica", 50.0, 91.0),
]

def make_land_mask(img_array: np.ndarray) -> np.ndarray:
    """
    Produce a boolean land mask from an RGB image array.
    Earth images from space: land = brownish/greenish, ocean = dark blue/black.
    We work in HSV space for more robust separation.
    """
    r = img_array[:, :, 0].astype(float)
    g = img_array[:, :, 1].astype(float)
    b = img_array[:, :, 2].astype(float)

    # Saturation-weighted heuristic:
    # Ocean pixels: high blue relative to red+green, and moderately saturated
    # Land pixels: higher red or green, or desaturated (deserts, snow)
    total = r + g + b + 1e-6

    # Blue fraction
    blue_frac = b / total
    # Green fraction
    green_frac = g / total

    # Ocean: blue dominant and not too dark (avoid space black borders)
    is_ocean = (blue_frac > 0.38) & (b > 30)

    # Very dark pixels (deep ocean or edge vignette) — not land
    is_dark = total < 90

    # Ice/snow: all channels high and similar (polar caps)
    max_chan = np.maximum(np.maximum(r, g), b)
    min_chan = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_chan > 0, (max_chan - min_chan) / max_chan, 0)
    is_bright_low_sat = (total > 400) & (saturation < 0.25)

    # Land = not ocean, not dark, not pure cloud-bright-white in middle latitudes
    # (keep polar snow but exclude mid-ocean bright clouds)
    land = ~is_ocean & ~is_dark
    # Remove very bright, very low-saturation pixels that are likely clouds
    # (clouds tend to appear over ocean too, so only strip them where there's no
    # surrounding land signal — we'll rely on morphological closing to fill gaps)
    land = land & ~(is_bright_low_sat & (blue_frac > 0.28))

    return land

def _entry_from_mask(mask: np.ndarray, width: int, height: int, region_id: str, region_name: str):
    ys, xs = np.nonzero(mask)
    if ys.size == 0:
        return None

    contours = measure.find_contours(mask, 0.5)
    if not contours:
        return None

    contour = max(contours, key=len)
    simplified = measure.approximate_polygon(contour, tolerance=SIMPLIFICATION_TOLERANCE)
    boundary = [
        [round((pt[1] / width) * 100, 2), round((pt[0] / height) * 100, 2)]
        for pt in simplified
    ]

    min_row = int(ys.min())
    max_row = int(ys.max()) + 1
    min_col = int(xs.min())
    max_col = int(xs.max()) + 1
    area = int(mask.sum())

    return {
        "id": region_id,
        "name": region_name,
        "pixel_count": area,
        "area_percent": round((area / (width * height)) * 100, 2),
        "bounds": {
            "x_min": round((min_col / width) * 100, 1),
            "x_max": round((max_col / width) * 100, 1),
            "y_min": round((min_row / height) * 100, 1),
            "y_max": round((max_row / height) * 100, 1),
            "center_x": round((((min_col + max_col) / 2) / width) * 100, 1),
            "center_y": round((((min_row + max_row) / 2) / height) * 100, 1),
        },
        "boundary": boundary,
    }


def extract_continents(image_path: Path) -> list:
    print(f"Loading image: {image_path}")
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    print(f"  Size: {width}x{height}")
    arr = np.array(img)

    print("  Building land mask…")
    land = make_land_mask(arr)

    # Morphological closing: fills small gaps (bays, straits, cloud holes)
    print("  Closing gaps…")
    land = binary_closing(land, iterations=6)
    # Small dilation to merge very nearby land masses (e.g. British Isles into Europe)
    land = binary_dilation(land, iterations=3)

    print("  Labeling connected components…")
    labeled, num_features = label(land)
    print(f"  Found {num_features} raw components")

    objects = measure.regionprops(labeled)
    objects.sort(key=lambda r: r.area, reverse=True)

    seed_points = []
    for seed_id, seed_name, sx_norm, sy_norm in CONTINENT_SEEDS:
        sx = int(round((sx_norm / 100.0) * (width - 1)))
        sy = int(round((sy_norm / 100.0) * (height - 1)))
        # If seed lands on ocean/void, snap to nearest land pixel in a local window.
        if not land[sy, sx]:
            radius = 140
            y0 = max(0, sy - radius)
            y1 = min(height, sy + radius + 1)
            x0 = max(0, sx - radius)
            x1 = min(width, sx + radius + 1)
            local = land[y0:y1, x0:x1]
            lys, lxs = np.nonzero(local)
            if lys.size > 0:
                gys = lys + y0
                gxs = lxs + x0
                d2 = (gys - sy) ** 2 + (gxs - sx) ** 2
                best = int(np.argmin(d2))
                sy = int(gys[best])
                sx = int(gxs[best])

        seed_points.append({"id": seed_id, "name": seed_name, "x": sx, "y": sy})

    print(f"  Keeping components with ≥ {MIN_PIXELS} pixels…")
    continents = []
    used_seed_ids = set()
    island_index = 1

    for region in objects:
        if region.area < MIN_PIXELS:
            break

        region_mask = labeled == region.label
        ry0, rx0, ry1, rx1 = region.bbox
        component_seeds = []
        for seed in seed_points:
            if seed["id"] in used_seed_ids:
                continue
            x = seed["x"]
            y = seed["y"]
            if not (rx0 <= x < rx1 and ry0 <= y < ry1):
                continue
            if region_mask[y, x]:
                component_seeds.append(seed)

        # If this component has multiple gameplay continent seeds, split it by nearest seed.
        if len(component_seeds) > 1:
            ys, xs = np.nonzero(region_mask)
            coords = np.column_stack((ys, xs))
            seed_coords = np.array([[s["y"], s["x"]] for s in component_seeds])
            d2 = ((coords[:, None, :] - seed_coords[None, :, :]) ** 2).sum(axis=2)
            assignments = np.argmin(d2, axis=1)

            for idx, seed in enumerate(component_seeds):
                split_mask = np.zeros_like(region_mask)
                keep = assignments == idx
                if not np.any(keep):
                    continue
                split_coords = coords[keep]
                split_mask[split_coords[:, 0], split_coords[:, 1]] = True
                if split_mask.sum() < MIN_PIXELS:
                    continue
                entry = _entry_from_mask(split_mask, width, height, seed["id"], seed["name"])
                if entry is not None:
                    continents.append(entry)
                    used_seed_ids.add(seed["id"])
            continue

        if len(component_seeds) == 1:
            seed = component_seeds[0]
            entry = _entry_from_mask(region_mask, width, height, seed["id"], seed["name"])
            if entry is not None:
                continents.append(entry)
                used_seed_ids.add(seed["id"])
            continue

        # Seedless large components are kept as islands.
        entry = _entry_from_mask(region_mask, width, height, f"island_{island_index}", f"Island_{island_index}")
        if entry is not None:
            continents.append(entry)
            island_index += 1

    # Sort by area for stable output ordering.
    continents.sort(key=lambda c: c["pixel_count"], reverse=True)
    return continents

def main():
    if not EARTH_IMAGE.exists():
        print(f"ERROR: Earth image not found at {EARTH_IMAGE}")
        return

    continents = extract_continents(EARTH_IMAGE)

    print(f"\nExtracted {len(continents)} land masses:")
    total_pts = 0
    for c in continents:
        pts = len(c["boundary"])
        total_pts += pts
        print(f"  {c['name']:22s}  {c['area_percent']:5.2f}% area  {pts:4d} boundary pts")

    print(f"\n  Total boundary points: {total_pts}")

    output = {
        "version": "2.0",
        "description": "Continent boundary data generated from earth.jpg via Douglas-Peucker simplification",
        "continents": continents,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Written to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()

