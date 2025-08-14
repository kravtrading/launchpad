use anchor_lang::prelude::*;

/// Account tracking investor participation in a launch
#[account]
pub struct InvestorAccount {
    /// The investor's public key
    pub investor: Pubkey,
    /// Launch ID this investment is for
    pub launch_id: u64,
    /// Amount contributed in lamports
    pub contribution_amount: u64,
    /// Total tokens allocated to this investor
    pub token_allocation: u64,
    /// Amount of tokens already claimed
    pub claimed_amount: u64,
    /// Timestamp of last claim
    pub last_claim_time: i64,
    /// Whether the investor has been refunded (for failed launches)
    pub is_refunded: bool,
    /// Bump seed for PDA
    pub bump: u8,
}

impl InvestorAccount {
    /// Calculate space needed for the account
    pub const LEN: usize = 8 + // discriminator
        32 + // investor
        8 + // launch_id
        8 + // contribution_amount
        8 + // token_allocation
        8 + // claimed_amount
        8 + // last_claim_time
        1 + // is_refunded
        1; // bump

    /// Calculate the amount of tokens available for claiming based on vesting
    pub fn calculate_claimable_amount(
        &self,
        current_time: i64,
        vesting_config: &crate::state::VestingConfig,
        launch_start_time: i64,
    ) -> Result<u64> {
        if self.token_allocation == 0 {
            return Ok(0);
        }

        let vesting_start_time = launch_start_time;
        
        // If vesting hasn't started yet
        if current_time < vesting_start_time {
            return Ok(0);
        }

        // Calculate time elapsed since vesting start
        let time_elapsed = current_time - vesting_start_time;

        // If still in cliff period, only initial unlock is available
        if time_elapsed < vesting_config.cliff_duration {
            let initial_unlock = self.token_allocation
                .checked_mul(vesting_config.initial_unlock_percentage as u64)
                .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?
                .checked_div(10000) // Basis points (100% = 10000)
                .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;
            
            return Ok(initial_unlock.saturating_sub(self.claimed_amount));
        }

        // Calculate total vested amount
        let total_vested = if time_elapsed >= vesting_config.vesting_duration {
            // Fully vested
            self.token_allocation
        } else {
            // Partially vested
            let initial_unlock = self.token_allocation
                .checked_mul(vesting_config.initial_unlock_percentage as u64)
                .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?
                .checked_div(10000)
                .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;

            let remaining_tokens = self.token_allocation.saturating_sub(initial_unlock);
            
            if vesting_config.is_linear {
                // Linear vesting after cliff
                let vesting_time_elapsed = time_elapsed - vesting_config.cliff_duration;
                let vested_from_schedule = remaining_tokens
                    .checked_mul(vesting_time_elapsed as u64)
                    .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?
                    .checked_div(vesting_config.vesting_duration as u64)
                    .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;
                
                initial_unlock + vested_from_schedule
            } else {
                // Custom vesting logic can be implemented here
                initial_unlock
            }
        };

        // Return claimable amount (total vested minus already claimed)
        Ok(total_vested.saturating_sub(self.claimed_amount))
    }

    /// Update claimed amount and timestamp
    pub fn update_claimed_amount(&mut self, amount: u64, current_time: i64) -> Result<()> {
        self.claimed_amount = self.claimed_amount
            .checked_add(amount)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;
        self.last_claim_time = current_time;
        Ok(())
    }

    /// Check if investor is eligible for refund
    pub fn is_eligible_for_refund(&self) -> bool {
        !self.is_refunded && self.contribution_amount > 0
    }

    /// Mark as refunded
    pub fn mark_refunded(&mut self) {
        self.is_refunded = true;
    }
}