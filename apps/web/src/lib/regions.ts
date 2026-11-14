/** Region-specific map view parameters. */
export const REGION_MAP_CONFIG: Record<string, { center: [number, number]; zoom: number; bounds?: [[number, number], [number, number]] }> = {
  austria: { center: [14.2, 47.6], zoom: 5.3, bounds: [[9.5, 46.3], [17.2, 49.1]] },
  germany: { center: [10.5, 51.2], zoom: 4.8, bounds: [[5.8, 47.3], [15.1, 55.1]] },
  france: { center: [2.5, 46.5], zoom: 4.6, bounds: [[-5.2, 41.3], [9.6, 51.1]] },
  italy: { center: [12.5, 42.5], zoom: 4.8, bounds: [[6.6, 35.5], [18.5, 47.1]] },
  united_kingdom: { center: [-2.0, 54.0], zoom: 4.8, bounds: [[-8.7, 49.9], [1.8, 58.7]] },
  united_states: { center: [-98.0, 39.5], zoom: 3.0, bounds: [[-125.0, 24.5], [-66.9, 49.4]] },
  spain: { center: [-3.5, 40.0], zoom: 4.7, bounds: [[-9.5, 36.0], [3.3, 43.8]] },
  poland: { center: [19.5, 52.0], zoom: 4.8, bounds: [[14.1, 49.0], [24.2, 54.8]] },
  netherlands: { center: [5.3, 52.2], zoom: 6.0, bounds: [[3.2, 50.7], [7.2, 53.6]] },
  belgium: { center: [4.5, 50.6], zoom: 5.8, bounds: [[2.5, 49.5], [6.4, 51.5]] },
};

export function getRegionMapConfig(regionId: string) {
  return REGION_MAP_CONFIG[regionId] ?? REGION_MAP_CONFIG.austria;
}