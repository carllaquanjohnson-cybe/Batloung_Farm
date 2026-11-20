'use strict';
// Same-origin CSRF defense: the frontend is served by the same backend host.
// Block browser cross-site writes even when the user has a session cookie.
function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const site = req.get('sec-fetch-site');
  if (site === 'cross-site') return res.status(403).json({ success: false, message: 'Cross-site action blocked.' });
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get('host') || parsed.protocol.replace(':', '') !== req.protocol) throw new Error('Different origin');
    } catch { return res.status(403).json({ success: false, message: 'Origin check failed.' }); }
  }
  next();
}
// Simple IP-scoped limiter for a single Node instance. For multi-instance
// production replace with a shared persistent rate-limit store.
function rateLimit({ limit = 8, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (attempts.size > 4000) for (const [key, hit] of attempts) if (hit.reset <= now) attempts.delete(key);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const hit = attempts.get(ip);
    if (!hit || hit.reset <= now) { attempts.set(ip, { count: 1, reset: now + windowMs }); return next(); }
    hit.count += 1;
    if (hit.count > limit) {
      res.set('Retry-After', Math.ceil((hit.reset - now) / 1000));
      return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
    }
    next();
  };
}
module.exports = { sameOriginOnly, rateLimit };
