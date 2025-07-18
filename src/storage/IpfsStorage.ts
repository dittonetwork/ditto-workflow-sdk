import { IWorkflowStorage, SerializedWorkflowData } from './IWorkflowStorage';

const TIMEOUT_MS = 30000;
const RETRIES = 3;

async function fetchWithRetry(url: string, options: RequestInit, retries = RETRIES): Promise<Response> {
  let attempt = 0;
  let delay = 500;
  while (attempt < retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
  throw new Error('Failed to fetch with retry');
}

export class IpfsStorage implements IWorkflowStorage {
  constructor(private readonly ipfsServiceUrl: string) { }

  async upload(data: SerializedWorkflowData): Promise<string> {
    const response = await fetchWithRetry(`${this.ipfsServiceUrl}/ipfs/upload`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json() as { cid: string };
    return responseData.cid;
  }

  async download(ipfsHash: string): Promise<SerializedWorkflowData> {
    const response = await fetchWithRetry(`${this.ipfsServiceUrl}/ipfs/read/${ipfsHash}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`IPFS download failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/octet-stream')) {
      const text = await response.text();
      try {
        return JSON.parse(text) as SerializedWorkflowData;
      } catch (error) {
        throw new Error('Invalid JSON response from IPFS');
      }
    } else if (contentType?.includes('application/json')) {
      return await response.json() as SerializedWorkflowData;
    } else {
      const text = await response.text();
      return JSON.parse(text) as SerializedWorkflowData;
    }
  }
} 