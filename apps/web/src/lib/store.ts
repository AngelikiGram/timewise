import type { HistoricalEvent } from "@timewise/historical-schemas";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Comparison modes for the Time Microscope */
export type ComparisonMode = "single" | "split" | "swipe" | "then-now";

/** Evidence↔Reconstruction mode */
export type EvidenceMode = "documented" | "inferred" | "reconstructed";

/** The one source of truth that narrative, map, timeline and evidence all read from. */
type AtlasState = {
  allEvents: HistoricalEvent[];
  selectedId: string | null;
  date: string;
  themes: string[];
  playing: boolean;
  /** Timeline search text. It marks matches and leaves the other records in place. */
  highlight: string;
  layers: { boundaries: boolean; routes: boolean; urban: boolean; points: boolean };
  boundaryOpacity: number;
  setHighlight: (text: string) => void;
  toggleLayer: (layer: keyof AtlasState["layers"]) => void;
  setBoundaryOpacity: (opacity: number) => void;
  init: (events: HistoricalEvent[], date: string) => void;
  selectEvent: (id: string) => void;
  scrubTo: (date: string) => void;
  step: (delta: number) => void;
  toggleTheme: (id: string) => void;
  setThemes: (ids: string[]) => void;
  setPlaying: (playing: boolean) => void;

  // Time Microscope state
  comparisonMode: ComparisonMode;
  comparisonDate: string | null; // Second date for split/swipe/then-now
  setComparisonMode: (mode: ComparisonMode) => void;
  setComparisonDate: (date: string | null) => void;

  // Evidence↔Reconstruction mode
  evidenceMode: EvidenceMode;
  setEvidenceMode: (mode: EvidenceMode) => void;

  // Place DNA / What Changed Here
  selectedPlaceId: string | null;
  setSelectedPlaceId: (id: string | null) => void;

  // URL persistence
  syncToUrl: () => void;
  hydrateFromUrl: () => void;
};

export const visibleEvents = (events: HistoricalEvent[], themes: string[]) =>
  themes.length ? events.filter((e) => e.themes.some((t) => themes.includes(t))) : events;

export const useAtlas = create<AtlasState>()(
  persist(
    (set, get) => ({
      allEvents: [],
      selectedId: null,
      date: "",
      themes: [],
      playing: false,
      highlight: "",
      layers: { boundaries: true, routes: true, urban: true, points: true },
      boundaryOpacity: 0.22,
      setHighlight: (highlight) => set({ highlight }),
      toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
      setBoundaryOpacity: (boundaryOpacity) => set({ boundaryOpacity }),
      init: (events, date) => set({ allEvents: events, date }),
      selectEvent: (id) => {
        const event = get().allEvents.find((e) => e.id === id);
        if (event) set({ selectedId: id, date: event.when.start });
      },
      // Moving the date also moves the selection, so evidence never lags the timeline.
      scrubTo: (date) => {
        const { allEvents, themes } = get();
        const past = visibleEvents(allEvents, themes).filter((e) => e.when.start <= date);
        set({ date, selectedId: past.length ? past[past.length - 1].id : null });
      },
      step: (delta) => {
        const { allEvents, themes, selectedId, selectEvent } = get();
        const list = visibleEvents(allEvents, themes);
        if (!list.length) return;
        const i = list.findIndex((e) => e.id === selectedId);
        const next = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + delta));
        selectEvent(list[next].id);
      },
      toggleTheme: (id) => {
        const themes = get().themes.includes(id) ? get().themes.filter((t) => t !== id) : [...get().themes, id];
        get().setThemes(themes);
      },
      setThemes: (themes) => {
        const { allEvents, selectedId } = get();
        const list = visibleEvents(allEvents, themes);
        // A filter must not leave evidence showing for an event that's no longer listed.
        if (selectedId && !list.some((e) => e.id === selectedId)) {
          const first = list[0];
          set({ themes, selectedId: first?.id ?? null, date: first?.when.start ?? get().date });
        } else set({ themes });
      },
      setPlaying: (playing) => set({ playing }),

      // Time Microscope state
      comparisonMode: "single",
      comparisonDate: null,
      setComparisonMode: (comparisonMode) => set({ comparisonMode }),
      setComparisonDate: (comparisonDate) => set({ comparisonDate }),

      // Evidence↔Reconstruction mode
      evidenceMode: "documented",
      setEvidenceMode: (evidenceMode) => set({ evidenceMode }),

      // Place DNA / What Changed Here
      selectedPlaceId: null,
      setSelectedPlaceId: (selectedPlaceId) => set({ selectedPlaceId }),

      // URL persistence
      syncToUrl: () => {
        if (typeof window === "undefined") return;
        const state = get();
        const params = new URLSearchParams();
        if (state.selectedId) params.set("event", state.selectedId);
        if (state.date) params.set("date", state.date);
        if (state.themes.length) params.set("themes", state.themes.join(","));
        if (state.comparisonMode !== "single") params.set("mode", state.comparisonMode);
        if (state.comparisonDate) params.set("compare", state.comparisonDate);
        if (state.evidenceMode !== "documented") params.set("evidence", state.evidenceMode);
        if (state.selectedPlaceId) params.set("place", state.selectedPlaceId);
        const url = new URL(window.location.href);
        url.search = params.toString();
        window.history.replaceState(null, "", url);
      },
      hydrateFromUrl: () => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const event = params.get("event");
        const date = params.get("date");
        const themes = params.get("themes")?.split(",").filter(Boolean) ?? [];
        const mode = params.get("mode") as ComparisonMode | null;
        const compare = params.get("compare");
        const evidence = params.get("evidence") as EvidenceMode | null;
        const place = params.get("place");
        if (event) set({ selectedId: event });
        if (date) set({ date });
        if (themes.length) set({ themes });
        if (mode) set({ comparisonMode: mode });
        if (compare) set({ comparisonDate: compare });
        if (evidence) set({ evidenceMode: evidence });
        if (place) set({ selectedPlaceId: place });
      },
    }),
    {
      name: "timewise-atlas",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themes: state.themes,
        comparisonMode: state.comparisonMode,
        comparisonDate: state.comparisonDate,
        evidenceMode: state.evidenceMode,
        selectedPlaceId: state.selectedPlaceId,
        layers: state.layers,
        boundaryOpacity: state.boundaryOpacity,
      }),
    }
  )
);
