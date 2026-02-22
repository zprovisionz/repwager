/*
  League Store (Zustand)

  Global state management for league system:
  - User's leagues (cached)
  - Current selected league
  - Loading state
  - Prestige (level, title, badges)
*/

import { create } from 'zustand';
import {
  getUserLeagues,
  getLeagueDetail,
  getLeaguePrestige,
  type League,
} from '@/services/leagueTournament.service';

interface LeaguePrestige {
  level: number;
  title: string;
  badges: string[];
}

interface LeagueStoreState {
  // Data
  myLeagues: League[];
  currentLeague: League | null;
  prestige: { [leagueId: string]: LeaguePrestige };

  // Loading
  loading: boolean;
  loadingPrestige: boolean;

  // Actions
  fetchMyLeagues: (userId: string) => Promise<void>;
  setCurrentLeague: (league: League | null) => void;
  loadLeagueDetail: (leagueId: string) => Promise<void>;
  loadPrestige: (userId: string, leagueId: string) => Promise<void>;
  refreshLeagues: (userId: string) => Promise<void>;
}

export const useLeagueStore = create<LeagueStoreState>((set, get) => ({
  // Initial state
  myLeagues: [],
  currentLeague: null,
  prestige: {},
  loading: false,
  loadingPrestige: false,

  // Fetch user's leagues
  fetchMyLeagues: async (userId: string) => {
    try {
      set({ loading: true });
      const leagues = await getUserLeagues(userId);
      set({ myLeagues: leagues, loading: false });
    } catch (error) {
      console.error('[LeagueStore] fetchMyLeagues error:', error);
      set({ loading: false });
    }
  },

  // Set current league for viewing
  setCurrentLeague: (league: League | null) => {
    set({ currentLeague: league });
  },

  // Load full league detail
  loadLeagueDetail: async (leagueId: string) => {
    try {
      set({ loading: true });
      const league = await getLeagueDetail(leagueId);
      if (league) {
        set({ currentLeague: league, loading: false });
      }
    } catch (error) {
      console.error('[LeagueStore] loadLeagueDetail error:', error);
      set({ loading: false });
    }
  },

  // Load prestige (level, title, badges)
  loadPrestige: async (userId: string, leagueId: string) => {
    try {
      set({ loadingPrestige: true });
      const prestige = await getLeaguePrestige(userId, leagueId);
      if (prestige) {
        set((state) => ({
          prestige: { ...state.prestige, [leagueId]: prestige },
          loadingPrestige: false,
        }));
      }
    } catch (error) {
      console.error('[LeagueStore] loadPrestige error:', error);
      set({ loadingPrestige: false });
    }
  },

  // Refresh all data
  refreshLeagues: async (userId: string) => {
    await get().fetchMyLeagues(userId);
  },
}));
