use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;
pub mod constants;

pub use instructions::*;
pub use state::*;
pub use errors::*;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod kravtrade_launchpad {
    use super::*;

    /// Initialize the platform configuration
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        platform_fee_percentage: u16,
        min_launch_duration: i64,
        max_launch_duration: i64,
        min_soft_cap: u64,
    ) -> Result<()> {
        instructions::initialize_platform(
            ctx,
            platform_fee_percentage,
            min_launch_duration,
            max_launch_duration,
            min_soft_cap,
        )
    }

    /// Create a new token launch
    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        launch_id: u64,
        name: String,
        symbol: String,
        decimals: u8,
        total_supply: u64,
        presale_price: u64,
        min_contribution: u64,
        max_contribution: u64,
        soft_cap: u64,
        hard_cap: u64,
        start_time: i64,
        end_time: i64,
        vesting_config: state::VestingConfig,
        metadata: state::LaunchMetadata,
    ) -> Result<()> {
        instructions::create_launch(
            ctx,
            launch_id,
            name,
            symbol,
            decimals,
            total_supply,
            presale_price,
            min_contribution,
            max_contribution,
            soft_cap,
            hard_cap,
            start_time,
            end_time,
            vesting_config,
            metadata,
        )
    }

    /// Contribute to a launch
    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        instructions::contribute(ctx, amount)
    }

    /// Claim vested tokens
    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        instructions::claim_tokens(ctx)
    }

    /// Claim refund for failed launch
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund(ctx)
    }

    /// Finalize a successful launch
    pub fn finalize_launch(ctx: Context<FinalizeLaunch>) -> Result<()> {
        instructions::finalize_launch(ctx)
    }

    /// Admin: Approve a launch
    pub fn approve_launch(ctx: Context<ApproveLaunch>) -> Result<()> {
        instructions::approve_launch(ctx)
    }

    /// Admin: Reject a launch
    pub fn reject_launch(ctx: Context<RejectLaunch>) -> Result<()> {
        instructions::reject_launch(ctx)
    }

    /// Admin: Emergency pause a launch
    pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
        instructions::emergency_pause(ctx)
    }

    /// Admin: Update platform configuration
    pub fn update_platform_config(
        ctx: Context<UpdatePlatformConfig>,
        platform_fee_percentage: Option<u16>,
        min_launch_duration: Option<i64>,
        max_launch_duration: Option<i64>,
        min_soft_cap: Option<u64>,
    ) -> Result<()> {
        instructions::update_platform_config(
            ctx,
            platform_fee_percentage,
            min_launch_duration,
            max_launch_duration,
            min_soft_cap,
        )
    }

    /// Admin: Collect platform fees
    pub fn collect_fees(ctx: Context<CollectFees>, amount: u64) -> Result<()> {
        instructions::collect_fees(ctx, amount)
    }
}