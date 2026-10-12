import { Composition } from 'remotion';
import { FPS, HEIGHT, WIDTH, sec } from './theme';
import { T30, T90 } from './timeline';
import { Trailer30 } from './compositions/Trailer30';
import { Trailer90 } from './compositions/Trailer90';
import { CARD_FRAMES, CARD_HEIGHT, CARD_WIDTH, ShareCardAnimated } from './compositions/ShareCardAnimated';

export const Root: React.FC = () => (
  <>
    <Composition id="Trailer30" component={Trailer30} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={sec(T30.total)} />
    <Composition id="Trailer90" component={Trailer90} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={sec(T90.total)} />
    <Composition id="ShareCard" component={ShareCardAnimated} width={CARD_WIDTH} height={CARD_HEIGHT} fps={FPS} durationInFrames={CARD_FRAMES} />
  </>
);
