"use server";

import { ID } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import * as shared from './shared';

const { getActor } = shared;

import { createWalletClient, http, verifyTypedData } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export interface PaymentIntentInput {
    jwt?: string;
    agentId: string;
    amount: number;
    contextPayload: Record<string, any>;
    chainId: number;
}

/**
 * Creates a new agent payment intent.
 */
export async function createPaymentIntentAction(input: PaymentIntentInput) {
    const actor = await getActor(input.jwt);
    if (!actor) {
        throw new Error('Unauthorized');
    }

    const tablesDB = createSystemTablesDB();
    const intentId = ID.unique();
    const payloadStr = JSON.stringify(input.contextPayload || {});

    const newIntent = await tablesDB.createRow(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.AGENT_PAYMENT_INTENTS,
        intentId,
        {
            userId: actor.$id,
            agentId: input.agentId,
            amount: input.amount,
            status: 'pending',
            payload: payloadStr,
            chainId: input.chainId,
            txHash: ''
        }
    );

    return {
        success: true,
        intent: {
            id: newIntent.$id,
            userId: newIntent.userId,
            agentId: newIntent.agentId,
            amount: newIntent.amount,
            status: newIntent.status,
            payload: newIntent.payload,
            chainId: newIntent.chainId,
            txHash: newIntent.txHash
        }
    };
}

/**
 * Submits signed EIP-712 transaction bytes to the gas relay and broadcasts to live JSON-RPC.
 */
export async function submitGasRelayAction(input: {
    jwt?: string;
    intentId: string;
    signature: string;
    userAddress: string;
    targetAddress: string;
    amount: number;
    chainId: number;
}) {
    const actor = await getActor(input.jwt);
    if (!actor) {
        throw new Error('Unauthorized');
    }

    const tablesDB = createSystemTablesDB();

    // Retrieve the active payment intent row
    const intent = await tablesDB.getRow(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.AGENT_PAYMENT_INTENTS,
        input.intentId
    );

    if (!intent || intent.userId !== actor.$id) {
        throw new Error('Intent not found or unauthorized access');
    }

    if (intent.status !== 'pending') {
        throw new Error('Payment intent already processed');
    }

    const rpcUrl = input.chainId === 421614
        ? 'https://sepolia-rollup.arbitrum.io/rpc'
        : 'https://arb1.arbitrum.io/rpc';

    try {
        // 1. Perform EIP-712 Signature Verification
        const domain = {
            name: 'KylrixAgentPayment',
            version: '1',
            chainId: input.chainId,
            verifyingContract: '0x0000000000000000000000000000000000000000' as `0x${string}`
        };

        const types = {
            Payment: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'intentId', type: 'string' }
            ]
        };

        const message = {
            recipient: input.targetAddress as `0x${string}`,
            amount: BigInt(input.amount),
            intentId: input.intentId
        };

        const isValid = await verifyTypedData({
            address: input.userAddress as `0x${string}`,
            domain,
            types,
            primaryType: 'Payment',
            message,
            signature: input.signature as `0x${string}`
        });

        if (!isValid) {
            throw new Error('EIP-712 signature verification failed');
        }

        // 2. Broadcast live transaction using Elevated Server-Side System Wallet
        const privateKey = process.env.SYSTEM_WALLET_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const chainConfig = input.chainId === 421614 ? arbitrumSepolia : arbitrum;

        const walletClient = createWalletClient({
            account,
            chain: chainConfig,
            transport: http(rpcUrl)
        });

        const txHash = await walletClient.sendTransaction({
            to: input.targetAddress as `0x${string}`,
            value: BigInt(input.amount)
        });

        // 3. Update payment intent database record to complete
        await tablesDB.updateRow(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.AGENT_PAYMENT_INTENTS,
            input.intentId,
            {
                status: 'completed',
                txHash: txHash
            }
        );

        return {
            success: true,
            txHash: txHash,
            status: 'completed'
        };
    } catch (err: any) {
        await tablesDB.updateRow(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.AGENT_PAYMENT_INTENTS,
            input.intentId,
            {
                status: 'failed'
            }
        );
        throw new Error(`Gas relay submission failed: ${err.message}`);
    }
}
