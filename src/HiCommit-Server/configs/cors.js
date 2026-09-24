const allowedDomains = [
    'http://192.168.0.103:5173',
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:8081',
    'https://localhost:8081',
    process.env.CLIENT_URL,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;

    if (allowedDomains.includes(origin)) {
        return true;
    }

    return /^https:\/\/[a-zA-Z0-9-]+-5173\.app\.github\.dev$/.test(origin);
};

module.exports = {
    allowedDomains,
    isAllowedOrigin,
};
