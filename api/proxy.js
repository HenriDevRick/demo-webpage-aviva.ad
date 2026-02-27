const https = require('https');
const http = require('http');

const TARGET_HOST = 'adqura02.pegalabs.io';

module.exports = async (req, res) => {
  // Handle preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Strip /api/proxy prefix, keep /prweb/...
  const targetPath = req.url.replace(/^\/api\/proxy/, '') || '/';

  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST,
    },
  };

  // Remove headers that cause issues
  delete options.headers['origin'];
  delete options.headers['referer'];

  return new Promise((resolve, reject) => {
    const proxyReq = https.request(options, (proxyRes) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(proxyRes.statusCode);

      // Forward response headers except CORS ones (we set our own)
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (!key.toLowerCase().startsWith('access-control')) {
          res.setHeader(key, value);
        }
      });

      proxyRes.pipe(res);
      proxyRes.on('end', resolve);
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'Proxy error', detail: err.message });
      resolve();
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
      req.on('end', () => proxyReq.end());
    } else {
      proxyReq.end();
    }
  });
};
