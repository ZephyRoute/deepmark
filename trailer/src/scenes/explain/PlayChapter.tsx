import { useCurrentFrame } from 'remotion';
import plan from '../../generated/run-plan.json';
import { MONO } from '../../fonts';
import { COLOR } from '../../theme';
import { ramp } from '../../motion';
import { ActionStrip } from '../../components/ActionStrip';
import { Footage } from '../../components/Footage';
import { Panel } from '../../components/Panel';
import { followCamera } from '../../camera';
import { SHOT90 } from '../../timeline';
import { Stage } from './Stage';

const WINDOW_W = 800;
const CAMERA = followCamera(980);

/** Chapter one: the game runs entirely in the browser, and each input is kept as a byte. */
export const PlayChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const shown = ramp(frame, 20, 52);
  const count = ramp(frame, 150, 190);
  return (
    <Stage
      step="01 · You play"
      heading="You play. Nothing waits."
      body={`Combat, camera and sound all run in your browser. Every input that changes the game is kept as one byte. This whole run is ${plan.actions.length} of them.`}
    >
      <div style={{ position: 'absolute', left: 0, top: 110, display: 'flex', flexDirection: 'column', gap: 26, opacity: shown, translate: `0 ${(1 - shown) * 20}px` }}>
        <Panel style={{ width: WINDOW_W, padding: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: '0.24em', color: COLOR.muted, textTransform: 'uppercase', padding: '2px 4px 12px' }}>Your browser</div>
          <div style={{ width: WINDOW_W - 28, height: ((WINDOW_W - 28) * 9) / 16, overflow: 'hidden', borderRadius: 10, position: 'relative' }}>
            <div style={{ width: 1920, height: 1080, scale: (WINDOW_W - 28) / 1920, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
              <Footage src="footage/run.mp4" from={SHOT90.playWindow.from} camera={CAMERA} />
            </div>
          </div>
        </Panel>
        <Panel style={{ width: WINDOW_W, padding: '20px 22px 22px' }} glow={`rgba(126,240,224,${0.12 * count})`}>
          <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: '0.24em', color: COLOR.cyan, textTransform: 'uppercase', paddingBottom: 14 }}>
            Action log · {plan.actions.length} bytes
          </div>
          <ActionStrip actions={plan.actions} columns={15} cell={46} every={0.085} start={1.2} />
        </Panel>
      </div>
    </Stage>
  );
};
