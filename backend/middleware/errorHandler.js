// Central error handler: turns any thrown error into a meaningful JSON response
const HttpError = require('../utils/httpError');
const DB_DOWN = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND',
                 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ECONNRESET', 'EHOSTUNREACH'];

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[ERROR]', req.method, req.originalUrl, '→', err.code || '', err.message);

    const send = (status, message, extra = {}) =>
        res.status(status).json({ success: false, message, ...extra });

    if (err instanceof HttpError)
        return send(err.status, err.message, err.details ? { details: err.details } : {});

    if (err.type === 'entity.parse.failed') return send(400, 'Request body is not valid JSON');
    if (DB_DOWN.includes(err.code))
        return send(503, 'Database is currently unavailable. Please try again shortly.');

    switch (err.code) {
        case 'ER_DUP_ENTRY':
            return send(400, 'Duplicate entry — a record with that unique value already exists');
        case 'ER_ROW_IS_REFERENCED_2':
            return send(400, 'Cannot delete — this record is referenced by other data');
        case 'ER_NO_REFERENCED_ROW_2':
            return send(400, 'A referenced record (supplier, vendor or fruit) does not exist');
        case 'ER_CHECK_CONSTRAINT_VIOLATED':
        case 'ER_CONSTRAINT_FAILED':
            return send(400, 'A value violates a database rule (e.g. negative quantity or stock)');
        case 'ER_NO_SUCH_TABLE':
            return send(500, req.originalUrl.startsWith('/api/auth') ? 'Account tables are missing — run npm run auth:setup' : 'Database tables are missing — check your existing farm schema');
        case 'ER_DATA_TOO_LONG':
        case 'WARN_DATA_TRUNCATED':
        case 'ER_TRUNCATED_WRONG_VALUE':
            return send(400, 'One of the values is too long or in the wrong format');
    }
    send(err.status || 500, 'Unexpected server error');
};
module.exports = errorHandler;
