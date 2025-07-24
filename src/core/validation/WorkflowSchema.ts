import { z } from 'zod';

const SerializedStepSchema = z.object({
    target: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    abi: z.string(),
    args: z.array(z.any()).readonly(),
    value: z.string(),
});

const SerializedJobWithSessionSchema = z.object({
    id: z.string(),
    chainId: z.number().positive(),
    steps: z.array(SerializedStepSchema),
    session: z.string(),
});

const TriggerSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('event'),
        params: z.object({
            signature: z.string(),
            contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            chainId: z.number().positive(),
            filter: z.record(z.any()).optional(),
        }),
    }),
    z.object({
        type: z.literal('cron'),
        params: z.object({
            schedule: z.string(),
        }),
    }),
    z.object({
        type: z.literal('time'),
        params: z.object({
            timestamp: z.number().positive(),
        }),
    }),
    z.object({
        type: z.literal('onchain'),
        params: z.object({
            target: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
            abi: z.string(),
            args: z.array(z.any()).readonly(),
            value: z.string().optional(),
            chainId: z.number().positive(),
        }),
    }),
]);

export const SerializedWorkflowDataSchema = z.object({
    workflow: z.object({
        owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        triggers: z.array(TriggerSchema),
        jobs: z.array(SerializedJobWithSessionSchema),
        count: z.number().positive().optional(),
        validAfter: z.number().positive().optional(),
        validUntil: z.number().positive().optional(),
        interval: z.number().positive().optional(),
    }),
    metadata: z.object({
        createdAt: z.number().positive(),
        version: z.string(),
    }),
});

export type ValidatedSerializedWorkflowData = z.infer<typeof SerializedWorkflowDataSchema>; 