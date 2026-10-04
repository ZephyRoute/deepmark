//! Pure rules for deepmark-contract: ranking and profile updates. No `Env`,
//! no storage, so they are unit tested directly.

use crate::components::PlayerRecord;
use crate::sim::{Ending, Outcome};

const EXTRACTED_SHIFT: u32 = 48;
const SCORE_SHIFT: u32 = 40;
const FLOOR_SHIFT: u32 = 32;
const HP_SHIFT: u32 = 24;
const ACTIONS_CEILING: u32 = 0xFFFF;
const ACTIONS_SHIFT: u32 = 8;

/// Packs the ranking criteria into one integer so ordering is a single
/// compare. Higher is better: extracted beats dead, then banked score, then
/// floor, then HP left, then fewer actions.
pub fn rank_key(outcome: &Outcome) -> u64 {
    let extracted = outcome.ending == Ending::Extracted;
    let score = if extracted {
        outcome.score.min(0xFF) as u64
    } else {
        0
    };
    let floor = outcome.floor_reached.min(0xFF) as u64;
    let hp = outcome.hp_left.min(0xFF) as u64;
    let speed = (ACTIONS_CEILING - outcome.actions.min(ACTIONS_CEILING)) as u64;
    let banked = if extracted { 1u64 } else { 0 };
    (banked << EXTRACTED_SHIFT)
        | (score << SCORE_SHIFT)
        | (floor << FLOOR_SHIFT)
        | (hp << HP_SHIFT)
        | (speed << ACTIONS_SHIFT)
}

/// Fold one verified run into a profile. Fresh delvers and veterans keep
/// separate bests so they can be ranked on separate ladders. Returns the
/// updated profile and whether the run improved that ladder's best.
pub fn apply_outcome(
    existing: Option<PlayerRecord>,
    outcome: &Outcome,
    key: u64,
    veteran: bool,
) -> (PlayerRecord, bool) {
    let mut record = existing.unwrap_or_else(PlayerRecord::empty);
    let extracted = outcome.ending == Ending::Extracted;
    let banked_score = if extracted { outcome.score } else { 0 };

    let is_new_best = if veteran {
        let better = key > record.vet_best_key;
        if better {
            record.vet_best_key = key;
            record.vet_best_floor = outcome.floor_reached;
            record.vet_best_score = banked_score;
        }
        record.veteran_runs = record.veteran_runs.saturating_add(1);
        better
    } else {
        let better = key > record.best_key;
        if better {
            record.best_key = key;
            record.best_floor = outcome.floor_reached;
            record.best_score = banked_score;
            record.best_hp_left = outcome.hp_left;
            record.best_actions = outcome.actions;
        }
        better
    };

    record.total_runs = record.total_runs.saturating_add(1);
    match outcome.ending {
        Ending::Extracted => {
            record.extractions = record.extractions.saturating_add(1);
            let relics = outcome.relics_common + outcome.relics_rare + outcome.relics_core;
            record.relics_banked = record.relics_banked.saturating_add(relics);
        }
        Ending::Dead => record.deaths = record.deaths.saturating_add(1),
    }
    (record, is_new_best)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn outcome(ending: Ending, floor: u32, score: u32, hp: u32, actions: u32) -> Outcome {
        Outcome {
            ending,
            floor_reached: floor,
            relics_common: if score > 0 { 1 } else { 0 },
            relics_rare: 0,
            relics_core: 0,
            score,
            hp_left: hp,
            actions,
        }
    }

    #[test]
    fn higher_score_beats_everything_else() {
        let low = outcome(Ending::Extracted, 3, 1, 10, 10);
        let high = outcome(Ending::Extracted, 1, 2, 1, 900);
        assert!(rank_key(&high) > rank_key(&low));
    }

    #[test]
    fn same_score_prefers_the_deeper_floor() {
        let shallow = outcome(Ending::Extracted, 1, 1, 10, 10);
        let deep = outcome(Ending::Extracted, 2, 1, 1, 900);
        assert!(rank_key(&deep) > rank_key(&shallow));
    }

    #[test]
    fn same_floor_prefers_more_hp_then_fewer_actions() {
        let hurt = outcome(Ending::Extracted, 3, 6, 2, 50);
        let healthy = outcome(Ending::Extracted, 3, 6, 9, 200);
        assert!(rank_key(&healthy) > rank_key(&hurt));
        let slow = outcome(Ending::Extracted, 3, 6, 9, 300);
        assert!(rank_key(&healthy) > rank_key(&slow));
    }

    #[test]
    fn a_death_ranks_below_any_extraction() {
        let dead_deep = outcome(Ending::Dead, 3, 0, 0, 10);
        let extracted_shallow = outcome(Ending::Extracted, 1, 0, 1, 1000);
        assert!(rank_key(&extracted_shallow) > rank_key(&dead_deep));
    }

    #[test]
    fn first_run_becomes_the_best() {
        let o = outcome(Ending::Extracted, 2, 3, 5, 80);
        let (record, new_best) = apply_outcome(None, &o, rank_key(&o), false);
        assert!(new_best);
        assert_eq!(record.best_floor, 2);
        assert_eq!(record.best_score, 3);
        assert_eq!(record.total_runs, 1);
        assert_eq!(record.extractions, 1);
        assert_eq!(record.relics_banked, 1);
    }

    #[test]
    fn a_worse_run_counts_but_keeps_the_best() {
        let good = outcome(Ending::Extracted, 3, 6, 9, 100);
        let (record, _) = apply_outcome(None, &good, rank_key(&good), false);
        let bad = outcome(Ending::Dead, 1, 0, 0, 20);
        let (record, new_best) = apply_outcome(Some(record), &bad, rank_key(&bad), false);
        assert!(!new_best);
        assert_eq!(record.best_floor, 3);
        assert_eq!(record.total_runs, 2);
        assert_eq!(record.deaths, 1);
        assert_eq!(record.extractions, 1);
    }

    #[test]
    fn a_death_never_banks_relics() {
        let o = outcome(Ending::Dead, 2, 0, 0, 40);
        let (record, _) = apply_outcome(None, &o, rank_key(&o), false);
        assert_eq!(record.relics_banked, 0);
        assert_eq!(record.best_score, 0);
    }

    #[test]
    fn veteran_runs_keep_their_own_best() {
        let fresh = outcome(Ending::Extracted, 3, 6, 9, 100);
        let (record, _) = apply_outcome(None, &fresh, rank_key(&fresh), false);
        let vet = outcome(Ending::Extracted, 3, 4, 5, 120);
        let (record, new_best) = apply_outcome(Some(record), &vet, rank_key(&vet), true);
        assert!(new_best, "the veteran ladder starts empty");
        assert_eq!(record.best_score, 6);
        assert_eq!(record.vet_best_score, 4);
        assert_eq!(record.veteran_runs, 1);
        assert_eq!(record.total_runs, 2);
    }
}
