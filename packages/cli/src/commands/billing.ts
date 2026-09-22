import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function billingStatusCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const status = await client.billing.status();

    if (opts.json) {
      printJson(status);
      return;
    }

    console.log('\n' + pc.bold('Subscription & Billing:'));
    console.log(`  Tier:             ${pc.bold(pc.cyan(status.tier || 'FREE'))}`);
    console.log(`  Pro Active:       ${status.isPro ? pc.green('Yes') : 'No'}`);
    if (status.expiresAt) {
      console.log(`  Expires At:       ${status.expiresAt}`);
    }
    console.log(`  Token Balance:    ${status.tokenBalance ?? 0} tokens`);
    console.log();
  } catch (err: any) {
    printError('Failed to fetch billing status', err);
    process.exit(1);
  }
}

export async function listBillingCoinsCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const coins = await client.billing.coins();

    if (opts.json) {
      printJson(coins);
      return;
    }

    const rows = (coins || []).map((c: any) => ({
      ticker: c.ticker,
      network: c.network || '',
      coin: c.name || '',
    }));

    printTable(rows, ['ticker', 'coin', 'network']);
  } catch (err: any) {
    printError('Failed to list payment coins', err);
    process.exit(1);
  }
}

export async function checkoutBillingCommand(
  planId: string,
  opts: {
    url?: string;
    token?: string;
    months?: string;
    ticker?: string;
    coupon?: string;
    json?: boolean;
  }
) {
  try {
    const client = requireAuthClient(opts);
    const months = opts.months ? parseInt(opts.months, 10) : 1;
    const res = await client.billing.checkout({
      planId,
      months,
      ticker: opts.ticker,
      couponId: opts.coupon,
    });

    if (opts.json) {
      printJson(res);
      return;
    }

    if (res.depositAddress) {
      console.log('\n' + pc.bold(pc.green('Direct On-Chain Crypto Deposit Address Generated:')));
      console.log(`  Address: ${pc.bold(res.depositAddress)}`);
      console.log(`  Amount:  ${res.cryptoAmount || ''} ${res.ticker || ''}`);
      console.log(`  QR Code: ${res.qrCodeUrl || 'N/A'}`);
    } else if (res.checkoutUrl) {
      console.log('\n' + pc.bold('Hosted Checkout Session:'));
      console.log(`  Open: ${pc.underline(pc.cyan(res.checkoutUrl))}`);
    }
    console.log();
  } catch (err: any) {
    printError('Failed to create checkout session', err);
    process.exit(1);
  }
}

export async function claimCouponCommand(couponId: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const res = await client.billing.claimCoupon(couponId);

    if (opts.json) {
      printJson(res);
      return;
    }

    printSuccess(`Redeemed coupon "${pc.bold(couponId)}" successfully!`);
  } catch (err: any) {
    printError(`Failed to redeem coupon "${couponId}"`, err);
    process.exit(1);
  }
}
