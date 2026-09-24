const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedDomains = configuredOrigins;

const isAllowedOrigin = (origin) => {
    if (!origin) return true;

    return allowedDomains.includes(origin);
};

module.exports = {
    allowedDomains,
    isAllowedOrigin,
};
