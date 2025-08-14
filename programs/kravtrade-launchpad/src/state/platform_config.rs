use anchor_lang::prelude::*;

/// Global platform configuration
#[account]
pub struct PlatformConfig {
    /// Platform administrator
    pub admin: Pubkey,
    /// Treasury account for fee collection
    pub treasury: Pubkey,
    /// Platform fee percentage in basis points (10000 = 100%)
    pub platform_fee_percentage: u16,
    /// Minimum launch duration in seconds
    pub min_launch_duration: i64,
    /// Maximum launch duration in seconds
    pub max_launch_duration: i64,
    /// Minimum soft cap amount in lamports
    pub min_soft_cap: u64,
    /// Whether the platform is paused
    pub is_paused: bool,
    /// Total number of launches created
    pub total_launches: u64,
    /// Total amount raised across all launches
    pub total_raised: u64,
    /// Total fees collected by platform
    pub total_fees_collected: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl PlatformConfig {
    /// Calculate space needed for the account
    pub const LEN: usize = 8 + // discriminator
        32 + // admin
        32 + // treasury
        2 + // platform_fee_percentage
        8 + // min_launch_duration
        8 + // max_launch_duration
        8 + // min_soft_cap
        1 + // is_paused
        8 + // total_launches
        8 + // total_raised
        8 + // total_fees_collected
        1; // bump

    /// Validate platform configuration parameters
    pub fn validate_config(
        platform_fee_percentage: u16,
        min_launch_duration: i64,
        max_launch_duration: i64,
        min_soft_cap: u64,
    ) -> Result<()> {
        // Platform fee cannot exceed 50% (5000 basis points)
        if platform_fee_percentage > 5000 {
            return Err(crate::errors::LaunchpadError::InvalidPlatformFee.into());
        }

        // Launch duration validation
        if min_launch_duration <= 0 || max_launch_duration <= 0 {
            return Err(crate::errors::LaunchpadError::InvalidLaunchDuration.into());
        }

        if min_launch_duration >= max_launch_duration {
            return Err(crate::errors::LaunchpadError::InvalidLaunchDuration.into());
        }

        // Minimum soft cap validation
        if min_soft_cap == 0 {
            return Err(crate::errors::LaunchpadError::InvalidSoftCap.into());
        }

        Ok(())
    }

    /// Calculate platform fee for a given amount
    pub fn calculate_platform_fee(&self, amount: u64) -> Result<u64> {
        amount
            .checked_mul(self.platform_fee_percentage as u64)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow.into())
    }

    /// Validate launch duration against platform limits
    pub fn validate_launch_duration(&self, start_time: i64, end_time: i64) -> Result<()> {
        let duration = end_time - start_time;
        
        if duration < self.min_launch_duration {
            return Err(crate::errors::LaunchpadError::LaunchDurationTooShort.into());
        }

        if duration > self.max_launch_duration {
            return Err(crate::errors::LaunchpadError::LaunchDurationTooLong.into());
        }

        Ok(())
    }

    /// Validate soft cap against platform minimum
    pub fn validate_soft_cap(&self, soft_cap: u64) -> Result<()> {
        if soft_cap < self.min_soft_cap {
            return Err(crate::errors::LaunchpadError::SoftCapTooLow.into());
        }
        Ok(())
    }

    /// Update platform statistics
    pub fn update_stats(&mut self, raised_amount: u64, fee_amount: u64) -> Result<()> {
        self.total_launches = self.total_launches
            .checked_add(1)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;
        
        self.total_raised = self.total_raised
            .checked_add(raised_amount)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;
        
        self.total_fees_collected = self.total_fees_collected
            .checked_add(fee_amount)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;

        Ok(())
    }

    /// Check if platform operations are allowed
    pub fn is_operational(&self) -> bool {
        !self.is_paused
    }
}