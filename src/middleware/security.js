// Headers applied to every response.
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob:; media-src 'self'; frame-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'self'"
    );
    next();
}

module.exports = { securityHeaders };
