import { Address, createPublicClient, http } from 'viem';
import { Signer } from "@zerodev/sdk/types";
import { createKernelAccount } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { serializePermissionAccount, toPermissionValidator, toInitConfig } from "@zerodev/permissions";
import { toEmptyECDSASigner } from "@zerodev/permissions/signers";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { Job } from '../Job';
import { Workflow } from '../Workflow';
import { buildPolicies } from './PermissionBuilder';
import { getChainConfig } from '../../utils/chainConfigProvider';
import { entryPointVersion } from '../../utils/constants';
import { authHttpConfig } from '../../utils/httpTransport';

export interface SessionResult {
    session: string;
    initConfig: `0x${string}`[];
}

export async function createSession(
    workflow: Workflow,
    job: Job,
    executorAddress: Address,
    owner: Signer,
    prodContract: boolean,
    ipfsServiceUrl: string,
    accessToken?: string,
): Promise<SessionResult> {
    const chainConfig = getChainConfig(ipfsServiceUrl);
    const chain = chainConfig[job.chainId]?.chain;
    const rpcUrl = chainConfig[job.chainId]?.rpcUrl;
    const entryPoint = getEntryPoint(entryPointVersion);
    const publicClient = createPublicClient({
        transport: http(rpcUrl, authHttpConfig(accessToken)),
        chain: chain,
    });

    const policies = buildPolicies(workflow, prodContract, job);

    const sessionAccountSigner = await toEmptyECDSASigner(executorAddress);
    // permissionId defaults to keccak256(policies, flag, signer)[:4] — deterministic
    // for the same policies + signer, so re-serializing the same workflow yields
    // the same session identity.
    const sessionKeyValidator = await toPermissionValidator(publicClient, {
        entryPoint,
        signer: sessionAccountSigner,
        policies,
        kernelVersion: KERNEL_V3_3,
    });

    const initConfig = await toInitConfig(sessionKeyValidator);

    const ownerValidator = await signerToEcdsaValidator(publicClient, {
        entryPoint,
        signer: owner,
        kernelVersion: KERNEL_V3_3,
    });

    // initConfig installs the permission plugin during the kernel's initialize() call.
    // Do NOT also set `regular: sessionKeyValidator` — that would put it in
    // kernelPluginManager and trigger a second install via enable-mode.
    const sessionKeyKernelAccount = await createKernelAccount(publicClient, {
        entryPoint,
        plugins: { sudo: ownerValidator },
        kernelVersion: KERNEL_V3_3,
        initConfig,
    });

    // Pass sessionKeyValidator as the 5th arg (permissionPlugin) so the serializer
    // records it with isPreInstalled=true and skips producing a stale enableSignature.
    // See @zerodev/permissions CHANGELOG 5.5.12.
    const session = await serializePermissionAccount(
        sessionKeyKernelAccount,
        undefined,
        undefined,
        undefined,
        sessionKeyValidator,
    );

    return { session, initConfig };
}
