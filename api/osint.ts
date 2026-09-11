import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';

const ghuntPath = process.env.GHUNT_PATH || 'ghunt';

let piexif: any;
async function getPiexif() {
  if (!piexif) {
    const mod = await import('piexifjs');
    piexif = mod.default || mod;
  }
  return piexif;
}

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

  if (!base64Data) {
    return response.status(400).json({ error: 'imageData (base64) is required' });
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const p = await getPiexif();

    if (action === 'extract') {
      const exifObj = p.load(buffer.toString('binary'));
      const metadata: Record<string, string> = {};

      const tagMap0th: Record<string, string[]> = {
        Make: ['0th', 'Make'], Model: ['0th', 'Model'],
        Orientation: ['0th', 'Orientation'], Software: ['0th', 'Software'],
        DateTime: ['0th', 'DateTime'], Artist: ['0th', 'Artist'],
        Copyright: ['0th', 'Copyright'],
      };

      const tagMapExif: Record<string, string[]> = {
        ExposureTime: ['Exif', 'ExposureTime'], FNumber: ['Exif', 'FNumber'],
        ISOSpeedRatings: ['Exif', 'ISOSpeedRatings'], FocalLength: ['Exif', 'FocalLength'],
        DateTimeDigitized: ['Exif', 'DateTimeDigitized'], DateTimeOriginal: ['Exif', 'DateTimeOriginal'],
        LensMake: ['Exif', 'LensMake'], LensModel: ['Exif', 'LensModel'],
      };

      const readTags = (tagMap: Record<string, string[]>) => {
        for (const [name, [ifd, key]] of Object.entries(tagMap)) {
          const val = exifObj[ifd]?.[key];
          if (val !== undefined && val !== null && String(val) !== '') {
            metadata[name] = String(val);
          }
        }
      };

      readTags(tagMap0th);
      readTags(tagMapExif);

      metadata.allTags = String(
        Object.keys(exifObj['0th'] ?? {}).length +
        Object.keys(exifObj['Exif'] ?? {}).length
      );

      if (exifObj['GPS']?.GPSLatitude && exifObj['GPS']?.GPSLongitude) {
        const lat = exifObj['GPS']['GPSLatitude'];
        const lon = exifObj['GPS']['GPSLongitude'];
        metadata.GPS = JSON.stringify({
          latitude: Array.isArray(lat) ? lat.map(v => String(v)).join(', ') : String(lat),
          longitude: Array.isArray(lon) ? lon.map(v => String(v)).join(', ') : String(lon),
        });
      }

      return response.status(200).json({ metadata, success: true });
    }

    if (action === 'sanitize') {
      const sanitized = p.remove(buffer.toString('binary'));
      const sanitizedBuffer = Buffer.from(sanitized, 'binary');

      return response.status(200).json({
        sanitized: `data:image/jpeg;base64,${sanitizedBuffer.toString('base64')}`,
        originalSize: buffer.length,
        success: true,
        message: 'All EXIF data removed',
      });
    }

    return response.status(400).json({ error: 'Invalid action. Use "extract" or "sanitize"' });
  } catch (error) {
    console.error('EXIF request failed:', error);
    return response.status(503).json({
      error: 'EXIF processing failed',
      details: error instanceof Error ? error.message : String(error),
    });
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
