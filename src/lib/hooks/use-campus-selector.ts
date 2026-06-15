'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CampusOption {
  id: string
  name: string
  city?: string | null
}

interface CampusSelectorStore {
  /** Selected campus for global roles. null = all campuses */
  selectedCampusId: string | null
  selectedCampusName: string | null
  campusList: CampusOption[]

  setSelectedCampus: (id: string | null, name?: string | null) => void
  setCampusList: (list: CampusOption[]) => void
  clearSelection: () => void
}

export const useCampusSelector = create<CampusSelectorStore>()(
  persist(
    (set) => ({
      selectedCampusId: null,
      selectedCampusName: null,
      campusList: [],

      setSelectedCampus: (id, name) =>
        set({
          selectedCampusId: id,
          selectedCampusName: name ?? null,
        }),

      setCampusList: (list) => set({ campusList: list }),

      clearSelection: () =>
        set({ selectedCampusId: null, selectedCampusName: null }),
    }),
    {
      name: 'arm-merch-campus-selector',
      partialize: (state) => ({
        selectedCampusId: state.selectedCampusId,
        selectedCampusName: state.selectedCampusName,
      }),
    }
  )
)
