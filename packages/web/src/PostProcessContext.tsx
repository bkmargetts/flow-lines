import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Pen-plotting post-processing, shared by every project tab. Density protection
 * caps how many pen passes pile onto the same patch of paper: a little overlap
 * builds texture, but too much inflates plot time and breaks the surface down.
 * Off by default so output is unchanged until a user opts in; lifted out of any
 * one project so the setting (and the consolidated download controls beside it)
 * are consistent across tools.
 */
export interface DensitySettings {
  /** Off → output untouched. */
  enabled: boolean;
  /** Max overlapping passes a patch may take before further strokes are dropped. */
  maxPasses: number;
}

export interface PostProcessSettings {
  density: DensitySettings;
}

export const defaultPostProcess: PostProcessSettings = {
  density: { enabled: false, maxPasses: 3 },
};

interface PostProcessContextValue {
  post: PostProcessSettings;
  updateDensity: (updates: Partial<DensitySettings>) => void;
}

const PostProcessContext = createContext<PostProcessContextValue | null>(null);

export function PostProcessProvider({ children }: { children: ReactNode }) {
  const [post, setPost] = useState<PostProcessSettings>(defaultPostProcess);
  const updateDensity = useCallback((updates: Partial<DensitySettings>) => {
    setPost((prev) => ({ ...prev, density: { ...prev.density, ...updates } }));
  }, []);
  return (
    <PostProcessContext.Provider value={{ post, updateDensity }}>
      {children}
    </PostProcessContext.Provider>
  );
}

export function usePostProcess(): PostProcessContextValue {
  const ctx = useContext(PostProcessContext);
  if (!ctx) throw new Error('usePostProcess must be used within a PostProcessProvider');
  return ctx;
}
