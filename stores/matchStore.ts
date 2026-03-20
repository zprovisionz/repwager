import { create } from 'zustand';
import type { Match } from '@/types/database';

interface ActiveMatch {
  match: Match;
  myReps: number;
  opponentReps: number;
  timeLeft: number;
  isRunning: boolean;
}

interface MatchState {
  activeMatch: ActiveMatch | null;
  pendingMatches: Match[];
  completedMatches: Match[];
  setActiveMatch: (match: Match | null) => void;
  updateMyReps: (reps: number) => void;
  updateOpponentReps: (reps: number) => void;
  setTimeLeft: (time: number) => void;
  setRunning: (running: boolean) => void;
  setPendingMatches: (matches: Match[]) => void;
  setCompletedMatches: (matches: Match[]) => void;
  updateMatch: (match: Match) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  activeMatch: null,
  pendingMatches: [],
  completedMatches: [],

  setActiveMatch: (match) =>
    set({
      activeMatch: match
        ? { match, myReps: 0, opponentReps: 0, timeLeft: match.duration_seconds, isRunning: false }
        : null,
    }),

  updateMyReps: (reps) =>
    set((state) => ({
      activeMatch: state.activeMatch ? { ...state.activeMatch, myReps: reps } : null,
    })),

  updateOpponentReps: (reps) =>
    set((state) => ({
      activeMatch: state.activeMatch ? { ...state.activeMatch, opponentReps: reps } : null,
    })),

  setTimeLeft: (timeLeft) =>
    set((state) => ({
      activeMatch: state.activeMatch ? { ...state.activeMatch, timeLeft } : null,
    })),

  setRunning: (isRunning) =>
    set((state) => ({
      activeMatch: state.activeMatch ? { ...state.activeMatch, isRunning } : null,
    })),

  setPendingMatches: (pendingMatches) => set({ pendingMatches }),
  setCompletedMatches: (completedMatches) => set({ completedMatches }),

  updateMatch: (updatedMatch) =>
    set((state) => ({
      pendingMatches: state.pendingMatches.map((m) =>
        m.id === updatedMatch.id ? updatedMatch : m
      ),
      activeMatch:
        state.activeMatch?.match.id === updatedMatch.id
          ? { ...state.activeMatch, match: updatedMatch }
          : state.activeMatch,
    })),

  reset: () => set({ activeMatch: null, pendingMatches: [], completedMatches: [] }),
}));
