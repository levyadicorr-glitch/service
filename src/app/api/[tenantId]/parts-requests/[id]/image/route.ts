import { NextRequest, NextResponse } from 'next/server';
import { getPartRequestById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';

// Serves a part request's photo as raw image bytes (not base64-in-JSON), so the
// admin part-requests list can lazy-load thumbnails on demand instead of
// shipping every image inside the page payload. The browser caches the result.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const request = await getPartRequestById(tenantId, id);
    if (!request || !request.photoImage) {
      return NextResponse.json({ error: 'תמונה לא נמצאה' }, { status: 404 });
    }

    // Stored as a "data:image/webp;base64,...." data URI — decode it back to
    // binary and serve with the real content type.
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(request.photoImage);
    if (!match) {
      return NextResponse.json({ error: 'פורמט תמונה לא תקין' }, { status: 500 });
    }
    const contentType = match[1];
    const bytes = Buffer.from(match[2], 'base64');

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: unknown) {
    console.error('Error fetching part request image:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
