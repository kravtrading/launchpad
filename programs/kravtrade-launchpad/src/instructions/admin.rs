use anchor_lang::prelude::*;
use crate::state::{LaunchConfig, PlatformConfig, LaunchStatus};
use crate::constants::*;
use crate::errors::LaunchpadError;

// Approve Launch
#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct ApproveLaunch<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ LaunchpadError::Unauthorized
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub admin: Signer<'info>,
}

pub fn approve_launch(ctx: Context<ApproveLaunch>) -> Result<()> {
    let launch_config = &mut ctx.accounts.launch_config;
    
    // Check if launch is in pending status
    if launch_config.status != LaunchStatus::Pending {
        return Err(LaunchpadError::LaunchAlreadyFinalized.into());
    }

    // Validate launch timing
    let current_time = Clock::get()?.unix_timestamp;
    if launch_config.start_time <= current_time {
        return Err(LaunchpadError::InvalidPresaleTime.into());
    }

    // Approve the launch
    launch_config.status = LaunchStatus::Active;

    msg!(
        "Launch {} approved by admin {}",
        launch_config.launch_id,
        ctx.accounts.admin.key()
    );

    Ok(())
}

// Reject Launch
#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct RejectLaunch<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ LaunchpadError::Unauthorized
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub admin: Signer<'info>,
}

pub fn reject_launch(ctx: Context<RejectLaunch>) -> Result<()> {
    let launch_config = &mut ctx.accounts.launch_config;
    
    // Check if launch can be rejected
    if launch_config.status != LaunchStatus::Pending {
        return Err(LaunchpadError::CannotCancelLaunch.into());
    }

    // Reject the launch
    launch_config.status = LaunchStatus::Cancelled;

    msg!(
        "Launch {} rejected by admin {}",
        launch_config.launch_id,
        ctx.accounts.admin.key()
    );

    Ok(())
}

// Emergency Pause
#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct EmergencyPause<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ LaunchpadError::Unauthorized
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub admin: Signer<'info>,
}

pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
    let launch_config = &mut ctx.accounts.launch_config;
    
    // Check if launch can be paused
    if launch_config.status != LaunchStatus::Active {
        return Err(LaunchpadError::PresaleNotActive.into());
    }

    // Pause the launch
    launch_config.status = LaunchStatus::Paused;

    msg!(
        "Launch {} emergency paused by admin {}",
        launch_config.launch_id,
        ctx.accounts.admin.key()
    );

    Ok(())
}

// Update Platform Config
#[derive(Accounts)]
pub struct UpdatePlatformConfig<'info> {
    #[account(
        mut,
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ LaunchpadError::Unauthorized
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub admin: Signer<'info>,
}

pub fn update_platform_config(
    ctx: Context<UpdatePlatformConfig>,
    platform_fee_percentage: Option<u16>,
    min_launch_duration: Option<i64>,
    max_launch_duration: Option<i64>,
    min_soft_cap: Option<u64>,
) -> Result<()> {
    let platform_config = &mut ctx.accounts.platform_config;

    // Update platform fee if provided
    if let Some(fee) = platform_fee_percentage {
        if fee > 5000 { // Max 50%
            return Err(LaunchpadError::InvalidPlatformFee.into());
        }
        platform_config.platform_fee_percentage = fee;
    }

    // Update launch duration limits if provided
    if let Some(min_duration) = min_launch_duration {
        if min_duration <= 0 {
            return Err(LaunchpadError::InvalidLaunchDuration.into());
        }
        platform_config.min_launch_duration = min_duration;
    }

    if let Some(max_duration) = max_launch_duration {
        if max_duration <= 0 || max_duration <= platform_config.min_launch_duration {
            return Err(LaunchpadError::InvalidLaunchDuration.into());
        }
        platform_config.max_launch_duration = max_duration;
    }

    // Update minimum soft cap if provided
    if let Some(soft_cap) = min_soft_cap {
        if soft_cap == 0 {
            return Err(LaunchpadError::InvalidSoftCap.into());
        }
        platform_config.min_soft_cap = soft_cap;
    }

    msg!(
        "Platform configuration updated by admin {}",
        ctx.accounts.admin.key()
    );

    Ok(())
}

// Collect Fees
#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ LaunchpadError::Unauthorized
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    /// CHECK: Platform treasury account
    #[account(
        mut,
        constraint = platform_treasury.key() == platform_config.treasury @ LaunchpadError::Unauthorized
    )]
    pub platform_treasury: AccountInfo<'info>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn collect_fees(ctx: Context<CollectFees>, amount: u64) -> Result<()> {
    // Check if treasury has sufficient balance
    let treasury_balance = ctx.accounts.platform_treasury.lamports();
    if treasury_balance < amount {
        return Err(LaunchpadError::InsufficientFunds.into());
    }

    // Transfer fees from treasury to admin
    **ctx.accounts.platform_treasury.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.admin.try_borrow_mut_lamports()? += amount;

    msg!(
        "Fees collected: {} lamports by admin {}",
        amount,
        ctx.accounts.admin.key()
    );

    Ok(())
}