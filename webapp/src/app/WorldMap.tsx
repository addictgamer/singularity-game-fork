import { LocationDef } from "../engine/types";

interface WorldMapProps {
  locations: LocationDef[];
  selectedLocationId: string;
  isLocationAvailable: (locationId: string) => boolean;
  onSelect: (locationId: string) => void;
}

export function WorldMap({
  locations,
  selectedLocationId,
  isLocationAvailable,
  onSelect,
}: WorldMapProps) {
  const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="world-map" role="group" aria-label="World map locations">
      <div className="world-map-day-band" />
      <div className="world-map-night-band" />

      {sorted.map((location) => {
        const available = isLocationAvailable(location.id);
        const selected = location.id === selectedLocationId;

        return (
          <button
            key={location.id}
            className={`map-location ${selected ? "selected" : ""} ${available ? "available" : "locked"}`}
            style={{ left: `${location.position.x}%`, top: `${location.position.y}%` }}
            onClick={() => onSelect(location.id)}
            aria-pressed={selected}
            title={`${location.name} (${available ? "available" : "locked"})`}
          >
            <span className="map-location-dot" aria-hidden="true" />
            <span className="map-location-label">{location.name}</span>
          </button>
        );
      })}
    </div>
  );
}