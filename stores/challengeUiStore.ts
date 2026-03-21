import { create } from 'zustand';

/** FAB centre button: cyan = casual/default, amber = wager creation flow */
export type FabTone = 'cyan' | 'amber';

interface ChallengeUiState {
  fabTone: FabTone;
  setFabTone: (tone: FabTone) => void;
}

export const useChallengeUiStore = create<ChallengeUiState>((set) => ({
  fabTone: 'cyan',
  setFabTone: (tone) => set({ fabTone: tone }),
}));
