import { useEffect, useMemo, useRef, useState } from "react";
import { LocationDef } from "../engine/types";
import { SECONDS_PER_DAY } from "../engine/constants";
import continentDataRaw from "../generated/continentData.json";

interface ContinentEntry {
  id: string;
  name: string;
  boundary: Array<[number, number]>;
  bounds: { x_min: number; x_max: number; y_min: number; y_max: number; center_x: number; center_y: number };
}

interface ClickRegion {
  id: string;
  name: string;
  points: Array<[number, number]>;
  bounds: { x_min: number; x_max: number; y_min: number; y_max: number };
}

const CONTINENTS: ContinentEntry[] = (continentDataRaw.continents as unknown as ContinentEntry[]).filter(
  (c) => c.boundary && c.boundary.length > 2
);

const CLICK_REGIONS: ClickRegion[] = CONTINENTS.map((continent) => {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [x, y] of continent.boundary) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  return {
    id: continent.id,
    name: continent.name,
    points: continent.boundary,
    bounds: { x_min: xMin, x_max: xMax, y_min: yMin, y_max: yMax },
  };
});

/** Ray-casting point-in-polygon test in normalized 0-100 map space. */
function pointInPolygon(px: number, py: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

interface WorldMapProps {
  locations: LocationDef[];
  selectedLocationId: string;
  isLocationAvailable: (locationId: string) => boolean;
  rawSec: number;
  onSelect: (locationId: string) => void;
}

export function WorldMap({
  locations,
  selectedLocationId,
  isLocationAvailable,
  rawSec,
  onSelect,
}: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [hoveredContinentId, setHoveredContinentId] = useState<string | null>(null);
  const earthImageRef = useRef<HTMLImageElement | null>(null);

  const sorted = useMemo(() => [...locations].sort((a, b) => a.name.localeCompare(b.name)), [locations]);

  const hoveredLocation = hoveredLocationId
    ? sorted.find((location) => location.id === hoveredLocationId) ?? null
    : null;

  const timeOfDay = ((rawSec % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const dayPercent = timeOfDay / SECONDS_PER_DAY;

  const selectableRegionIds = useMemo(() => {
    const selectable = new Set<string>();
    for (const region of CLICK_REGIONS) {
      for (const location of sorted) {
        if (!isLocationAvailable(location.id)) continue;
        if (pointInPolygon(location.position.x, location.position.y, region.points)) {
          selectable.add(region.id);
          break;
        }
      }
      if (selectable.has(region.id)) continue;

      // Keep coarse-region fallback aligned with click behavior.
      const b = region.bounds;
      for (const location of sorted) {
        if (!isLocationAvailable(location.id)) continue;
        const inBounds =
          location.position.x >= b.x_min - 5 && location.position.x <= b.x_max + 5 &&
          location.position.y >= b.y_min - 5 && location.position.y <= b.y_max + 5;
        if (inBounds) {
          selectable.add(region.id);
          break;
        }
      }
    }
    return selectable;
  }, [isLocationAvailable, sorted]);

  useEffect(() => {
    const img = new Image();
    img.src = "/earth.jpg";
    img.onload = () => {
      earthImageRef.current = img;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    });

    resizeObserver.observe(container);

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);

      // Earth image base layer
      if (earthImageRef.current) {
        context.drawImage(earthImageRef.current, 0, 0, width, height);
        const overlayGradient = context.createLinearGradient(0, 0, width, height);
        overlayGradient.addColorStop(0, "rgba(44, 182, 255, 0.25)");
        overlayGradient.addColorStop(0.5, "rgba(26, 125, 184, 0.35)");
        overlayGradient.addColorStop(1, "rgba(13, 63, 102, 0.45)");
        context.fillStyle = overlayGradient;
        context.fillRect(0, 0, width, height);
      } else {
        const oceanGradient = context.createLinearGradient(0, 0, width, height);
        oceanGradient.addColorStop(0, "#2cb6ff");
        oceanGradient.addColorStop(0.5, "#1a7db8");
        oceanGradient.addColorStop(1, "#0d3f66");
        context.fillStyle = oceanGradient;
        context.fillRect(0, 0, width, height);
      }

      // Draw only selectable region boundaries.
      for (const region of CLICK_REGIONS) {
        if (!selectableRegionIds.has(region.id)) continue;

        const isHovered = region.id === hoveredContinentId;
        context.save();
        context.beginPath();
        for (let i = 0; i < region.points.length; i++) {
          const [bx, by] = region.points[i];
          const px = (bx / 100) * width;
          const py = (by / 100) * height;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        if (isHovered) {
          context.strokeStyle = "rgba(255, 216, 97, 0.72)";
          context.lineWidth = 2.2;
          context.shadowColor = "rgba(255, 216, 97, 0.65)";
          context.shadowBlur = 8;
        } else {
          context.strokeStyle = "rgba(200, 200, 200, 0.28)";
          context.lineWidth = 1.1;
          context.shadowBlur = 0;
        }
        context.stroke();
        context.restore();
      }

      // Grid overlay
      context.globalAlpha = 0.1;
      context.strokeStyle = "#ffffff";
      for (let x = 0; x <= width; x += Math.max(48, width / 12)) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y <= height; y += Math.max(42, height / 8)) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.globalAlpha = 1;

      // Night terminator
      const terminatorX = (dayPercent * width + width * 0.1) % width;
      const dayWidth = width * 0.55;
      const nightLeft = (terminatorX + dayWidth) % width;
      const drawNightBand = (xStart: number, xEnd: number) => {
        const bandWidth = xEnd - xStart;
        if (bandWidth <= 0) return;
        const gradient = context.createLinearGradient(xStart, 0, xEnd, 0);
        gradient.addColorStop(0, "rgba(7, 12, 30, 0.05)");
        gradient.addColorStop(0.25, "rgba(7, 12, 30, 0.3)");
        gradient.addColorStop(1, "rgba(7, 12, 30, 0.7)");
        context.fillStyle = gradient;
        context.fillRect(xStart, 0, bandWidth, height);
      };
      if (nightLeft > terminatorX) {
        drawNightBand(nightLeft, width);
        drawNightBand(0, terminatorX);
      } else {
        drawNightBand(nightLeft, terminatorX);
      }

      // Location markers
      for (const location of sorted) {
        const available = isLocationAvailable(location.id);
        const selected = selectedLocationId === location.id;
        const hovered = hoveredLocationId === location.id;
        const x = (location.position.x / 100) * width;
        const y = (location.position.y / 100) * height;
        const radius = selected ? 6 : 4.5;

        if (hovered || selected) {
          context.beginPath();
          context.arc(x, y, radius + 8, 0, Math.PI * 2);
          context.fillStyle = available ? "rgba(255, 216, 97, 0.2)" : "rgba(183, 194, 213, 0.2)";
          context.shadowColor = available ? "rgba(255, 216, 97, 0.6)" : "rgba(183, 194, 213, 0.4)";
          context.shadowBlur = 12;
          context.fill();
          context.shadowBlur = 0;
        }

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = available ? "#ffd861" : "#b7c2d5";
        context.fill();

        if (selected) {
          context.beginPath();
          context.arc(x, y, radius + 5, 0, Math.PI * 2);
          context.strokeStyle = "rgba(255,255,255,0.95)";
          context.lineWidth = 2;
          context.stroke();
        }
      }
    };

    draw();
    return () => {
      resizeObserver.disconnect();
    };
  }, [dayPercent, hoveredContinentId, hoveredLocationId, isLocationAvailable, selectableRegionIds, selectedLocationId, sorted]);

  const getContinentAtPointer = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const nx = (x / rect.width) * 100;
    const ny = (y / rect.height) * 100;

    for (const region of CLICK_REGIONS) {
      if (!selectableRegionIds.has(region.id)) continue;
      const b = region.bounds;
      if (nx < b.x_min - 1 || nx > b.x_max + 1 || ny < b.y_min - 1 || ny > b.y_max + 1) continue;
      if (pointInPolygon(nx, ny, region.points)) return region.id;
    }

    return null;
  };

  const getLocationAtPointer = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const location of sorted) {
      const lx = (location.position.x / 100) * rect.width;
      const ly = (location.position.y / 100) * rect.height;
      const dx = lx - x;
      const dy = ly - y;
      if (dx * dx + dy * dy <= 12 * 12) return location.id;
    }
    return null;
  };

  /** Find nearest available location within the same continent region. */
  const getNearestLocationInContinent = (
    clientX: number,
    clientY: number,
    continentId: string
  ): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const region = CLICK_REGIONS.find((c) => c.id === continentId);
    if (!region) return null;

    let nearest: string | null = null;
    let nearestDist = Infinity;
    for (const location of sorted) {
      if (!isLocationAvailable(location.id)) continue;
      const lx = (location.position.x / 100) * rect.width;
      const ly = (location.position.y / 100) * rect.height;
      const inRegion = pointInPolygon(location.position.x, location.position.y, region.points);
      if (!inRegion) continue;
      const dist = Math.hypot(lx - mx, ly - my);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = location.id;
      }
    }

    // Fallback for tiny/coarse regions where no location center lands strictly inside polygon.
    if (!nearest) {
      const b = region.bounds;
      for (const location of sorted) {
        if (!isLocationAvailable(location.id)) continue;
        const lx = (location.position.x / 100) * rect.width;
        const ly = (location.position.y / 100) * rect.height;
        const inBounds =
          location.position.x >= b.x_min - 5 && location.position.x <= b.x_max + 5 &&
          location.position.y >= b.y_min - 5 && location.position.y <= b.y_max + 5;
        if (!inBounds) continue;
        const dist = Math.hypot(lx - mx, ly - my);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = location.id;
        }
      }
    }

    return nearest;
  };

  return (
    <div className="world-map" ref={containerRef} role="group" aria-label="World map locations">
      <canvas
        ref={canvasRef}
        className="world-map-canvas"
        onMouseMove={(event) => {
          const locId = getLocationAtPointer(event.clientX, event.clientY);
          setHoveredLocationId(locId);
          if (!locId) {
            const continentId = getContinentAtPointer(event.clientX, event.clientY);
            if (!continentId) {
              setHoveredContinentId(null);
            } else {
              const nearest = getNearestLocationInContinent(event.clientX, event.clientY, continentId);
              setHoveredContinentId(nearest ? continentId : null);
            }
          } else {
            setHoveredContinentId(null);
          }
        }}
        onMouseLeave={() => {
          setHoveredLocationId(null);
          setHoveredContinentId(null);
        }}
        onClick={(event) => {
          const locId = getLocationAtPointer(event.clientX, event.clientY);
          if (locId) {
            onSelect(locId);
            return;
          }
          const continentId = getContinentAtPointer(event.clientX, event.clientY);
          if (continentId) {
            const nearest = getNearestLocationInContinent(event.clientX, event.clientY, continentId);
            if (nearest) onSelect(nearest);
          }
        }}
      />
      <div className="world-map-hud top-left">Day {Math.max(0, Math.floor(rawSec / SECONDS_PER_DAY))}</div>
      <div className="world-map-hud top-right">Solar {Math.round(dayPercent * 100)}%</div>
      <div className="world-map-hud bottom-left">{sorted.length} nodes</div>
      <div className="world-map-hud bottom-right">
        {hoveredLocation
          ? `${hoveredLocation.name} (${isLocationAvailable(hoveredLocation.id) ? "available" : "locked"})`
          : hoveredContinentId
            ? `${CLICK_REGIONS.find((c) => c.id === hoveredContinentId)?.name ?? hoveredContinentId} — click to select nearest`
            : "Hover a node or region"}
      </div>
    </div>
  );
}
