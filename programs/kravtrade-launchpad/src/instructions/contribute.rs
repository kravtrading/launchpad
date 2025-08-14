use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{LaunchConfig, InvestorAccount, PlatformConfig, LaunchStatus};
use crate::constants::*;
use crate::errors::LaunchpadError;

#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct Contribute<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        init_if_needed,
        payer = investor,
        space = InvestorAccount::LEN,
        seeds = [INVESTOR_SEED, launch_id.to_le_bytes().as_ref(), investor.key().as_ref()],
        bump
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    #[account(
        seeds = [PLATFORM_SEED, CONFIG_SEED],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    /// CHECK: Treasury account for holding contributions
    #[account(
        mut,
        seeds = [TREASURY_SEED, launch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub treasury_account: AccountInfo<'info>,
    
    #[account(mut)]
    pub investor: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
    let launch_config = &mut ctx.accounts.launch_config;
    let investor_account = &mut ctx.accounts.investor_account;
    let platform_config = &ctx.accounts.platform_config;
    let current_time = Clock::get()?.unix_timestamp;

    // Check if platform is operational
    if !platform_config.is_operational() {
        return Err(LaunchpadError::PlatformPaused.into());
    }

    // Check launch status and timing
    validate_contribution_eligibility(launch_config, current_time)?;

    // Validate contribution amount
    launch_config.validate_contribution(amount)?;

    // Check if this is a new investor account
    let is_new_investor = investor_account.investor == Pubkey::default();

    // Initialize investor account if needed
    if is_new_investor {
        investor_account.investor = ctx.accounts.investor.key();
        investor_account.launch_id = launch_config.launch_id;
        investor_account.contribution_amount = 0;
        investor_account.token_allocation = 0;
        investor_account.claimed_amount = 0;
        investor_account.last_claim_time = 0;
        investor_account.is_refunded = false;
        investor_account.bump = ctx.bumps.investor_account;
        
        // Increment contributor count for new investors
        launch_config.contributor_count = launch_config.contributor_count
            .checked_add(1)
            .ok_or(LaunchpadError::ArithmeticOverflow)?;
    }

    // Calculate token allocation for this contribution
    let token_allocation = launch_config.calculate_token_allocation(amount)?;

    // Transfer SOL from investor to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.investor.to_account_info(),
                to: ctx.accounts.treasury_account.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update investor account
    investor_account.contribution_amount = investor_account.contribution_amount
        .checked_add(amount)
        .ok_or(LaunchpadError::ArithmeticOverflow)?;
    
    investor_account.token_allocation = investor_account.token_allocation
        .checked_add(token_allocation)
        .ok_or(LaunchpadError::ArithmeticOverflow)?;

    // Update launch statistics
    launch_config.total_raised = launch_config.total_raised
        .checked_add(amount)
        .ok_or(LaunchpadError::ArithmeticOverflow)?;

    // Check if hard cap is reached and update status
    if launch_config.has_reached_hard_cap() {
        launch_config.status = LaunchStatus::Successful;
    }

    msg!(
        "Contribution received: {} lamports from {} for launch {}",
        amount,
        ctx.accounts.investor.key(),
        launch_config.launch_id
    );

    msg!(
        "Token allocation: {} tokens, Total raised: {} lamports",
        token_allocation,
        launch_config.total_raised
    );

    Ok(())
}

fn validate_contribution_eligibility(
    launch_config: &LaunchConfig,
    current_time: i64,
) -> Result<()> {
    // Check if launch is active
    if launch_config.status != LaunchStatus::Active {
        return Err(LaunchpadError::PresaleNotActive.into());
    }

    // Check if presale time window is valid
    if !launch_config.is_presale_time_valid(current_time) {
        return Err(LaunchpadError::InvalidPresaleTime.into());
    }

    // Check if hard cap has been reached
    if launch_config.has_reached_hard_cap() {
        return Err(LaunchpadError::HardCapExceeded.into());
    }

    Ok(())
}