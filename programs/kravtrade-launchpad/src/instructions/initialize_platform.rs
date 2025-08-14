use anchor_lang::prelude::*;
use crate::state::PlatformConfig;
use crate::constants::*;
use crate::errors::LaunchpadError;

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = admin,
        space = PlatformConfig::LEN,
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: Treasury account will be validated in instruction
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_platform(
    ctx: Context<InitializePlatform>,
    platform_fee_percentage: u16,
    min_launch_duration: i64,
    max_launch_duration: i64,
    min_soft_cap: u64,
) -> Result<()> {
    // Validate configuration parameters
    PlatformConfig::validate_config(
        platform_fee_percentage,
        min_launch_duration,
        max_launch_duration,
        min_soft_cap,
    )?;

    let platform_config = &mut ctx.accounts.platform_config;
    
    // Initialize platform configuration
    platform_config.admin = ctx.accounts.admin.key();
    platform_config.treasury = ctx.accounts.treasury.key();
    platform_config.platform_fee_percentage = platform_fee_percentage;
    platform_config.min_launch_duration = min_launch_duration;
    platform_config.max_launch_duration = max_launch_duration;
    platform_config.min_soft_cap = min_soft_cap;
    platform_config.is_paused = false;
    platform_config.total_launches = 0;
    platform_config.total_raised = 0;
    platform_config.total_fees_collected = 0;
    platform_config.bump = ctx.bumps.platform_config;

    msg!(
        "Platform initialized with admin: {}, treasury: {}, fee: {}%",
        ctx.accounts.admin.key(),
        ctx.accounts.treasury.key(),
        platform_fee_percentage as f64 / 100.0
    );

    Ok(())
}