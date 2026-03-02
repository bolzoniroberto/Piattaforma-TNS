import { create } from 'zustand'
import { api } from '../lib/api'
import type { Struttura, Dipendente, TabView, StrutturaCounts } from '../types'

interface OrgStore {
  activeTab: TabView
  setActiveTab: (tab: TabView) => void

  strutture: (Struttura & { dipendenti_count: number })[]
  dipendenti: Dipendente[]
  counts: StrutturaCounts | null

  loading: boolean
  setLoading: (v: boolean) => void

  toast: { message: string; type: 'success' | 'error' | 'warning' | 'info' } | null
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  clearToast: () => void

  refreshStrutture: (showDeleted?: boolean) => Promise<void>
  refreshDipendenti: (showDeleted?: boolean) => Promise<void>
  refreshCounts: () => Promise<void>
  refreshAll: () => Promise<void>
}

export const useOrgStore = create<OrgStore>((set, get) => ({
  activeTab: 'grid',
  setActiveTab: (tab) => set({ activeTab: tab }),

  strutture: [],
  dipendenti: [],
  counts: null,
  loading: false,

  setLoading: (v) => set({ loading: v }),

  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => get().clearToast(), 3500)
  },
  addToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => get().clearToast(), 3500)
  },
  clearToast: () => set({ toast: null }),

  refreshStrutture: async (showDeleted = false) => {
    const strutture = await api.strutture.list(showDeleted)
    set({ strutture })
  },

  refreshDipendenti: async (showDeleted = false) => {
    const dipendenti = await api.dipendenti.list(showDeleted)
    set({ dipendenti })
  },

  refreshCounts: async () => {
    const counts = await api.stats.counts()
    set({ counts })
  },

  refreshAll: async () => {
    set({ loading: true })
    try {
      const [strutture, dipendenti, counts] = await Promise.all([
        api.strutture.list(false),
        api.dipendenti.list(false),
        api.stats.counts()
      ])
      set({ strutture, dipendenti, counts })
    } finally {
      set({ loading: false })
    }
  }
}))
