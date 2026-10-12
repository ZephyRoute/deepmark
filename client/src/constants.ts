/** Named timings and thresholds shared by the app layer and the chrome. Each value is in the unit its name says. */

/** The bar and the heartbeat both treat this share of max health as low. */
export const LOW_HEALTH_RATIO = 0.34;
export const HEARTBEAT_MS = 1100;

/** Waiting longer than this for the chain to open a run falls back to a practice run. */
export const START_TIMEOUT_MS = 50_000;
export const START_RETRIES = 3;
export const START_RETRY_MS = 6_000;
/** Starts that failed on chain because other players started in the same ledger are simulated again. */
export const START_CONTENTION_RETRIES = 4;
export const START_CONTENTION_BACKOFF_MS = 1_200;
/** Random spread added to the backoff so clashing players do not retry in lockstep. */
export const START_CONTENTION_JITTER_MS = 1_500;
/** A transient network failure while sending a start (or account setup) is retried this many times, with a growing, jittered wait. */
export const TRANSIENT_RETRIES = 3;
export const TRANSIENT_BACKOFF_MS = 900;
export const TRANSIENT_JITTER_MS = 700;
/** The descent scene says Stellar is slow after this long, and offers a practice run right away after the next. */
export const SLOW_NOTE_AFTER_MS = 6_000;
export const SKIP_OFFER_AFTER_MS = 9_000;
/** The stairs-open beat before the first floor appears, so the scene resolves instead of cutting. */
export const READY_HOLD_MS = 1400;
/** The practice fallback holds its notice a little longer so it can be read. */
export const OFFLINE_EXTRA_HOLD_MS = 600;
/** The scene always plays at least this long, so a fast network never shows a flash of it. */
export const MIN_SCENE_MS = 3200;

/** How many times a finished run's log is sent, waiting out the contract's minimum play time. */
export const VERIFY_ATTEMPTS = 6;
export const VERIFY_RETRY_MS = 6_000;

/** The leaderboard's own-row glow lasts this long after a run verifies. */
export const JUST_VERIFIED_MS = 4000;
/** The earned delver sting lands just after the seal strike. */
export const HERO_EARNED_DELAY_MS = 900;

export const LEADERBOARD_ROWS = 10;

/** Share buttons show their confirmation label this long. */
export const SHARE_FLASH_MS = 1600;
export const OBJECT_URL_REVOKE_MS = 2000;

/** Hovering Descend: the heartbeat starts slow and quickens by this factor down to a floor. */
export const DESCEND_BEAT_START_MS = 650;
export const DESCEND_BEAT_MIN_MS = 220;
export const DESCEND_BEAT_DECAY = 0.82;

/** The relic counter bumps this long after a core relic lands, in step with the chime. */
export const CORE_BUMP_DELAY_MS = 140;

/** The board backdrop painted when no world is drawn. */
export const BACKDROP_COLOR = '#07080e';

/** The id of the in-page field the player pastes a recovery code into. */
export const RESTORE_FIELD_ID = 'restore-code';
