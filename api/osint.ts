import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireDatabase } from './_lib/db.js';
import { requireAuth } from './_lib/guard.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const auth = await requireAuth(request, requireDatabase(), { permission: 'search.execute' })
    .catch(() => ({ ok: false as const, status: 503 as const, error: 'OSINT tools are unavailable' }));
  if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const body = request.body ?? {};
  const tool = String(body.tool ?? 'exiftool');

  if (tool === 'exiftool') {
    return handleExifTool(request, response);
  }

  if (tool === 'ghunt') {
    // GHunt requires Python and is only available for local deployment
    // On Vercel serverless functions, Python is not available
    return response.status(503).json({
      error: 'GHunt not available on Vercel',
      details: 'GHunt requires Python interpreter which is not available in Vercel serverless functions.',
      hint: 'For local deployment only. Use the ExifTool endpoint for image metadata.',
    });
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

    // Lazy-load piexifjs (CommonJS module) on demand
    const piexif = (await import('piexifjs')).default || (await import('piexifjs'));
    // piexifjs types the dict with numeric IFD keys; handlers access string IFD names ('0th' | 'Exif' | 'GPS').
    const exifObj = piexif.load(buffer.toString('binary')) as unknown as Record<string, Record<string, unknown>>;

    if (action === 'extract') {
      const metadata: Record<string, string> = {};

      const tagMap0th: Record<string, string[]> = {
        Make: ['0th', 'Make'],
        Model: ['0th', 'Model'],
        Orientation: ['0th', 'Orientation'],
        Software: ['0th', 'Software'],
        DateTime: ['0th', 'DateTime'],
        Artist: ['0th', 'Artist'],
        Copyright: ['0th', 'Copyright'],
      };

      const tagMapExif: Record<string, string[]> = {
        ExposureTime: ['Exif', 'ExposureTime'],
        FNumber: ['Exif', 'FNumber'],
        ISOSpeedRatings: ['Exif', 'ISOSpeedRatings'],
        FocalLength: ['Exif', 'FocalLength'],
        DateTimeDigitized: ['Exif', 'DateTimeDigitized'],
        DateTimeOriginal: ['Exif', 'DateTimeOriginal'],
        LensMake: ['Exif', 'LensMake'],
        LensModel: ['Exif', 'LensModel'],
        Flash: ['Exif', 'Flash'],
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
          latitude: Array.isArray(lat) ? lat.map((v: any) => String(v)).join(', ') : String(lat),
          longitude: Array.isArray(lon) ? lon.map((v: any) => String(v)).join(', ') : String(lon),
        });
      }

      return response.status(200).json({ metadata, success: true });
    }

    if (action === 'sanitize') {
      const sanitized = piexif.remove(buffer.toString('binary'));
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
      hint: 'Ensure the image is a valid JPEG/JPG format with readable EXIF data',
    });
  }
}