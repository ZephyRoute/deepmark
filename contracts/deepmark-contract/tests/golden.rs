//! The contract's Rust replay must agree with the real TypeScript game on every
//! golden vector. Regenerate the file with `bun run golden` in `client/`.

use deepmark_contract::sim::{replay, Ending};

const VECTORS: &str = include_str!("golden.txt");

#[test]
fn rust_replay_matches_every_typescript_vector() {
    let mut checked = 0;
    for (number, line) in VECTORS.lines().enumerate() {
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split(' ').collect();
        assert_eq!(f.len(), 11, "line {}: expected 11 fields", number + 1);

        let hero: u32 = f[0].parse().unwrap();
        let seed: u32 = f[1].parse().unwrap();
        let actions = f[2].bytes().map(|b| b - b'0');
        let ending = if f[3] == "E" { Ending::Extracted } else { Ending::Dead };
        let floor: u32 = f[4].parse().unwrap();
        let common: u32 = f[5].parse().unwrap();
        let rare: u32 = f[6].parse().unwrap();
        let core: u32 = f[7].parse().unwrap();
        let score: u32 = f[8].parse().unwrap();
        let hp: u32 = f[9].parse().unwrap();
        let count: u32 = f[10].parse().unwrap();

        let out = replay(hero, seed, actions).unwrap_or_else(|e| panic!("line {}: replay failed {:?}", number + 1, e));

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
    assert!(checked >= 400, "expected at least 400 vectors, found {checked}");
}
