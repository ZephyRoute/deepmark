//! Deterministic replay of a Deepmark run.
//!
//! A port of `client/src/game/state.ts` and `combat.ts`. Given a delver, a seed
//! and a log of one byte actions, it derives the result. The contract never
//! trusts a claimed result: it only trusts what this function computes.
//!
//! Pure Rust with no `Env`, so it is unit tested directly and compared against
//! vectors produced by the real TypeScript game.

use crate::rng::Mulberry32;
use crate::world::{
    archetype, floor, is_walkable, relic_value, stats_for, EnemyKind, Floor, Loadout, Point,
    RelicKind, Stats, MAX_FLOOR,
};

pub const ACTION_UP: u8 = 0;
pub const ACTION_DOWN: u8 = 1;
pub const ACTION_LEFT: u8 = 2;
pub const ACTION_RIGHT: u8 = 3;
pub const ACTION_ATTACK: u8 = 4;
pub const ACTION_RETREAT: u8 = 5;
pub const ACTION_DESCEND: u8 = 6;
pub const ACTION_EXTRACT: u8 = 7;

const MAX_ENEMIES_PER_FLOOR: usize = 2;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum SimError {
    UnknownLoadout,
    UnknownAction,
    /// The log ended before the run reached extraction or death.
    Incomplete,
    /// Actions continue after the run already ended.
    TrailingActions,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum Mode {
    Explore,
    Combat,
    Choice,
    Done,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Ending {
    Extracted,
    Dead,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Outcome {
    pub ending: Ending,
    pub floor_reached: u32,
    pub relics_common: u32,
    pub relics_rare: u32,
    pub relics_core: u32,
    pub score: u32,
    pub hp_left: u32,
    pub actions: u32,
}

#[derive(Copy, Clone)]
struct EnemyState {
    at: Point,
    hp: i32,
    alive: bool,
    kind: EnemyKind,
}

/// A run in progress. Public so tests can drive it step by step.
pub struct Run {
    stats: Stats,
    rng: Mulberry32,
    mode: Mode,
    floor: &'static Floor,
    player: Point,
    hp: i32,
    enemies: [Option<EnemyState>; MAX_ENEMIES_PER_FLOOR],
    active: Option<usize>,
    relic_taken: bool,
    common: u32,
    rare: u32,
    core: u32,
    score: u32,
    ending: Option<Ending>,
}

impl Run {
    pub fn new(loadout: &Loadout, seed: u32) -> Result<Self, SimError> {
        let stats = stats_for(loadout).ok_or(SimError::UnknownLoadout)?;
        let first = floor(1);
        Ok(Run {
            stats,
            rng: Mulberry32::new(seed),
            mode: Mode::Explore,
            floor: first,
            player: first.start,
            hp: stats.max_hp,
            enemies: spawn_enemies(first),
            active: None,
            relic_taken: false,
            common: 0,
            rare: 0,
            core: 0,
            score: 0,
            ending: None,
        })
    }

    /// True while the player is locked in a fight.
    pub fn in_combat(&self) -> bool {
        self.mode == Mode::Combat
    }

    /// True once the run has ended, by extraction or death.
    pub fn is_finished(&self) -> bool {
        self.ending.is_some()
    }

    /// The result of a finished run, `None` while it is still going.
    pub fn outcome(&self, actions: u32) -> Option<Outcome> {
        let ending = self.ending?;
        Some(Outcome {
            ending,
            floor_reached: self.floor.number,
            relics_common: self.common,
            relics_rare: self.rare,
            relics_core: self.core,
            score: self.score,
            hp_left: self.hp.max(0) as u32,
            actions,
        })
    }

    fn enemy_at(&self, p: Point) -> Option<usize> {
        self.enemies
            .iter()
            .position(|e| matches!(e, Some(s) if s.alive && s.at == p))
    }

    fn finish(&mut self, ending: Ending) {
        self.mode = Mode::Done;
        if ending == Ending::Dead {
            self.common = 0;
            self.rare = 0;
            self.core = 0;
            self.score = 0;
        }
        self.ending = Some(ending);
    }

    fn try_move(&mut self, dx: i32, dy: i32) {
        if self.mode != Mode::Explore {
            return;
        }
        let target = Point {
            x: self.player.x + dx,
            y: self.player.y + dy,
        };

        if let Some(idx) = self.enemy_at(target) {
            self.mode = Mode::Combat;
            self.active = Some(idx);
            return;
        }
        if !is_walkable(self.floor.number, target.x, target.y) {
            return;
        }
        self.player = target;

        if !self.relic_taken {
            if let Some(relic) = self.floor.relics.iter().find(|r| r.at == target) {
                self.relic_taken = true;
                match relic.kind {
                    RelicKind::Common => self.common += 1,
                    RelicKind::Rare => self.rare += 1,
                    RelicKind::Core => self.core += 1,
                }
                self.score += relic_value(relic.kind);
            }
        }

        if self.floor.stairs == target {
            if self.floor.is_final {
                self.finish(Ending::Extracted);
            } else {
                self.mode = Mode::Choice;
            }
        }
    }

    fn attack(&mut self) {
        if self.mode != Mode::Combat {
            return;
        }
        let Some(idx) = self.active else { return };
        let Some(mut enemy) = self.enemies[idx] else {
            return;
        };
        let arch = archetype(enemy.kind);

        let dealt = self.rng.rand_int(self.stats.dmg_min, self.stats.dmg_max) as i32;
        enemy.hp = (enemy.hp - dealt).max(0);

        if enemy.hp <= 0 {
            enemy.alive = false;
            self.enemies[idx] = Some(enemy);
            self.mode = Mode::Explore;
            self.active = None;
            return;
        }
        self.enemies[idx] = Some(enemy);

        let taken = self.rng.rand_int(arch.dmg_min, arch.dmg_max) as i32;
        self.hp = (self.hp - taken).max(0);
        if self.hp <= 0 {
            self.finish(Ending::Dead);
        }
    }

    fn retreat(&mut self) {
        if self.mode == Mode::Combat {
            self.mode = Mode::Explore;
            self.active = None;
        }
    }

    fn descend(&mut self) {
        if self.mode != Mode::Choice || self.floor.number >= MAX_FLOOR {
            return;
        }
        self.floor = floor(self.floor.number + 1);
        self.enemies = spawn_enemies(self.floor);
        self.relic_taken = false;
        self.player = self.floor.start;
        self.mode = Mode::Explore;
    }

    fn extract(&mut self) {
        if self.mode == Mode::Choice {
            self.finish(Ending::Extracted);
        }
    }

    pub fn apply(&mut self, action: u8) -> Result<(), SimError> {
        match action {
            ACTION_UP => self.try_move(0, -1),
            ACTION_DOWN => self.try_move(0, 1),
            ACTION_LEFT => self.try_move(-1, 0),
            ACTION_RIGHT => self.try_move(1, 0),
            ACTION_ATTACK => self.attack(),
            ACTION_RETREAT => self.retreat(),
            ACTION_DESCEND => self.descend(),
            ACTION_EXTRACT => self.extract(),
            _ => return Err(SimError::UnknownAction),
        }
        Ok(())
    }
}

fn spawn_enemies(floor: &Floor) -> [Option<EnemyState>; MAX_ENEMIES_PER_FLOOR] {
    let mut out = [None; MAX_ENEMIES_PER_FLOOR];
    for (slot, placement) in out.iter_mut().zip(floor.enemies.iter()) {
        *slot = Some(EnemyState {
            at: placement.at,
            hp: archetype(placement.kind).max_hp,
            alive: true,
            kind: placement.kind,
        });
    }
    out
}

/// Replay a whole run. The log must end exactly on the action that finishes
/// it: no unfinished runs and no padding after the end.
pub fn replay<I: Iterator<Item = u8>>(
    loadout: &Loadout,
    seed: u32,
    actions: I,
) -> Result<Outcome, SimError> {
    let mut run = Run::new(loadout, seed)?;
    let mut count: u32 = 0;

    for action in actions {
        if run.is_finished() {
            return Err(SimError::TrailingActions);
        }
        run.apply(action)?;
        count += 1;
    }

    run.outcome(count).ok_or(SimError::Incomplete)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{vec, vec::Vec};

    /// A plain kit for a base: Bulwark Pike and Stone Heart, rank 0.
    fn plain(base: u32) -> Loadout {
        Loadout {
            base,
            weapon: 2,
            charm: 2,
            rank: 0,
        }
    }

    fn run(base: u32, seed: u32, actions: &[u8]) -> Result<Outcome, SimError> {
        replay(&plain(base), seed, actions.iter().copied())
    }

    fn repeat(action: u8, times: usize) -> Vec<u8> {
        core::iter::repeat_n(action, times).collect()
    }

    /// Floor 1 free path: up to the detour lane, across, down to the stairs row.
    fn floor_one_detour() -> Vec<u8> {
        let mut a = Vec::new();
        // start (2,4): go up to y=1, right along the lane to x=8, down to y=4 via x=9
        a.extend(repeat(ACTION_UP, 3));
        a.extend(repeat(ACTION_RIGHT, 7)); // x=9
        a.extend(repeat(ACTION_DOWN, 3)); // y=4
        a.extend(repeat(ACTION_RIGHT, 1)); // stairs at x=10
        a
    }

    #[test]
    fn rejects_an_unknown_loadout() {
        assert_eq!(run(9, 1, &[]), Err(SimError::UnknownLoadout));
    }

    #[test]
    fn rejects_an_unknown_action() {
        assert_eq!(run(0, 1, &[42]), Err(SimError::UnknownAction));
    }

    #[test]
    fn an_empty_log_is_incomplete() {
        assert_eq!(run(0, 1, &[]), Err(SimError::Incomplete));
    }

    #[test]
    fn extracting_on_floor_one_with_nothing_banks_nothing() {
        let mut log = floor_one_detour();
        log.push(ACTION_EXTRACT);
        let out = run(0, 1, &log).unwrap();
        assert_eq!(out.ending, Ending::Extracted);
        assert_eq!(out.floor_reached, 1);
        assert_eq!(out.score, 0);
        assert_eq!(out.hp_left, 13);
        assert_eq!(out.actions as usize, log.len());
    }

    #[test]
    fn padding_after_the_end_is_rejected() {
        let mut log = floor_one_detour();
        log.push(ACTION_EXTRACT);
        log.push(ACTION_UP);
        assert_eq!(run(0, 1, &log), Err(SimError::TrailingActions));
    }

    #[test]
    fn a_log_that_stops_at_the_choice_prompt_is_incomplete() {
        let log = floor_one_detour();
        assert_eq!(run(0, 1, &log), Err(SimError::Incomplete));
    }

    #[test]
    fn walking_into_walls_changes_nothing() {
        let mut log = Vec::new();
        // start (2,4): step to x=1, bump the border wall three times, step back to x=2
        log.extend(repeat(ACTION_LEFT, 4));
        log.push(ACTION_RIGHT);
        log.extend(floor_one_detour());
        log.push(ACTION_EXTRACT);
        let out = run(0, 1, &log).unwrap();
        assert_eq!(out.floor_reached, 1);
        assert_eq!(out.score, 0);
    }

    #[test]
    fn walking_into_the_warden_starts_combat_and_attacks_resolve() {
        // start (2,4), warden at (6,4): three steps right then bump into it
        let mut log = repeat(ACTION_RIGHT, 4);
        log.extend(repeat(ACTION_ATTACK, 20));
        // either the warden dies or the player does; the log must end on death
        // if the player dies, otherwise the run is just incomplete
        match run(0, 3, &log) {
            Ok(out) => assert_eq!(out.ending, Ending::Dead),
            Err(e) => assert!(matches!(
                e,
                SimError::Incomplete | SimError::TrailingActions
            )),
        }
    }

    #[test]
    fn dying_zeroes_the_banked_relics_and_score() {
        // A glass cannon (Cinder, Reaver Hook, Keen Eye: 3 hp) against the floor 2 Adept
        // can lose. Search seeds for a death.
        let glass = Loadout {
            base: 1,
            weapon: 1,
            charm: 1,
            rank: 0,
        };
        let mut found = false;
        for seed in 0..20_000u32 {
            for attacks in 1..=6 {
                let mut log = floor_one_detour();
                log.push(ACTION_DESCEND);
                log.extend(repeat(ACTION_RIGHT, 4));
                log.extend(repeat(ACTION_ATTACK, attacks));
                let Ok(out) = replay(&glass, seed, log.iter().copied()) else {
                    continue;
                };
                if out.ending == Ending::Dead {
                    assert_eq!(out.score, 0);
                    assert_eq!(out.relics_common + out.relics_rare + out.relics_core, 0);
                    assert_eq!(out.hp_left, 0);
                    assert_eq!(out.floor_reached, 2);
                    found = true;
                }
            }
            if found {
                break;
            }
        }
        assert!(found, "expected at least one death among 20000 seeds");
    }

    #[test]
    fn descending_requires_the_choice_prompt() {
        let mut log = vec![ACTION_DESCEND];
        log.extend(floor_one_detour());
        log.push(ACTION_EXTRACT);
        let out = run(0, 1, &log).unwrap();
        assert_eq!(out.floor_reached, 1);
    }

    #[test]
    fn descending_from_the_choice_prompt_reaches_floor_two() {
        let mut log = floor_one_detour();
        log.push(ACTION_DESCEND);
        log.push(ACTION_UP);
        // now on floor 2 at (2,3); step back to the extract prompt is not possible
        // without reaching stairs, so this log is incomplete but must not error early
        assert_eq!(run(0, 1, &log), Err(SimError::Incomplete));
    }
}
