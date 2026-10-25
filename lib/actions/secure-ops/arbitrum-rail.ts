"use server";

import { systemTables } from '@/lib/data/system-tables';
import * as shared from './shared';
import { ulid } from '@/lib/utils/ulid';

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

export async function createPaymentIntentAction(input: PaymentIntentInput) {
    const actor = await getActor(input.jwt);
    if (!actor) {
        throw new Error('Unauthorized');
    }

    const tablesDB = systemTables();
    const intentId = ulid();
    const payloadStr = JSON.stringify(input.contextPayload || {});

    const newIntent: any = await tablesDB.createRow({
        databaseId: 'turso',
        tableId: 'agent_payment_intents',
        rowId: intentId,
        data: {
            userId: actor.$id,
            agentId: input.agentId,
            amount: input.amount,
            status: 'pending',
            payload: payloadStr,
            chainId: input.chainId,
            txHash: ''
        }
    });

    return {
        success: true,
        intent: {
            id: newIntent.$id || intentId,
            userId: actor.$id,
            agentId: input.agentId,
            amount: input.amount,
            status: 'pending',
            payload: payloadStr,
            chainId: input.chainId,
            txHash: ''
        }
    };
}

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

    const tablesDB = systemTables();

    const intent = await tablesDB.getRow({
        databaseId: 'turso',
        tableId: 'agent_payment_intents',
        rowId: input.intentId
    }).catch(() => null);

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

        await tablesDB.updateRow({
            databaseId: 'turso',
            tableId: 'agent_payment_intents',
            rowId: input.intentId,
            data: {
                status: 'completed',
                txHash: txHash
            }
        });

        return {
            success: true,
            txHash: txHash,
            status: 'completed'
        };
    } catch (err: any) {
        await tablesDB.updateRow({
            databaseId: 'turso',
            tableId: 'agent_payment_intents',
            rowId: input.intentId,
            data: {
                status: 'failed'
            }
        }).catch(() => {});
        throw new Error(`Gas relay submission failed: ${err.message}`);
    }
}
