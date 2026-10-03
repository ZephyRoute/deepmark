//! Mulberry32, a bit exact port of `client/src/game/rng.ts`.
//!
//! The client and the contract must draw the same numbers from the same seed,
//! so every step uses `u32` wrapping arithmetic that matches the 32 bit
//! integer semantics of the JavaScript original.

pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Mulberry32 { state: seed }
    }

    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6D2B_79F5);
        let mut t = (self.state ^ (self.state >> 15)).wrapping_mul(1 | self.state);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        t ^ (t >> 14)
    }

    /// Inclusive integer in `min..=max`. The TypeScript is
    /// `min + floor((x / 2^32) * (max - min + 1))`. For `x < 2^32` and a small
    /// range that equals `(x * range) >> 32` exactly, so no floating point is
    /// needed on chain.
    pub fn rand_int(&mut self, min: u32, max: u32) -> u32 {
        let range = (max - min + 1) as u64;
        min + ((self.next_u32() as u64 * range) >> 32) as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_gives_the_same_sequence() {
        let mut a = Mulberry32::new(12345);
        let mut b = Mulberry32::new(12345);
        for _ in 0..32 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
    }

    #[test]
    fn different_seeds_diverge() {
        let mut a = Mulberry32::new(1);
        let mut b = Mulberry32::new(2);
        assert_ne!(a.next_u32(), b.next_u32());
    }

    #[test]
    fn rand_int_stays_inside_the_inclusive_range() {
        let mut rng = Mulberry32::new(99);
        for _ in 0..2000 {
            let v = rng.rand_int(2, 4);
            assert!((2..=4).contains(&v));
        }
    }

    #[test]
    fn rand_int_reaches_both_ends() {
        let mut rng = Mulberry32::new(7);
        let mut seen_min = false;
        let mut seen_max = false;
        for _ in 0..2000 {
            match rng.rand_int(1, 3) {
                1 => seen_min = true,
                3 => seen_max = true,
                _ => {}
            }
        }
        assert!(seen_min && seen_max);
    }
}
