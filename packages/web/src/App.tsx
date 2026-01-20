import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FlowLinesPage } from './pages/techniques/FlowLinesPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Flow Lines is the main/default view */}
        <Route path="/" element={<FlowLinesPage />} />
        <Route path="/techniques/flow-lines" element={<FlowLinesPage />} />

        {/* 404 fallback to main */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

// Re-export types and constants from FlowLinesPage for backward compatibility
export type { BrushType, DensityBrushType, AppState, PresetName } from './pages/techniques/FlowLinesPage';
export { FIELD_PRESETS } from './pages/techniques/FlowLinesPage';
