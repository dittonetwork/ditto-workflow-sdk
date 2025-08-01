import { Job } from '../Job';
import { Workflow } from '../Workflow';
import {
    toCallPolicy,
    CallPolicyVersion,
    ParamCondition,
    toRateLimitPolicy,
    toTimestampPolicy
} from "@zerodev/permissions/policies";
import { DittoWFRegistryAbi } from '../../utils/constants';
import { getDittoWFRegistryAddress } from '../../utils/chainConfigProvider';
import { Address } from 'viem';

interface Permission {
    target: Address;
    valueLimit: bigint | undefined;
    abi: any[];
    functionName: string;
    args: (null | { condition: ParamCondition; value: any })[];
}

export function buildPolicies(workflow: Workflow, job: Job): ReturnType<typeof toCallPolicy>[] {
    const permissions: Permission[] = job.steps.map(step => ({
        target: step.target as `0x${string}`,
        valueLimit: step.value ?? BigInt(0),
        abi: step.getAbi(),
        functionName: step.getFunctionName(),
        args: step.args.map(arg => arg === null ? null : ({
            condition: ParamCondition.EQUAL,
            value: arg,
        })),
    }));
    permissions.push({
        target: getDittoWFRegistryAddress(),
        valueLimit: BigInt(0),
        abi: DittoWFRegistryAbi,
        functionName: "markRun",
        args: [
            null,
        ],
    });
    const policies = [
        toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            permissions: permissions,
        }),
    ];
    if (workflow.count && workflow.count > 0) {
        if (workflow.interval && workflow.interval > 0) {
            policies.push(toRateLimitPolicy({
                count: workflow.count,
                interval: workflow.interval,
            }));
        } else {
            policies.push(toRateLimitPolicy({
                count: workflow.count,
            }));
        }
    }
    if (workflow.validUntil) {
        if (workflow.validAfter) {
            policies.push(toTimestampPolicy({
                validAfter: Math.floor(workflow.validAfter.getTime() / 1000),
                validUntil: Math.floor(workflow.validUntil.getTime() / 1000),
            }));
        } else {
            policies.push(toTimestampPolicy({
                validUntil: Math.floor(workflow.validUntil.getTime() / 1000),
            }));
        }
    } else if (workflow.validAfter) {
        policies.push(toTimestampPolicy({
            validAfter: Math.floor(workflow.validAfter.getTime() / 1000),
        }));
    }
    return policies;
} 