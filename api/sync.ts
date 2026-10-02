// Vercel Serverless Function: Cloud Data Sync for Google Authenticated Users
export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  const { userId } = req.method === 'GET' ? req.query : req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  const storageKey = `classgrid_user_${userId}`;

  // 1. GET User Data
  if (req.method === 'GET') {
    if (!kvUrl || !kvToken) {
      // KV not yet connected in Vercel dashboard
      return res.status(200).json({
        success: true,
        data: null,
        notice: 'Vercel KV not configured yet. Using local persistent storage.',
      });
    }

    try {
      const response = await fetch(`${kvUrl}/get/${encodeURIComponent(storageKey)}`, {
        headers: {
          Authorization: `Bearer ${kvToken}`,
        },
      });

      if (!response.ok) {
        return res.status(200).json({ success: true, data: null });
      }

      const result = await response.json();
      let data = result?.result;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {}
      }

      return res.status(200).json({
        success: true,
        data: data || null,
      });
    } catch (err: any) {
      console.error('Failed to read from KV:', err);
      return res.status(500).json({ error: err.message || 'Storage error' });
    }
  }

  // 2. POST User Data
  if (req.method === 'POST') {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data in request body' });
    }

    if (!kvUrl || !kvToken) {
      return res.status(200).json({
        success: true,
        saved: false,
        notice: 'Vercel KV not configured yet. Saved locally.',
      });
    }

    try {
      const payloadString = JSON.stringify(data);
      const response = await fetch(`${kvUrl}/set/${encodeURIComponent(storageKey)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: payloadString,
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: err || 'Failed to save to KV' });
      }

      return res.status(200).json({
        success: true,
        saved: true,
      });
    } catch (err: any) {
      console.error('Failed to write to KV:', err);
      return res.status(500).json({ error: err.message || 'Storage write error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
