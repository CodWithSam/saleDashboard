// Serves the web UI and forwards /api/* to your Spring backend (so the browser needs no CORS setup).
const express = require('express');
const path = require('path');
const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
const PORT = process.env.PORT || 3000;

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', async (req, res) => {
  try {
    const headers = {};
    for (const h of ['content-type', 'content-length', 'authorization', 'accept']) if (req.headers[h]) headers[h] = req.headers[h];
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const r = await fetch(BACKEND + req.originalUrl.replace(/^\/api/, ''), {
      method: req.method, headers, body: hasBody ? req : undefined, duplex: 'half', signal: AbortSignal.timeout(120000)
    });
    res.status(r.status);
    const ct = r.headers.get('content-type');
    if (ct) res.type(ct);
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: 'Cannot reach the backend at ' + BACKEND });
  }
});
const server = app.listen(PORT, () => console.log(`UI on http://localhost:${PORT} -> backend ${BACKEND}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
