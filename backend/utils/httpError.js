// Throwable error that carries an HTTP status code and optional details
class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
module.exports = HttpError;
