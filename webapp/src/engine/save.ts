import { GameData, SerializedGameState } from "./types";
import { GameState } from "./game";

export function exportGameToJson(game: GameState): string {
  return JSON.stringify(game.serialize(), null, 2);
}

export function importGameFromJson(data: GameData, json: string): GameState {
  const parsed = JSON.parse(json) as SerializedGameState;
  return GameState.deserialize(data, parsed);
}