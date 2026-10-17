// Runs the PMS backend (server.js — portal access, blood report extraction and
// the Zoho Calendar endpoints) as one Netlify Function. netlify.toml rewrites
// /api/* here.
import serverless from 'serverless-http';
import app from '../../server.js';

export const handler = serverless(app, {
  request(req) {
    // Rewrites can arrive with the function path; the Express routes expect /api/...
    req.url = req.url.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');

    // serverless-http hands Express the raw body as a Buffer, which makes
    // Express 5's json() / multer skip it. Parse JSON here; for uploads clear it
    // so multer reads the multipart stream itself.
    if (Buffer.isBuffer(req.body)) {
      if (/application\/json/i.test(String(req.headers['content-type'] || ''))) {
        try {
          req.body = req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
        } catch {
          req.body = {};
        }
      } else {
        req.body = undefined;
      }
    }
  },
});
