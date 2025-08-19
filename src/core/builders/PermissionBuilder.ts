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

function serializeForKey(value: any): string {
    if (typeof value === 'bigint') {
        return `__bigint__:${value.toString()}`;
    }
    try {
        return JSON.stringify(value, (_key, val) =>
            typeof val === 'bigint' ? `__bigint__:${val.toString()}` : val
        );
    } catch (_e) {
        return String(value);
    }
}

function deduplicateAndMergePermissions(permissions: Permission[]): Permission[] {
    const groupKey = (p: Permission) => `${p.target}|${p.functionName}|${serializeForKey(p.abi)}`;
    const groups = new Map<string, Permission[]>();
    for (const p of permissions) {
        const key = groupKey(p);
        const list = groups.get(key);
        if (list) {
            list.push(p);
        } else {
            groups.set(key, [p]);
        }
    }

    const result: Permission[] = [];
    for (const [, group] of groups) {
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }

        const reference = group[0];
        const argsLengthConsistent = group.every(g => g.args.length === reference.args.length);
        if (!argsLengthConsistent) {
            result.push(...group);
            continue;
        }

        const mergedArgs: Permission['args'] = [];
        let canMerge = true;
        for (let i = 0; i < reference.args.length; i++) {
            const argsAtIndex = group.map(g => g.args[i]);
            const allNull = argsAtIndex.every(a => a === null);
            if (allNull) {
                mergedArgs.push(null);
                continue;
            }
            const allEqualRestrictions = argsAtIndex.every(a => a !== null && a.condition === ParamCondition.EQUAL);
            if (!allEqualRestrictions) {
                canMerge = false;
                break;
            }
            const uniqueValues = new Map<string, any>();
            for (const a of argsAtIndex) {
                const key = serializeForKey(a!.value);
                if (!uniqueValues.has(key)) {
                    uniqueValues.set(key, a!.value);
                }
            }
            mergedArgs.push({
                condition: ParamCondition.ONE_OF,
                value: Array.from(uniqueValues.values()),
            });
        }

        if (!canMerge) {
            result.push(...group);
            continue;
        }

        const mergedValueLimit = group.reduce<bigint>((maxSoFar, p) => {
            if (typeof p.valueLimit === 'bigint' && p.valueLimit > maxSoFar) {
                return p.valueLimit;
            }
            return maxSoFar;
        }, BigInt(0));

        result.push({
            target: reference.target,
            valueLimit: mergedValueLimit,
            abi: reference.abi,
            functionName: reference.functionName,
            args: mergedArgs,
        });
        for (const arg of mergedArgs) {
            if (arg === null) {
                continue;
            }
            if (arg.condition === ParamCondition.ONE_OF) {
                console.log(arg.value);
            }
        }
    }

    return result;
}

export function buildPolicies(workflow: Workflow, prodContract: boolean, job: Job): ReturnType<typeof toCallPolicy>[] {

    const permissions: Permission[] = job.steps.map(step => {
        const abiFunctions = step.getAbi();
        const abiFunction = abiFunctions[0];
        return {
            target: step.target as `0x${string}`,
            valueLimit: step.value ?? BigInt(0),
            abi: abiFunctions,
            functionName: step.getFunctionName(),
            args: step.args.map((arg, index) => {
                if (arg === null) {
                    return null;
                }
                const paramType = abiFunction?.inputs?.[index]?.type;
                const isStringType = typeof paramType === 'string' && paramType.startsWith('string');
                if (isStringType) {
                    return null;
                }
                return {
                    condition: ParamCondition.EQUAL,
                    value: arg,
                };
            }),
        };
    });

    permissions.push({
        target: getDittoWFRegistryAddress(prodContract),
        valueLimit: BigInt(0),
        abi: DittoWFRegistryAbi,
        functionName: "markRun",
        args: [
            null,
        ],
    });

    const dedupedPermissions = deduplicateAndMergePermissions(permissions);

    const policies = [
        toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            permissions: dedupedPermissions,
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