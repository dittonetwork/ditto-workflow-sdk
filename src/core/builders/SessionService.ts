import { Address, createPublicClient, http } from 'viem';
import { Signer } from "@zerodev/sdk/types";
import {
    createKernelAccount,
    CreateKernelAccountReturnType,
} from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { serializePermissionAccount, toPermissionValidator } from "@zerodev/permissions";
import { toEmptyECDSASigner } from "@zerodev/permissions/signers";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { Job } from '../Job';
import { Workflow } from '../Workflow';
import { buildPolicies } from './PermissionBuilder';
import { getChainConfig } from '../../utils/constants';

export async function createSession(
    workflow: Workflow,
    job: Job,
    executorAddress: Address,
    owner: Signer
): Promise<string> {
    const chainConfig = getChainConfig();
    const chain = chainConfig[job.chainId]?.chain;
    const rpcUrl = chainConfig[job.chainId]?.rpcUrl;
    const entryPoint = getEntryPoint("0.7");
    const publicClient = createPublicClient({
        transport: http(rpcUrl),
        chain: chain,
    });

    const policies: ReturnType<typeof buildPolicies> = buildPolicies(workflow, job);

    const sessionAccountSigner = await toEmptyECDSASigner(executorAddress);
    const sessionKeyValidator = await toPermissionValidator(publicClient, {
        entryPoint: entryPoint,
        signer: sessionAccountSigner,
        policies: policies,
        kernelVersion: KERNEL_V3_3,
    });

    let sessionKeyKernelAccount: CreateKernelAccountReturnType<"0.7"> | null = null;
    const ownerValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint,
        signer: owner,
        kernelVersion: KERNEL_V3_3,
    });
    sessionKeyKernelAccount = await createKernelAccount(publicClient, {
        entryPoint: entryPoint,
        plugins: {
            sudo: ownerValidator,
            regular: sessionKeyValidator,
        },
        kernelVersion: KERNEL_V3_3,
    });
    return await serializePermissionAccount(sessionKeyKernelAccount);
} 