import { Sequence } from 'remotion';
import { sec } from '../theme';
import { Fade } from './Footage';

interface ShotProps {
  window: readonly [number, number];
  /** Frames of dissolve at the head and tail. */
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}

/** A scene placed by its start and end in seconds, so the timeline file stays the one source of timing. */
export const Shot: React.FC<ShotProps> = ({ window: [from, to], fadeIn = 0, fadeOut = 0, children }) => (
  <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)} layout="none">
    <Fade inFrames={fadeIn} outFrames={fadeOut}>
      {children}
    </Fade>
  </Sequence>
);
