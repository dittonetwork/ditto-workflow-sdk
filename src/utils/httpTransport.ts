import type { HttpTransportConfig } from 'viem';

/**
 * Returns a viem Http transport config with Authorization header if token provided.
 */
export function authHttpConfig(accessToken?: string): HttpTransportConfig | undefined {
  if (!accessToken) return undefined;
  return {
    fetchOptions: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  } as HttpTransportConfig;
}

