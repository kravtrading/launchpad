use anchor_lang::prelude::*;
use crate::state::{VestingConfig};

/// Status of a token launch
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LaunchStatus {
    /// Awaiting admin approval
    Pending,
    /// Presale is live and accepting contributions
    Active,
    /// Soft cap reached, tokens are claimable
    Successful,
    /// Ended without reaching soft cap, refunds available
    Failed,
    /// Cancelled by creator or admin
    Cancelled,
    /// Temporarily paused
    Paused,
}

impl Default for LaunchStatus {
    fn default() -> Self {
        LaunchStatus::Pending
    }
}

/// Metadata for a token launch
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LaunchMetadata {
    /// Project description
    pub description: String,
    /// Project website URL
    pub website: String,
    /// Twitter handle
    pub twitter: String,
    /// Telegram link
    pub telegram: String,
    /// Discord link
    pub discord: String,
    /// Project logo URI
    pub logo_uri: String,
    /// Whitepaper or documentation link
    pub documentation: String,
}

impl Default for LaunchMetadata {
    fn default() -> Self {
        LaunchMetadata {
            description: String::new(),
            website: String::new(),
            twitter: String::new(),
            telegram: String::new(),
            discord: String::new(),
            logo_uri: String::new(),
            documentation: String::new(),
        }
    }
}

/// Configuration for a token launch
#[account]
pub struct LaunchConfig {
    /// Creator of the launch
    pub creator: Pubkey,
    /// Token mint address
    pub token_mint: Pubkey,
    /// Unique launch identifier
    pub launch_id: u64,
    /// Token name
    pub name: String,
    /// Token symbol
    pub symbol: String,
    /// Token decimals
    pub decimals: u8,
    /// Total token supply
    pub total_supply: u64,
    /// Price per token in lamports
    pub presale_price: u64,
    /// Minimum contribution amount in lamports
    pub min_contribution: u64,
    /// Maximum contribution amount in lamports
    pub max_contribution: u64,
    /// Soft cap in lamports (minimum to consider successful)
    pub soft_cap: u64,
    /// Hard cap in lamports (maximum to raise)
    pub hard_cap: u64,
    /// Presale start time (Unix timestamp)
    pub start_time: i64,
    /// Presale end time (Unix timestamp)
    pub end_time: i64,
    /// Total amount raised in lamports
    pub total_raised: u64,
    /// Number of contributors
    pub contributor_count: u32,
    /// Current status of the launch
    pub status: LaunchStatus,
    /// Vesting configuration
    pub vesting_config: VestingConfig,
    /// Project metadata
    pub metadata: LaunchMetadata,
    /// Bump seed for PDA
    pub bump: u8,
}

impl LaunchConfig {
    /// Calculate space needed for the account
    pub const LEN: usize = 8 + // discriminator
        32 + // creator
        32 + // token_mint
        8 + // launch_id
        4 + 50 + // name (max 50 chars)
        4 + 10 + // symbol (max 10 chars)
        1 + // decimals
        8 + // total_supply
        8 + // presale_price
        8 + // min_contribution
        8 + // max_contribution
        8 + // soft_cap
        8 + // hard_cap
        8 + // start_time
        8 + // end_time
        8 + // total_raised
        4 + // contributor_count
        1 + // status enum
        VestingConfig::LEN + // vesting_config
        LaunchMetadata::LEN + // metadata
        1; // bump

    /// Check if the launch is currently active
    pub fn is_active(&self) -> bool {
        self.status == LaunchStatus::Active
    }

    /// Check if the launch has reached its soft cap
    pub fn has_reached_soft_cap(&self) -> bool {
        self.total_raised >= self.soft_cap
    }

    /// Check if the launch has reached its hard cap
    pub fn has_reached_hard_cap(&self) -> bool {
        self.total_raised >= self.hard_cap
    }

    /// Check if the presale time window is valid
    pub fn is_presale_time_valid(&self, current_time: i64) -> bool {
        current_time >= self.start_time && current_time <= self.end_time
    }

    /// Calculate tokens to be allocated for a given contribution
    pub fn calculate_token_allocation(&self, contribution: u64) -> Result<u64> {
        let tokens = contribution
            .checked_mul(10_u64.pow(self.decimals as u32))
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?
            .checked_div(self.presale_price)
            .ok_or(crate::errors::LaunchpadError::ArithmeticOverflow)?;
        Ok(tokens)
    }

    /// Validate contribution amount
    pub fn validate_contribution(&self, amount: u64) -> Result<()> {
        if amount < self.min_contribution {
            return Err(crate::errors::LaunchpadError::ContributionTooLow.into());
        }
        if amount > self.max_contribution {
            return Err(crate::errors::LaunchpadError::ContributionTooHigh.into());
        }
        if self.total_raised.checked_add(amount).unwrap_or(u64::MAX) > self.hard_cap {
            return Err(crate::errors::LaunchpadError::HardCapExceeded.into());
        }
        Ok(())
    }
}

impl LaunchMetadata {
    /// Calculate space needed for metadata
    pub const LEN: usize = 
        4 + 500 + // description (max 500 chars)
        4 + 100 + // website (max 100 chars)
        4 + 50 + // twitter (max 50 chars)
        4 + 100 + // telegram (max 100 chars)
        4 + 100 + // discord (max 100 chars)
        4 + 200 + // logo_uri (max 200 chars)
        4 + 200; // documentation (max 200 chars)
}