import type { VercelRequest, VercelResponse } from '@vercel/node';
import { execFile } from 'node:child_process';

const GHUNT_PATH = process.env.GHUNT_PATH || 'ghunt';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const body = request.body ?? {};
  const action = String(body.action ?? 'email');
  const query = String(body.query ?? '').trim();

  if (!query) {
    return response.status(400).json({ error: 'query is required' });
  }

  const executeGhunt = (args: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      execFile(GHUNT_PATH, args, { timeout: 120000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(stderr || error.message);
        } else {
          resolve(stdout);
        }
      });
    });
  };

  try {
    const validActions = ['email', 'geolocate', 'image', 'social', 'google'];
    if (!validActions.includes(action)) {
      return response.status(400).json({ error: `Invalid action. Use: ${validActions.join(', ')}` });
    }

    const output = await executeGhunt([action, query]);

    return response.status(200).json({
      result: { action, query, output },
      success: true,
    });
  } catch (error) {
    console.error('GHunt request failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return response.status(503).json({
      error: 'GHunt processing failed',
      details: errorMessage,
      hint: 'GHunt requires Python and is only available for local deployment. For Vercel, use a serverless function with Python runtime or deploy to a self-hosted server.',
    });
  }
}
