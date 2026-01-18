interface PreviewProps {
  svgContent: string;
  width: number;
  height: number;
}

export function Preview({ svgContent, width, height }: PreviewProps) {
  // Calculate max dimensions to fit in viewport while maintaining aspect ratio
  const maxWidth = Math.min(width, 800);
  const maxHeight = Math.min(height, 800);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  return (
    <div
      className="canvas-wrapper"
      style={{
        width: displayWidth,
        height: displayHeight,
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
