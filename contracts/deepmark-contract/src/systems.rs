//! Pure game rules for deepmark-contract, kept free of `Env` and storage so
//! they can be unit tested directly.

use crate::components::{PlayerRecord, MAX_FLOOR};

/// Fold one finished run into a player's existing record.
///
/// `floor_reached` is clamped to `MAX_FLOOR` first: the client cannot claim
/// progress past the floor the shipped game actually contains. Returns the
/// updated record and whether this run set a new personal best (floor or
/// relics), which the client uses for the "NEW BEST!" moment regardless of
/// whether the run ended in extraction or death.
pub fn apply_run(existing: Option<PlayerRecord>, floor_reached: u32, relics_kept: u32) -> (PlayerRecord, bool) {
    let floor_reached = floor_reached.min(MAX_FLOOR);
    let previous = existing.unwrap_or_else(PlayerRecord::empty);

    let is_new_best = floor_reached > previous.best_floor || relics_kept > previous.best_relics;

    let updated = PlayerRecord {
        best_floor: previous.best_floor.max(floor_reached),
        best_relics: previous.best_relics.max(relics_kept),
        total_runs: previous.total_runs.saturating_add(1),
    };

    (updated, is_new_best)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_run_becomes_the_record() {
        let (record, is_new_best) = apply_run(None, 2, 3);
        assert_eq!(record, PlayerRecord { best_floor: 2, best_relics: 3, total_runs: 1 });
        assert!(is_new_best);
    }

    #[test]
    fn worse_run_keeps_the_previous_best_but_still_counts() {
        let existing = PlayerRecord { best_floor: 3, best_relics: 2, total_runs: 5 };
        let (record, is_new_best) = apply_run(Some(existing), 1, 0);
        assert_eq!(record, PlayerRecord { best_floor: 3, best_relics: 2, total_runs: 6 });
        assert!(!is_new_best);
    }

    #[test]
    fn floor_reached_is_clamped_to_the_shipped_max() {
        let (record, _) = apply_run(None, 99, 1);
        assert_eq!(record.best_floor, MAX_FLOOR);
    }

    #[test]
    fn relics_alone_can_set_a_new_best() {
        let existing = PlayerRecord { best_floor: 3, best_relics: 1, total_runs: 1 };
        let (record, is_new_best) = apply_run(Some(existing), 2, 4);
        assert_eq!(record, PlayerRecord { best_floor: 3, best_relics: 4, total_runs: 2 });
        assert!(is_new_best);
    }
}
