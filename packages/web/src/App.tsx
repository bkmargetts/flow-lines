import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TechniquesPage } from './pages/techniques';
import { FlowLinesPage } from './pages/techniques/FlowLinesPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Redirect root to techniques */}
        <Route path="/" element={<Navigate to="/techniques" replace />} />

        {/* Techniques list */}
        <Route path="/techniques" element={<TechniquesPage />} />

        {/* Flow Lines technique */}
        <Route path="/techniques/flow-lines" element={<FlowLinesPage />} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/techniques" replace />} />
      </Routes>
    </HashRouter>
  );
}

// Re-export types and constants from FlowLinesPage for backward compatibility
export type { BrushType, DensityBrushType, AppState, PresetName } from './pages/techniques/FlowLinesPage';
export { FIELD_PRESETS } from './pages/techniques/FlowLinesPage';
