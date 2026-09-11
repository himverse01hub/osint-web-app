import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ExifTool } from 'exiftool-vendored';
import { readFileSync, unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exiftool = new ExifTool({
  taskTimeoutMillis: 30000,
});

const maxFileSize = 50 * 1024 * 1024;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const body = request.body ?? {};
  const action = String(body.action ?? 'extract');
  const imageData = body.imageData ? String(body.imageData) : '';
  const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');

  let tempPath: string | undefined;
  let outputPath: string | undefined;

  try {
    if (action === 'extract') {
      if (!base64Data) {
        return response.status(400).json({ error: 'imageData (base64) is required' });
      }

      tempPath = join(tmpdir(), `osint-exif-${Date.now()}.jpg`);
      writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));

      const tags = await exiftool.read(tempPath);
      const metadata: Record<string, any> = {};

      const relevantTags = [
        'FileName', 'FileSize', 'FileType', 'MIMEType', 'DateCreate', 'DateModify', 'DateAccess',
        'CameraMake', 'CameraModel', 'LensModel', 'FNumber', 'ExposureTime', 'ISO',
        'ExposureCompensation', 'Flash', 'FocalLength', 'Orientation',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSPosition',
        'Copyright', 'Artist', 'Author', 'Creator', 'Description',
        'Software', 'RawFileName', 'MediaCreateDate', 'SubSecCreateDate',
        'MakerNote', 'SerialNumber', 'ImageUniqueID', 'DocumentID', 'GroupID', 'Company',
        'Location', 'Country', 'State', 'City', 'Sublocation',
      ];

      for (const tag of relevantTags) {
        if (tags[tag] !== undefined && tags[tag] !== null && tags[tag] !== '') {
          metadata[tag] = String(tags[tag]);
        }
      }

      if (tags.GPSLatitude && tags.GPSLongitude) {
        metadata.GPS = {
          latitude: String(tags.GPSLatitude),
          longitude: String(tags.GPSLongitude),
          altitude: tags.GPSAltitude ? String(tags.GPSAltitude) : undefined,
          position: tags.GPSPosition ? String(tags.GPSPosition) : undefined,
        };
      }

      metadata.allTags = Object.keys(tags).length;

      return response.status(200).json({ metadata, success: true });
    }

    if (action === 'sanitize') {
      if (!base64Data) {
        return response.status(400).json({ error: 'imageData (base64) is required' });
      }

      tempPath = join(tmpdir(), `osint-sanitize-${Date.now()}.jpg`);
      outputPath = join(tmpdir(), `osint-sanitize-out-${Date.now()}.jpg`);
      writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));

      await exiftool.write(tempPath, {}, {
        overwriteOriginal: false,
        destinationFile: outputPath,
        preserve: ['FileName', 'FileModifyDate'],
        tags: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSPosition', 'MakerNote', 'Copyright', 'Author', 'Artist', 'DocumentID', 'GroupID', 'ImageUniqueID'],
      });

      const sanitizedBase64 = readFileSync(outputPath, { encoding: 'base64' });
      const sanitizedResult = `data:image/jpeg;base64,${sanitizedBase64}`;
      const stats = existsSync(outputPath) ? readFileSync(outputPath) : Buffer.alloc(0);

      return response.status(200).json({
        sanitized: sanitizedResult,
        originalSize: stats.length,
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
    if (outputPath && existsSync(outputPath)) { try { unlinkSync(outputPath); } catch {} }
  }
}
