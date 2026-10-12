import { AbsoluteFill, Img, random, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR } from '../theme';

/** Film grain: one noise tile, jumped to a new offset every frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.1 }) => {
  const frame = useCurrentFrame();
  const x = Math.floor(random(`grain-x-${frame}`) * 512);
  const y = Math.floor(random(`grain-y-${frame}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('fx/grain.png')})`,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: 'overlay',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.7 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 38%, rgba(3,4,8,${strength}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

interface EmbersProps {
  count?: number;
  /** 0 to 1, multiplies brightness so embers can swell with the music. */
  intensity?: number;
  seed?: string;
}

/** Slow rising sparks. Every value is a pure function of the frame, so renders match. */
export const Embers: React.FC<EmbersProps> = ({ count = 46, intensity = 1, seed = 'embers' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string): number => random(`${seed}-${i}-${k}`);
        const speed = 26 + r('speed') * 62;
        const travel = height + 120;
        const y = height + 60 - ((t * speed + r('phase') * travel) % travel);
        const sway = Math.sin(t * (0.5 + r('sway') * 1.1) + r('swayphase') * 6.28) * (14 + r('amp') * 40);
        const x = r('x') * width + sway;
        const size = 2 + r('size') * 5;
        const flicker = 0.55 + 0.45 * Math.sin(t * (2 + r('f') * 5) + r('fp') * 6.28);
        const warm = r('hue') > 0.35;
        const color = warm ? '255,190,96' : '126,240,224';
        const edge = Math.min(1, Math.max(0, y / 160), Math.max(0, (height - y) / 120));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `rgba(${color},${0.9 * flicker * intensity * edge})`,
              boxShadow: `0 0 ${size * 4}px ${size}px rgba(${color},${0.35 * flicker * intensity * edge})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** A single bright frame, for hard cuts that should feel struck, not swapped. */
export const Flash: React.FC<{ frames?: number; color?: string; peak?: number }> = ({ frames = 6, color = COLOR.cyan, peak = 0.55 }) => {
  const frame = useCurrentFrame();
  if (frame >= frames) return null;
  const opacity = peak * (1 - frame / frames) ** 2;
  return <AbsoluteFill style={{ background: color, opacity, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};

/** Painted image, full bleed, with a camera push. */
export const PaintedPlate: React.FC<{
  src: string;
  from?: number;
  to?: number;
  drift?: [number, number];
  brightness?: number;
}> = ({ src, from = 1, to = 1.12, drift = [0, 0], brightness = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames - 1);
  const scale = from + (to - from) * p;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: COLOR.bg }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          scale,
          translate: `${drift[0] * p}px ${drift[1] * p}px`,
          filter: `brightness(${brightness})`,
        }}
      />
    </AbsoluteFill>
  );
};
