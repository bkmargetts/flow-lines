import { ImageControls } from '../../components/ImageControls';
import { useImageInk } from './context';

/** Sidebar controls for the Image → Ink project, wired to its context. */
export function ImageInkControls() {
  const ink = useImageInk();
  return (
    <ImageControls
      settings={ink.settings}
      imageName={ink.imageName}
      preset={ink.preset}
      applyPreset={ink.applyPreset}
      updateSettings={ink.updateSettings}
      onImageFile={ink.onImageFile}
      randomizeSeed={ink.randomizeSeed}
      downloadSVG={ink.downloadSVG}
      focusPoints={ink.focusPoints}
      clearFocus={ink.clearFocus}
      subjectMask={ink.subjectMask}
      segmentStatus={ink.segmentStatus}
      isolateSubject={ink.isolateSubject}
      clearSubjectMask={ink.clearSubjectMask}
      portraitState={ink.portraitState}
      portraitStatus={ink.portraitStatus}
      detectFaces={ink.detectFaces}
      clearPortrait={ink.clearPortrait}
      depthMap={ink.depthMap}
      depthStatus={ink.depthStatus}
      depthError={ink.depthError}
      estimateDepthMap={ink.estimateDepthMap}
      clearDepth={ink.clearDepth}
      labelMap={ink.labelMap}
      labelStatus={ink.labelStatus}
      labelError={ink.labelError}
      estimateSceneLabels={ink.estimateSceneLabels}
      clearLabels={ink.clearLabels}
      lowMemory={ink.lowMemory}
      disableLowMemory={ink.disableLowMemory}
    />
  );
}
