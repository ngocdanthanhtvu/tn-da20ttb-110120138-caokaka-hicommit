const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_OIDC_AUDIENCE = 'hicommit-backend';

const TRUSTED_WORKFLOW_REF =
    'ngocdanthanhtvu/hicommit-runner/.github/workflows/c-runner.yml@35880c4dd87f02f5b6ca1aef8ee2560094c9dd47';

let josePromise;
let remoteJwks;

async function getJose() {
    if (!josePromise) {
        josePromise = import('jose');
    }
    return josePromise;
}

async function getRemoteJwks() {
    if (!remoteJwks) {
        const { createRemoteJWKSet } = await getJose();

        remoteJwks = createRemoteJWKSet(
            new URL('https://token.actions.githubusercontent.com/.well-known/jwks')
        );
    }

    return remoteJwks;
}

function claimsMatchCallback(payload, body) {
    const {
        problem,
        actor,
        run_id,
        run_attempt,
        sha,
    } = body;

    const expectedRepository = `${actor}/hicommit-problems`;
    const expectedRef = `refs/heads/${problem}`;

    return (
        payload.repository === expectedRepository &&
        payload.actor === actor &&
        payload.ref === expectedRef &&
        payload.sha === sha &&
        String(payload.run_id) === String(run_id) &&
        String(payload.run_attempt) === String(run_attempt)
    );
}

exports.claimsMatchCallback = claimsMatchCallback;

exports.verifyGitHubOidc = async (req, res, next) => {
    try {
        const authorization = req.get('authorization');

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing GitHub OIDC token' });
        }

        const token = authorization.slice('Bearer '.length).trim();

        const { jwtVerify } = await getJose();
        const jwks = await getRemoteJwks();

        const { payload } = await jwtVerify(token, jwks, {
            issuer: GITHUB_OIDC_ISSUER,
            audience: GITHUB_OIDC_AUDIENCE,
        });

        if (payload.job_workflow_ref !== TRUSTED_WORKFLOW_REF) {
            return res.status(403).json({ error: 'Untrusted GitHub workflow' });
        }

        if (!claimsMatchCallback(payload, req.body)) {
            return res.status(403).json({
                error: 'GitHub OIDC claims do not match callback payload',
            });
        }

        req.githubOidc = payload;

        next();
    } catch (error) {
        console.error('Error verifying GitHub OIDC token:', error.message);
        return res.status(401).json({ error: 'Invalid GitHub OIDC token' });
    }
};

exports.verifyGitHubOidcForTestcases = async (req, res, next) => {
    try {
        const authorization = req.get('authorization');

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing GitHub OIDC token' });
        }

        const token = authorization.slice('Bearer '.length).trim();

        const { jwtVerify } = await getJose();
        const jwks = await getRemoteJwks();

        const { payload } = await jwtVerify(token, jwks, {
            issuer: GITHUB_OIDC_ISSUER,
            audience: GITHUB_OIDC_AUDIENCE,
        });

        if (payload.job_workflow_ref !== TRUSTED_WORKFLOW_REF) {
            return res.status(403).json({ error: 'Untrusted GitHub workflow' });
        }

        const expectedRef = `refs/heads/${req.params.slug}`;

        if (
            typeof payload.repository !== 'string' ||
            !payload.repository.endsWith('/hicommit-problems') ||
            payload.ref !== expectedRef
        ) {
            return res.status(403).json({
                error: 'GitHub OIDC claims do not match testcase request',
            });
        }

        req.githubOidc = payload;

        next();
    } catch (error) {
        console.error('Error verifying GitHub OIDC token:', error.message);
        return res.status(401).json({ error: 'Invalid GitHub OIDC token' });
    }
};
