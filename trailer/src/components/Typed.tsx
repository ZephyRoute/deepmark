import { useCurrentFrame, useVideoConfig } from 'remotion';
import { MONO } from '../fonts';
import { COLOR } from '../theme';

/** Types a line out, one character every `cps` characters per second, with a caret while it works. */
export const Typed: React.FC<{ text: string; start?: number; cps?: number; color?: string; size?: number }> = ({
  text,
  start = 0,
  cps = 38,
  color = COLOR.text,
  size = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = Math.max(0, Math.min(text.length, Math.floor(((frame / fps) - start) * cps)));
  const typing = count < text.length && frame / fps >= start;
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={{ fontFamily: MONO, fontSize: size, color, whiteSpace: 'pre' }}>
      {text.slice(0, count)}
      <span style={{ opacity: typing || (count === text.length && caret) ? 1 : 0, color: COLOR.cyan }}>{count < text.length || caret ? '▌' : ''}</span>
    </span>
  );
};
