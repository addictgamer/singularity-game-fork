import { useEffect, useMemo, useRef, useState } from "react";
import { LocationDef } from "../engine/types";
import { SECONDS_PER_DAY } from "../engine/constants";

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

  const sorted = useMemo(() => [...locations].sort((a, b) => a.name.localeCompare(b.name)), [locations]);

  const hoveredLocation = hoveredLocationId
    ? sorted.find((location) => location.id === hoveredLocationId) ?? null
    : null;

  const timeOfDay = ((rawSec % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const dayPercent = timeOfDay / SECONDS_PER_DAY;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

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

      const oceanGradient = context.createLinearGradient(0, 0, width, height);
      oceanGradient.addColorStop(0, "#2cb6ff");
      oceanGradient.addColorStop(0.5, "#1a7db8");
      oceanGradient.addColorStop(1, "#0d3f66");
      context.fillStyle = oceanGradient;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.16;
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

      const drawLandMass = (points: Array<[number, number]>, fill: string) => {
        context.beginPath();
        for (let index = 0; index < points.length; index += 1) {
          const [x, y] = points[index];
          if (index === 0) {
            context.moveTo(x * width, y * height);
          } else {
            context.lineTo(x * width, y * height);
          }
        }
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      };

      drawLandMass(
        [
          [0.07, 0.2],
          [0.17, 0.16],
          [0.23, 0.24],
          [0.19, 0.36],
          [0.11, 0.37],
          [0.06, 0.3],
        ],
        "#92bf80"
      );
      drawLandMass(
        [
          [0.2, 0.48],
          [0.26, 0.43],
          [0.29, 0.52],
          [0.24, 0.67],
          [0.18, 0.64],
        ],
        "#7baa6b"
      );
      drawLandMass(
        [
          [0.43, 0.19],
          [0.63, 0.16],
          [0.7, 0.28],
          [0.62, 0.38],
          [0.47, 0.35],
        ],
        "#86b575"
      );
      drawLandMass(
        [
          [0.5, 0.42],
          [0.6, 0.41],
          [0.66, 0.58],
          [0.56, 0.68],
          [0.47, 0.56],
        ],
        "#739f63"
      );
      drawLandMass(
        [
          [0.72, 0.22],
          [0.9, 0.26],
          [0.92, 0.42],
          [0.81, 0.46],
          [0.71, 0.37],
        ],
        "#8aba78"
      );
      drawLandMass(
        [
          [0.82, 0.58],
          [0.89, 0.62],
          [0.86, 0.75],
          [0.78, 0.71],
        ],
        "#6f9a5f"
      );

      const terminatorX = (dayPercent * width + width * 0.1) % width;
      const dayWidth = width * 0.55;
      const nightLeft = (terminatorX + dayWidth) % width;

      const drawNightBand = (xStart: number, xEnd: number) => {
        const bandWidth = xEnd - xStart;
        if (bandWidth <= 0) {
          return;
        }
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

      for (const location of sorted) {
        const available = isLocationAvailable(location.id);
        const selected = selectedLocationId === location.id;
        const hovered = hoveredLocationId === location.id;

        const x = (location.position.x / 100) * width;
        const y = (location.position.y / 100) * height;
        const radius = selected ? 6 : 4.5;

        context.beginPath();
        context.arc(x, y, radius + (hovered ? 2 : 0), 0, Math.PI * 2);
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
  }, [dayPercent, hoveredLocationId, isLocationAvailable, selectedLocationId, sorted]);

  const getLocationAtPointer = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (const location of sorted) {
      const lx = (location.position.x / 100) * rect.width;
      const ly = (location.position.y / 100) * rect.height;
      const dx = lx - x;
      const dy = ly - y;
      if (dx * dx + dy * dy <= 10 * 10) {
        return location.id;
      }
    }
    return null;
  };

  return (
    <div className="world-map" ref={containerRef} role="group" aria-label="World map locations">
      <canvas
        ref={canvasRef}
        className="world-map-canvas"
        onMouseMove={(event) => {
          setHoveredLocationId(getLocationAtPointer(event.clientX, event.clientY));
        }}
        onMouseLeave={() => setHoveredLocationId(null)}
        onClick={(event) => {
          const id = getLocationAtPointer(event.clientX, event.clientY);
          if (id) {
            onSelect(id);
          }
        }}
      />

      <div className="world-map-hud top-left">Simulation day {Math.max(0, Math.floor(rawSec / SECONDS_PER_DAY))}</div>
      <div className="world-map-hud top-right">Solar terminator: {Math.round(dayPercent * 100)}%</div>
      <div className="world-map-hud bottom-left">{sorted.length} mapped nodes</div>
      <div className="world-map-hud bottom-right">
        {hoveredLocation
          ? `${hoveredLocation.name} (${isLocationAvailable(hoveredLocation.id) ? "available" : "locked"})`
          : "Hover a node for details"}
      </div>
    </div>
  );
}