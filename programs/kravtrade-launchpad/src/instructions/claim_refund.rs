use anchor_lang::prelude::*;
use crate::state::{LaunchConfig, InvestorAccount, LaunchStatus};
use crate::constants::*;
use crate::errors::LaunchpadError;

#[derive(Accounts)]
#[instruction(launch_id: u64)]
pub struct ClaimRefund<'info> {
    #[account(
        seeds = [LAUNCH_SEED, launch_id.to_le_bytes().as_ref()],
        bump = launch_config.bump
    )]
    pub launch_config: Account<'info, LaunchConfig>,
    
    #[account(
        mut,
        seeds = [INVESTOR_SEED, launch_id.to_le_bytes().as_ref(), investor.key().as_ref()],
        bump = investor_account.bump
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    
    /// CHECK: Treasury account holding the contributions
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

pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    let launch_config = &ctx.accounts.launch_config;
    let investor_account = &mut ctx.accounts.investor_account;

    // Validate refund eligibility
    validate_refund_eligibility(launch_config, investor_account)?;

    let refund_amount = investor_account.contribution_amount;

    // Transfer SOL from treasury back to investor
    let launch_id_bytes = launch_config.launch_id.to_le_bytes();
    let treasury_seeds = &[
        TREASURY_SEED,
        launch_id_bytes.as_ref(),
        &[ctx.bumps.treasury_account],
    ];

    **ctx.accounts.treasury_account.try_borrow_mut_lamports()? -= refund_amount;
    **ctx.accounts.investor.try_borrow_mut_lamports()? += refund_amount;

    // Mark investor as refunded
    investor_account.mark_refunded();

    msg!(
        "Refund processed: {} lamports to {} for failed launch {}",
        refund_amount,
        ctx.accounts.investor.key(),
        launch_config.launch_id
    );

    Ok(())
}

fn validate_refund_eligibility(
    launch_config: &LaunchConfig,
    investor_account: &InvestorAccount,
) -> Result<()> {
    // Check if launch failed or was cancelled
    if launch_config.status != LaunchStatus::Failed && launch_config.status != LaunchStatus::Cancelled {
        return Err(LaunchpadError::RefundNotAvailable.into());
    }

    // Check if investor is eligible for refund
    if !investor_account.is_eligible_for_refund() {
        return Err(LaunchpadError::AlreadyRefunded.into());
    }

    // Check if investor actually contributed
    if investor_account.contribution_amount == 0 {
        return Err(LaunchpadError::NoTokensAvailable.into());
    }

    Ok(())
}