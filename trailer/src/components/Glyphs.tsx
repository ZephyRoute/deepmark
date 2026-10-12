import { COLOR } from '../theme';

/** The eight inputs the contract replays, one byte each. Matches `ActionCode` in the game. */
export const ACTION_NAMES = ['up', 'down', 'left', 'right', 'attack', 'retreat', 'descend', 'extract'] as const;

const ARROW = 'M12 4 L19 13 H14 V20 H10 V13 H5 Z';

export const ActionGlyph: React.FC<{ code: number; size?: number; color?: string }> = ({ code, size = 28, color = COLOR.text }) => {
  const rotation = [0, 180, -90, 90][code];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      {rotation !== undefined && <path d={ARROW} fill={color} fillOpacity={0.18} transform={`rotate(${rotation} 12 12)`} />}
      {code === 4 && (
        <>
          <path d="M19 5 L9 15" strokeWidth={2.6} />
          <path d="M6.5 13.5 L10.5 17.5" />
          <path d="M8.2 15.8 L5 19" />
        </>
      )}
      {code === 5 && <path d="M9 7 L4 12 L9 17 M4 12 H17 C19 12 20 13 20 15" />}
      {code === 6 && <path d="M6 6 L12 12 L18 6 M6 12 L12 18 L18 12" />}
      {code === 7 && <path d="M5 20 V5 H19 V20 M12 17 V9 M8.5 12.5 L12 9 L15.5 12.5" />}
    </svg>
  );
};

/** The seal the game shows when a run verifies: a triangle with an eye. */
export const Seal: React.FC<{ size?: number; color?: string }> = ({ size = 96, color = COLOR.gold }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
    <path d="M32 6 L58 54 H6 Z" fill={color} fillOpacity={0.08} />
    <path d="M32 15 L50 48 H14 Z" strokeOpacity={0.55} />
    <ellipse cx="32" cy="38" rx="9" ry="5.5" />
    <circle cx="32" cy="38" r="2.6" fill={color} />
  </svg>
);

export const Lock: React.FC<{ size?: number; color?: string }> = ({ size = 34, color = COLOR.cyan }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11 V8 a4 4 0 0 1 8 0 V11" />
    <circle cx="12" cy="15.5" r="1.2" fill={color} />
  </svg>
);
