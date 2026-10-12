import { Video } from '@remotion/media';
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR, HEIGHT, WIDTH, sec } from '../theme';
import { SMOOTH, ramp, sceneFade } from '../motion';

/** A window onto the 1920 by 1080 layout of the recorded game, in layout pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The playable board of the game, with the HUD, header and prompts cropped out. */
export const BOARD: Rect = { x: 288, y: 146, w: 1344, h: 756 };

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

interface FootageProps {
  /** File under public/footage. */
  src: string;
  /** Where in the recording this shot starts, in seconds. */
  from: number;
  rect?: Rect;
  /** A second window to travel to over the length of the shot. */
  rectTo?: Rect;
  /** A camera that is a function of the recording's time. Overrides `rect`. */
  camera?: (t: number) => Rect;
  /** Plays the recording faster or slower. */
  rate?: number;
  grade?: boolean;
}

/**
 * One shot of real gameplay. The recording is 4K, the window crops it to 16:9
 * and an optional second window turns the crop into a slow camera move.
 */
export const Footage: React.FC<FootageProps> = ({ src, from, rect, rectTo, camera, rate = 1, grade = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = rectTo ? ramp(frame, 0, durationInFrames, SMOOTH) : 0;
  const target = rectTo ?? rect ?? BOARD;
  const base = rect ?? BOARD;
  const moved = camera ? camera(from + (frame / fps) * rate) : null;
  const w = moved ? moved.w : lerp(base.w, target.w, p);
  const x = moved ? moved.x : lerp(base.x, target.x, p);
  const y = moved ? moved.y : lerp(base.y, target.y, p);
  const scale = WIDTH / w;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: COLOR.bg }}>
      <Video
        src={staticFile(src)}
        trimBefore={sec(from)}
        playbackRate={rate}
        muted
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: WIDTH,
          height: HEIGHT,
          transformOrigin: '0 0',
          scale,
          translate: `${-x * scale}px ${-y * scale}px`,
          filter: grade ? 'contrast(1.12) saturate(1.22) brightness(1.04)' : undefined,
        }}
      />
    </AbsoluteFill>
  );
};

interface FadeProps {
  children: React.ReactNode;
  inFrames?: number;
  outFrames?: number;
}

/** Fades a whole scene, so two overlapping Sequences read as a dissolve. */
export const Fade: React.FC<FadeProps> = ({ children, inFrames = 0, outFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: sceneFade(frame, durationInFrames, inFrames, outFrames) }}>{children}</AbsoluteFill>;
};

export { interpolate };
