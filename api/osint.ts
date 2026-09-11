import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ExifTool } from 'exiftool-vendored';
import { readFileSync, unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';

const exiftool = new ExifTool({ taskTimeoutMillis: 30000 });
const ghuntPath = process.env.GHUNT_PATH || 'ghunt';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const body = request.body ?? {};
  const tool = String(body.tool ?? 'exiftool');

  if (tool === 'exiftool') {
    return handleExifTool(request, response);
  }

  if (tool === 'ghunt') {
    return handleGhunt(request, response);
  }

  return response.status(400).json({ error: 'Invalid tool. Use "exiftool" or "ghunt"' });
}

async function handleExifTool(request: VercelRequest, response: VercelResponse) {
  const action = String(request.body?.action ?? 'extract');
  const imageData = request.body?.imageData ? String(request.body.imageData) : '';
  const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');

  let tempPath: string | undefined;

  try {
    if (action === 'extract') {
      if (!base64Data) {
        return response.status(400).json({ error: 'imageData (base64) is required' });
      }

      tempPath = join(tmpdir(), `osint-exif-${Date.now()}.jpg`);
      writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));

      const tags = await exiftool.read(tempPath);
      const metadata: Record<string, string> = {};

      const relevantTags = [
        'FileName', 'FileSize', 'FileType', 'MIMEType', 'DateCreate', 'DateModify', 'DateAccess',
        'CameraMake', 'CameraModel', 'LensModel', 'FNumber', 'ExposureTime', 'ISO',
        'ExposureCompensation', 'Flash', 'FocalLength', 'Orientation',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSPosition',
        'Copyright', 'Artist', 'Author', 'Creator', 'Description',
        'Software', 'MediaCreateDate', 'SubSecCreateDate',
        'MakerNote', 'SerialNumber', 'ImageUniqueID', 'DocumentID', 'GroupID', 'Company',
        'Location', 'Country', 'State', 'City', 'Sublocation',
      ];

      for (const tag of relevantTags) {
        const val = (tags as Record<string, unknown>)[tag];
        if (val !== undefined && val !== null && String(val) !== '') {
          metadata[tag] = String(val);
        }
      }

      const lat = (tags as Record<string, unknown>)['GPSLatitude'];
      const lon = (tags as Record<string, unknown>)['GPSLongitude'];
      if (lat && lon) {
        metadata.GPS = JSON.stringify({
          latitude: String(lat),
          longitude: String(lon),
          altitude: (tags as Record<string, unknown>)['GPSAltitude'] ? String((tags as Record<string, unknown>)['GPSAltitude']) : undefined,
          position: (tags as Record<string, unknown>)['GPSPosition'] ? String((tags as Record<string, unknown>)['GPSPosition']) : undefined,
        });
      }

      metadata.allTags = String(Object.keys(tags).length);

      return response.status(200).json({ metadata, success: true });
    }

    if (action === 'sanitize') {
      if (!base64Data) {
        return response.status(400).json({ error: 'imageData (base64) is required' });
      }

      tempPath = join(tmpdir(), `osint-sanitize-${Date.now()}.jpg`);
      const outputPath = join(tmpdir(), `osint-sanitize-out-${Date.now()}.jpg`);
      writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));

      await exiftool.write(tempPath, {}, ['-tagsFile', tempPath, '-all=', '-o', outputPath]);

      const sanitizedBase64 = readFileSync(outputPath, { encoding: 'base64' });
      const sanitizedResult = `data:image/jpeg;base64,${sanitizedBase64}`;
      const outputBuffer = existsSync(outputPath) ? readFileSync(outputPath) : Buffer.alloc(0);

      return response.status(200).json({
        sanitized: sanitizedResult,
        originalSize: outputBuffer.length,
        success: true,
        message: 'EXIF data removed while preserving essential metadata',
      });
    }

    return response.status(400).json({ error: 'Invalid action. Use "extract" or "sanitize"' });
  } catch (error) {
    console.error('ExifTool request failed:', error);
    return response.status(503).json({ error: 'ExifTool processing failed', details: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    await exiftool.end();
    if (tempPath && existsSync(tempPath)) { try { unlinkSync(tempPath); } catch {} }
  }
}

async function handleGhunt(request: VercelRequest, response: VercelResponse) {
  const action = String(request.body?.action ?? 'email');
  const query = String(request.body?.query ?? '').trim();

  if (!query) {
    return response.status(400).json({ error: 'query is required' });
  }

  const validActions = ['email', 'geolocate', 'image', 'social', 'google'];
  if (!validActions.includes(action)) {
    return response.status(400).json({ error: `Invalid action. Use: ${validActions.join(', ')}` });
  }

  return new Promise((resolve) => {
    execFile(ghuntPath, [action, query], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error('GHunt request failed:', error);
        return response.status(503).json({
          error: 'GHunt processing failed',
          details: stderr || error.message,
          hint: 'GHunt requires Python and is only available for local deployment.',
        });
      }
      resolve(response.status(200).json({
        result: { action, query, output: stdout },
        success: true,
      }));
    });
  });
}
