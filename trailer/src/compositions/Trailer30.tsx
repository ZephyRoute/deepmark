import { AbsoluteFill, Sequence } from 'remotion';
import { Audio } from '@remotion/media';
import { staticFile } from 'remotion';
import { COLOR, sec } from '../theme';
import { SHOT30, T30 } from '../timeline';
import { BossBanner } from '../scenes/BossBanner';
import { Footage, type Rect } from '../components/Footage';
import { followCamera } from '../camera';
import { Shot } from '../components/Shot';
import { Embers, Flash, Grain, Vignette } from '../components/Atmosphere';
import { Title } from '../components/Type';
import { Hook } from '../scenes/Hook';
import { EndCard } from '../scenes/EndCard';

const CAMERA = followCamera(820);
const DESCENT: Rect = { x: 221, y: 90, w: 1477, h: 831 };
const DESCENT_PUSH: Rect = { x: 360, y: 180, w: 1200, h: 675 };
/** Interface shots keep the card right of centre and leave the left third of the painting for the caption. */
const CARD_WIDE: Rect = { x: 0, y: 90, w: 1500, h: 844 };
const CARD_PUSH: Rect = { x: 70, y: 140, w: 1340, h: 754 };
const VAULT_WIDE: Rect = { x: 0, y: 40, w: 1500, h: 844 };
const VAULT_PUSH: Rect = { x: 50, y: 90, w: 1360, h: 765 };

export const Trailer30: React.FC = () => (
  <AbsoluteFill style={{ background: COLOR.bg }}>
    <Audio src={staticFile('audio/score-30.wav')} />

    <Shot window={T30.hook} fadeOut={sec(0.4)}>
      <Hook />
    </Shot>

    <Shot window={T30.descent} fadeIn={sec(0.4)} fadeOut={sec(0.1)}>
      <Footage src="footage/descent.mp4" from={1.2} rect={DESCENT} rectTo={DESCENT_PUSH} />
      <Embers count={30} intensity={0.7} seed="descent" />
    </Shot>

    <Shot window={T30.fight1}>
      <Footage src="footage/run.mp4" from={SHOT30.fight1.from} camera={CAMERA} />
      <Sequence durationInFrames={8}>
        <Flash peak={0.4} />
      </Sequence>
    </Shot>

    <Shot window={T30.fight2}>
      <Footage src="footage/run.mp4" from={SHOT30.fight2.from} camera={CAMERA} />
      <Sequence durationInFrames={8}>
        <Flash peak={0.4} />
      </Sequence>
      <Sequence from={sec(0.5)} durationInFrames={sec(2.1)}>
        <Title at="lower" size={60}>Every guard is a gamble.</Title>
      </Sequence>
    </Shot>

    <Shot window={T30.bossBanner}>
      <BossBanner />
    </Shot>

    <Shot window={T30.bossFight}>
      <Footage src="footage/run.mp4" from={SHOT30.bossFight.from} camera={CAMERA} />
      <Sequence durationInFrames={8}>
        <Flash peak={0.4} color={COLOR.gold} />
      </Sequence>
    </Shot>

    <Shot window={T30.extract} fadeOut={sec(0.35)}>
      <Footage src="footage/run.mp4" from={SHOT30.extract.from} camera={CAMERA} />
      <Sequence from={sec(0.4)} durationInFrames={sec(2.2)}>
        <Title at="lower" size={60} color={COLOR.danger}>One hit point left.</Title>
      </Sequence>
    </Shot>

    <Shot window={T30.sealed} fadeIn={sec(0.35)} fadeOut={sec(0.3)}>
      <Footage src="footage/sealed.mp4" from={SHOT30.sealed.from} rect={CARD_WIDE} rectTo={CARD_PUSH} />
      <Sequence from={sec(0.4)} durationInFrames={sec(3.6)}>
        <Title at="left" size={76}>A result no one can forge.</Title>
      </Sequence>
    </Shot>

    <Shot window={T30.vault} fadeIn={sec(0.3)} fadeOut={sec(0.3)}>
      <Footage src="footage/vault.mp4" from={SHOT30.vault.from} rect={VAULT_WIDE} rectTo={VAULT_PUSH} />
      <Sequence from={sec(0.3)} durationInFrames={sec(1.9)}>
        <Title at="left" size={70}>Clear every floor and the delver is yours.</Title>
      </Sequence>
    </Shot>

    <Shot window={T30.end} fadeIn={sec(0.2)}>
      <EndCard tagline="When do you leave?" note="Live on Stellar testnet" />
    </Shot>

    <Vignette strength={0.45} />
    <Grain opacity={0.07} />
  </AbsoluteFill>
);
