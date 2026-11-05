import { readFileSync } from "node:fs";
import type { Station } from "./types.ts";

// Nearest OpenAQ reference station per cell. Mock mode reads mocks/station.json;
// the real OpenAQ v3 fetch is added once the key is set (OPENAQ_API_KEY).
export function loadStations(apiKey = process.env.OPENAQ_API_KEY ?? "mock"): Map<string, Station> {
  if (apiKey !== "mock" && apiKey !== "") {
    console.warn("[stations] real OpenAQ fetch not wired yet; using mocks/station.json");
  }
  const url = new URL("../mocks/station.json", import.meta.url);
  const raw = JSON.parse(readFileSync(url, "utf8")) as Record<string, Station>;
  return new Map(Object.entries(raw));
}
