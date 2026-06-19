import { ImageControls } from '../../components/ImageControls';
import type { ControlsProps } from '../../modules/types';
import { useInstanceApi } from './instance-store';
import { PRESETS, type InkSettings, type ImageInkLayerState } from './types';

/**
 * Sidebar controls for an Image → Ink layer. Settings/preset come from the
 * layer state (props); the live photo/ML surface comes from the instance's
 * published API, looked up by instanceId. Download buttons are gone — SVG
 * export is the frame/compositor's job now.
 */
export function ImageInkControls({
  state,
  update,
  instanceId,
}: ControlsProps<ImageInkLayerState>) {
  const api = useInstanceApi(instanceId);

  const updateSettings = (updates: Partial<InkSettings>) =>
    update((s) => ({ settings: { ...s.settings, ...updates } }));

  const applyPreset = (name: string) => {
    const def = PRESETS[name];
    if (!def) return;
    update((s) => ({ preset: name, settings: { ...s.settings, ...def.settings } }));
  };

  // The instance hasn't mounted/registered yet (the layer's hook publishes its
  // API on mount); render nothing until it has.
  if (!api) return null;

  return (
    <ImageControls
      settings={state.settings}
      imageName={api.imageName}
      preset={state.preset}
      applyPreset={applyPreset}
      updateSettings={updateSettings}
      onImageFile={api.onImageFile}
      randomizeSeed={api.randomizeSeed}
      focusPoints={api.focusPoints}
      clearFocus={api.clearFocus}
      subjectMask={api.subjectMask}
      segmentStatus={api.segmentStatus}
      isolateSubject={api.isolateSubject}
      clearSubjectMask={api.clearSubjectMask}
      portraitState={api.portraitState}
      portraitStatus={api.portraitStatus}
      detectFaces={api.detectFaces}
      clearPortrait={api.clearPortrait}
      depthMap={api.depthMap}
      depthStatus={api.depthStatus}
      depthError={api.depthError}
      estimateDepthMap={api.estimateDepthMap}
      clearDepth={api.clearDepth}
      labelMap={api.labelMap}
      labelStatus={api.labelStatus}
      labelError={api.labelError}
      estimateSceneLabels={api.estimateSceneLabels}
      clearLabels={api.clearLabels}
      lowMemory={api.lowMemory}
      disableLowMemory={api.disableLowMemory}
    />
  );
}
