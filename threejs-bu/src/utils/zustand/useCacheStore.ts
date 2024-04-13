import { create } from 'zustand'

interface CacheState {
    caches: Record<string, Blob>;
    setCaches: (name: string, file: Blob) => void;
}

export const useCacheStore = create<CacheState>()((set) => ({
    caches: {},
    setCaches(name, file) {
        set((state) => ({
            caches: {
                ...state.caches,
                [name]: file
            }
        }))
    },
}))