use anchor_lang::prelude::*;

/// Vesting configuration for token releases
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VestingConfig {
    /// Duration of cliff period in seconds
    pub cliff_duration: i64,
    /// Total vesting duration in seconds
    pub vesting_duration: i64,
    /// Percentage unlocked immediately (in basis points, 10000 = 100%)
    pub initial_unlock_percentage: u16,
    /// Whether vesting follows linear schedule
    pub is_linear: bool,
}

impl Default for VestingConfig {
    fn default() -> Self {
        VestingConfig {
            cliff_duration: 0,
            vesting_duration: 0,
            initial_unlock_percentage: 0,
            is_linear: true,
        }
    }
}

impl VestingConfig {
    /// Calculate space needed for vesting config
    pub const LEN: usize = 
        8 + // cliff_duration
        8 + // vesting_duration
        2 + // initial_unlock_percentage
        1; // is_linear

    /// Validate vesting configuration parameters
    pub fn validate(&self) -> Result<()> {
        // Initial unlock percentage cannot exceed 100%
        if self.initial_unlock_percentage > 10000 {
            return Err(crate::errors::LaunchpadError::InvalidVestingConfig.into());
        }

        // Cliff duration cannot be longer than total vesting duration
        if self.cliff_duration > self.vesting_duration {
            return Err(crate::errors::LaunchpadError::InvalidVestingConfig.into());
        }

        // Vesting duration must be positive if not 100% immediate unlock
        if self.initial_unlock_percentage < 10000 && self.vesting_duration <= 0 {
            return Err(crate::errors::LaunchpadError::InvalidVestingConfig.into());
        }

        Ok(())
    }

    /// Check if tokens are immediately fully unlocked
    pub fn is_immediate_unlock(&self) -> bool {
        self.initial_unlock_percentage == 10000
    }

    /// Calculate vested percentage at given time
    pub fn calculate_vested_percentage(&self, time_elapsed: i64) -> u16 {
        if time_elapsed < self.cliff_duration {
            return self.initial_unlock_percentage;
        }

        if time_elapsed >= self.vesting_duration {
            return 10000; // 100%
        }

        if self.is_linear {
            let remaining_percentage = 10000 - self.initial_unlock_percentage;
            let vesting_time_elapsed = time_elapsed - self.cliff_duration;
            let vesting_time_remaining = self.vesting_duration - self.cliff_duration;
            
            let additional_vested = (remaining_percentage as i64)
                .checked_mul(vesting_time_elapsed)
                .unwrap_or(0)
                .checked_div(vesting_time_remaining)
                .unwrap_or(0) as u16;

            self.initial_unlock_percentage + additional_vested
        } else {
            // For non-linear vesting, return initial unlock until fully vested
            self.initial_unlock_percentage
        }
    }
}