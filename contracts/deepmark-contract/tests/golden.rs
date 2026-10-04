//! The contract's Rust replay must agree with the real TypeScript game on every
//! golden vector. Regenerate the file with `bun run golden` in `client/`.

use deepmark_contract::sim::{replay, Ending};
use deepmark_contract::world::Loadout;

const VECTORS: &str = include_str!("golden.txt");

#[test]
fn rust_replay_matches_every_typescript_vector() {
    let mut checked = 0;
    for (number, line) in VECTORS.lines().enumerate() {
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split(' ').collect();
        assert_eq!(f.len(), 14, "line {}: expected 14 fields", number + 1);

        let loadout = Loadout {
            base: f[0].parse().unwrap(),
            weapon: f[1].parse().unwrap(),
            charm: f[2].parse().unwrap(),
            rank: f[3].parse().unwrap(),
        };
        let seed: u32 = f[4].parse().unwrap();
        let actions = f[5].bytes().map(|b| b - b'0');
        let ending = if f[6] == "E" {
            Ending::Extracted
        } else {
            Ending::Dead
        };
        let floor: u32 = f[7].parse().unwrap();
        let common: u32 = f[8].parse().unwrap();
        let rare: u32 = f[9].parse().unwrap();
        let core: u32 = f[10].parse().unwrap();
        let score: u32 = f[11].parse().unwrap();
        let hp: u32 = f[12].parse().unwrap();
        let count: u32 = f[13].parse().unwrap();

        let out = replay(&loadout, seed, actions)
            .unwrap_or_else(|e| panic!("line {}: replay failed {:?}", number + 1, e));

        assert_eq!(out.ending, ending, "line {}: ending", number + 1);
        assert_eq!(out.floor_reached, floor, "line {}: floor", number + 1);
        assert_eq!(out.relics_common, common, "line {}: common", number + 1);
        assert_eq!(out.relics_rare, rare, "line {}: rare", number + 1);
        assert_eq!(out.relics_core, core, "line {}: core", number + 1);
        assert_eq!(out.score, score, "line {}: score", number + 1);
        assert_eq!(out.hp_left, hp, "line {}: hp", number + 1);
        assert_eq!(out.actions, count, "line {}: action count", number + 1);
        checked += 1;
    }
    assert!(
        checked >= 600,
        "expected at least 600 vectors, found {checked}"
    );
}
