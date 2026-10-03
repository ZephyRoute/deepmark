//! The fixed content of the game: delvers, enemies and the three hand
//! authored floors. A direct port of `client/src/game/{heroes,enemies,floor}.ts`.
//! Any change here must be made in the TypeScript too, and the golden vectors
//! in `tests/golden.txt` must be regenerated.

pub const GRID_WIDTH: i32 = 13;
pub const GRID_HEIGHT: i32 = 9;
pub const MAX_FLOOR: u32 = 3;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Hero {
    pub max_hp: i32,
    pub dmg_min: u32,
    pub dmg_max: u32,
}

pub const HERO_LANTERN: u32 = 0;
pub const HERO_CINDER: u32 = 1;

pub fn hero(id: u32) -> Option<Hero> {
    match id {
        HERO_LANTERN => Some(Hero {
            max_hp: 10,
            dmg_min: 2,
            dmg_max: 4,
        }),
        HERO_CINDER => Some(Hero {
            max_hp: 8,
            dmg_min: 3,
            dmg_max: 5,
        }),
        _ => None,
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum EnemyKind {
    Warden,
    Skitter,
    Adept,
    WardenPrime,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Archetype {
    pub max_hp: i32,
    pub dmg_min: u32,
    pub dmg_max: u32,
}

pub fn archetype(kind: EnemyKind) -> Archetype {
    match kind {
        EnemyKind::Warden => Archetype {
            max_hp: 6,
            dmg_min: 1,
            dmg_max: 3,
        },
        EnemyKind::Skitter => Archetype {
            max_hp: 4,
            dmg_min: 1,
            dmg_max: 2,
        },
        EnemyKind::Adept => Archetype {
            max_hp: 9,
            dmg_min: 2,
            dmg_max: 4,
        },
        EnemyKind::WardenPrime => Archetype {
            max_hp: 12,
            dmg_min: 2,
            dmg_max: 4,
        },
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum RelicKind {
    Common,
    Rare,
    Core,
}

pub fn relic_value(kind: RelicKind) -> u32 {
    match kind {
        RelicKind::Common => 1,
        RelicKind::Rare => 2,
        RelicKind::Core => 3,
    }
}

#[derive(Copy, Clone, Debug)]
pub struct EnemyPlacement {
    pub at: Point,
    pub kind: EnemyKind,
}

#[derive(Copy, Clone, Debug)]
pub struct RelicPlacement {
    pub at: Point,
    pub kind: RelicKind,
}

pub struct Floor {
    pub number: u32,
    pub start: Point,
    pub stairs: Point,
    pub is_final: bool,
    pub enemies: &'static [EnemyPlacement],
    pub relics: &'static [RelicPlacement],
}

const DIVIDER_X: i32 = 6;
const POCKET_X: i32 = DIVIDER_X + 1;
const LANE_Y: i32 = 4;
const DETOUR_Y: i32 = 1;

const FLOOR_ONE: Floor = Floor {
    number: 1,
    start: Point { x: 2, y: LANE_Y },
    stairs: Point {
        x: GRID_WIDTH - 3,
        y: LANE_Y,
    },
    is_final: false,
    enemies: &[EnemyPlacement {
        at: Point {
            x: DIVIDER_X,
            y: LANE_Y,
        },
        kind: EnemyKind::Warden,
    }],
    relics: &[RelicPlacement {
        at: Point {
            x: POCKET_X,
            y: LANE_Y,
        },
        kind: RelicKind::Common,
    }],
};

const FLOOR_TWO: Floor = Floor {
    number: 2,
    start: Point { x: 2, y: LANE_Y },
    stairs: Point {
        x: GRID_WIDTH - 3,
        y: LANE_Y,
    },
    is_final: false,
    enemies: &[
        EnemyPlacement {
            at: Point {
                x: DIVIDER_X,
                y: DETOUR_Y,
            },
            kind: EnemyKind::Skitter,
        },
        EnemyPlacement {
            at: Point {
                x: DIVIDER_X,
                y: LANE_Y,
            },
            kind: EnemyKind::Adept,
        },
    ],
    relics: &[RelicPlacement {
        at: Point {
            x: POCKET_X,
            y: LANE_Y,
        },
        kind: RelicKind::Rare,
    }],
};

const FLOOR_THREE: Floor = Floor {
    number: 3,
    start: Point { x: 2, y: LANE_Y },
    stairs: Point {
        x: GRID_WIDTH - 2,
        y: LANE_Y,
    },
    is_final: true,
    enemies: &[EnemyPlacement {
        at: Point {
            x: DIVIDER_X,
            y: LANE_Y,
        },
        kind: EnemyKind::WardenPrime,
    }],
    relics: &[RelicPlacement {
        at: Point {
            x: DIVIDER_X + 3,
            y: LANE_Y,
        },
        kind: RelicKind::Core,
    }],
};

pub fn floor(number: u32) -> &'static Floor {
    match number {
        1 => &FLOOR_ONE,
        2 => &FLOOR_TWO,
        _ => &FLOOR_THREE,
    }
}

/// Wall layout, derived the same way the TypeScript builds its grids.
/// Floors 1 and 2 share a divider with two gaps and a relic pocket behind the
/// lane gap. Floor 3 is one room with a single mandatory gap.
pub fn is_walkable(floor_number: u32, x: i32, y: i32) -> bool {
    if x <= 0 || y <= 0 || x >= GRID_WIDTH - 1 || y >= GRID_HEIGHT - 1 {
        return false;
    }
    match floor_number {
        1 | 2 => {
            if x == DIVIDER_X && y != DETOUR_Y && y != LANE_Y {
                return false;
            }
            if x == POCKET_X && (y == LANE_Y - 1 || y == LANE_Y + 1) {
                return false;
            }
            if x == POCKET_X + 1 && y == LANE_Y {
                return false;
            }
            true
        }
        _ => !(x == DIVIDER_X && y != LANE_Y),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn borders_are_walls() {
        for n in 1..=3 {
            assert!(!is_walkable(n, 0, 4));
            assert!(!is_walkable(n, GRID_WIDTH - 1, 4));
            assert!(!is_walkable(n, 5, 0));
            assert!(!is_walkable(n, 5, GRID_HEIGHT - 1));
        }
    }

    #[test]
    fn every_start_stairs_enemy_and_relic_tile_is_walkable() {
        for n in 1..=MAX_FLOOR {
            let f = floor(n);
            assert!(is_walkable(n, f.start.x, f.start.y));
            assert!(is_walkable(n, f.stairs.x, f.stairs.y));
            for e in f.enemies {
                assert!(is_walkable(n, e.at.x, e.at.y));
            }
            for r in f.relics {
                assert!(is_walkable(n, r.at.x, r.at.y));
            }
        }
    }

    #[test]
    fn floor_one_has_a_guarded_lane_and_a_free_detour() {
        assert!(is_walkable(1, DIVIDER_X, LANE_Y));
        assert!(is_walkable(1, DIVIDER_X, DETOUR_Y));
        assert!(!is_walkable(1, DIVIDER_X, 2));
        assert!(!is_walkable(1, POCKET_X, LANE_Y - 1));
        assert!(!is_walkable(1, POCKET_X + 1, LANE_Y));
    }

    #[test]
    fn floor_three_has_one_gap_only() {
        assert!(is_walkable(3, DIVIDER_X, LANE_Y));
        assert!(!is_walkable(3, DIVIDER_X, DETOUR_Y));
    }

    #[test]
    fn heroes_match_the_shipped_stats() {
        assert_eq!(
            hero(HERO_LANTERN),
            Some(Hero {
                max_hp: 10,
                dmg_min: 2,
                dmg_max: 4
            })
        );
        assert_eq!(
            hero(HERO_CINDER),
            Some(Hero {
                max_hp: 8,
                dmg_min: 3,
                dmg_max: 5
            })
        );
        assert_eq!(hero(2), None);
    }
}
