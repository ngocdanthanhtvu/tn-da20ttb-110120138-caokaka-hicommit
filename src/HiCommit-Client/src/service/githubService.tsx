import axios from 'axios';

export class RunnerSetupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RunnerSetupError';
    }
}

// Upgrade supported C callers using each signed-in student's own token.
export const shouldUpgradeCWorkflow = (owner: string) => Boolean(owner);

const LEGACY_C_RUNNER = 'ngocdanthanhtvu/hicommit-runner/.github/workflows/c-runner.yml@35880c4dd87f02f5b6ca1aef8ee2560094c9dd47';
const CURRENT_C_RUNNER = 'ngocdanthanhtvu/hicommit-runner/.github/workflows/c-runner.yml@5c115972e98e05fa7c3089f7f37e08be9d7f3279';

// Hàm khởi tạo các API service với accessToken
const createGitHubAPI = (accessToken: any) => {

    const githubAPI = axios.create({
        baseURL: 'https://api.github.com',
        timeout: 20000,
        headers: {
            Authorization: `token ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
        },
    });

    const getRepoInfo = async (owner: any, repo: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}`, {
                params: {
                    t: new Date().getTime(),
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error getting repo info:', error);
            throw error;
        }
    };

    const getRepoBranchInfo = async (owner: any, repo: any, branch: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}/contents`, {
                params: {
                    t: new Date().getTime(),
                    ref: branch,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error getting repo info:', error);
            throw error;
        }
    };

    const createRepo = async (repoName: any, description: any) => {
        try {
            const response = await githubAPI.post('/user/repos', {
                name: repoName,
                description: description,
            });
            return response.data;
        } catch (error) {
            console.error('Error creating repo:', error);
            throw error;
        }
    }

    // Hàm để lấy thông tin SHA của nhánh trong repo template
    const getBranchSha = async (owner: any, repo: any, branch: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
            return response.data.object.sha;
        } catch (error) {
            console.error('Error getting branch SHA:', error);
            throw error;
        }
    };

    // Hàm để tạo một nhánh mới cho repository
    const createBranchForRepo = async (owner: any, repo: any, branch: any, sha: any) => {
        try {
            const response = await githubAPI.post(`/repos/${owner}/${repo}/git/refs`, {
                ref: `refs/heads/${branch}`,
                sha: sha,
            });
            return response.data;
        } catch (error) {
            console.error('Error creating branch:', error);
            throw error;
        }
    };

    // Hàm để lấy thông tin SHA của file
    const getFileSha = async (owner: any, repo: any, branch: any, path: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}/contents/${path}`, {
                params: {
                    ref: branch,
                    t: new Date().getTime(),
                }
            });
            return response.data.sha;
        } catch (error) {
            console.error('Error getting file SHA:', error);
            throw error;
        }
    };

    // Hàm để commit một file mới hoặc cập nhật file hiện có
    const commitFile = async (owner: any, repo: any, branch: any, path: any, content: any, message: any) => {
        try {
            const fileSha = await getFileSha(owner, repo, branch, path).catch((error) => {
                if (axios.isAxiosError(error) && error.response?.status === 404) return null;
                throw error;
            });

            const response = await githubAPI.put(`/repos/${owner}/${repo}/contents/${path}`, {
                message,
                content: btoa(
                    Array.from(
                        new TextEncoder().encode(content),
                        byte => String.fromCharCode(byte)
                    ).join('')
                ),
                sha: fileSha,
                branch: branch
            });

            return response.data;
        } catch (error) {
            console.error('Error committing file:', error);
            throw error;
        }
    };

    const getFileContent = async (owner: any, repo: any, branch: any, path: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}/contents/${path}`, {
                params: { ref: branch }
            });
            const binary = atob(response.data.content.replace(/\n/g, ''));
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        } catch (error) {
            console.error('Error getting file content:', error);
            throw error;
        }
    };

    // Upgrade only the known C caller, with the signed-in student's own token.
    // Await this configuration commit before committing source. Never overwrite main.c here.
    const ensureCWorkflow = async (owner: string, repo: string, branch: string) => {
        const workflowPath = `/repos/${owner}/${repo}/contents/.github/workflows/ci.yml`;
        const read = async () => {
            const response = await githubAPI.get(workflowPath, { params: { ref: branch } });
            if (response.data.encoding !== 'base64' || typeof response.data.content !== 'string' || !response.data.sha) {
                throw new RunnerSetupError('Không đọc được cấu hình chấm bài. Chưa gửi mã nguồn; vui lòng báo giảng viên.');
            }
            const bytes = Uint8Array.from(atob(response.data.content.replace(/\s/g, '')), char => char.charCodeAt(0));
            const text = new TextDecoder('utf-8').decode(bytes);
            const callers = [...text.matchAll(/^[ \t]*uses:[ \t]*(ngocdanthanhtvu\/hicommit-runner\/\.github\/workflows\/c-runner\.yml@[a-f0-9]{40})[ \t]*(?:#.*)?\r?$/gm)];
            if (callers.length !== 1 || ![LEGACY_C_RUNNER, CURRENT_C_RUNNER].includes(callers[0][1])) {
                throw new RunnerSetupError('Workflow chấm bài khác phiên bản được hỗ trợ. Chưa gửi mã nguồn; vui lòng báo giảng viên.');
            }
            return { text, sha: response.data.sha, runner: callers[0][1], line: callers[0][0] };
        };
        try {
            const file = await read();
            if (file.runner === CURRENT_C_RUNNER) return { updated: false };
            const content = file.text.replace(file.line, file.line.replace(LEGACY_C_RUNNER, CURRENT_C_RUNNER));
            try {
                await githubAPI.put(workflowPath, {
                    message: '[config] Update HiCommit C runner', branch, sha: file.sha,
                    content: btoa(Array.from(new TextEncoder().encode(content), byte => String.fromCharCode(byte)).join(''))
                });
            } catch (error) {
                // Another tab may have upgraded it, or the write may have succeeded before a network timeout.
                // Confirm by reading; do not blindly repeat a write with an uncertain outcome.
                try {
                    if ((await read()).runner === CURRENT_C_RUNNER) return { updated: false };
                } catch { /* Report the original failure below. */ }
                throw error;
            }
            return { updated: true };
        } catch (error) {
            if (error instanceof RunnerSetupError) throw error;
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                const headers = error.response?.headers;
                const message = String(error.response?.data?.message || '');
                if (status === 429 || (status === 403 && (String(headers?.['x-ratelimit-remaining']) === '0' || headers?.['retry-after'] || /rate limit|abuse/i.test(message)))) {
                    throw new RunnerSetupError('GitHub đang giới hạn yêu cầu. Chưa gửi mã nguồn; vui lòng chờ rồi thử lại.');
                }
                if (status === 401 || status === 403) {
                    throw new RunnerSetupError('GitHub chưa cho phép cập nhật workflow. Chưa gửi mã nguồn; hãy đăng nhập lại HiCommit bằng GitHub và cấp quyền được yêu cầu. Nếu vẫn lỗi, báo giảng viên.');
                }
                if (status === 404) {
                    throw new RunnerSetupError('Không tìm thấy hoặc không có quyền đọc workflow chấm bài. Chưa gửi mã nguồn; vui lòng báo giảng viên.');
                }
            }
            throw new RunnerSetupError('Chưa xác nhận được cấu hình chấm bài trên GitHub. Mã nguồn chưa được gửi; vui lòng thử lại khi kết nối ổn định.');
        }
    };

    // Note: Hàm tạo một repo từ repo template
    const createRepoFromTemplate = async () => {
        try {
            const response = await githubAPI.post(`/repos/ngocdanthanhtvu/hicommit-templates/generate`, {
                name: "hicommit-problems",
                include_all_branches: true,
            });
            return response.data;
        } catch (error) {
            console.error('Error creating repo from template:', error);
            throw error;
        }
    }

    // Note: Hàm fork một repo từ repo template
    const forkRepoFromTemplate = async () => {
        try {
            const response = await githubAPI.post(`/repos/hicommit/templates/forks`,  {
                name: "hicommit-problems",
                default_branch_only: false,
            });
            return response.data;
        } catch (error) {
            console.error('Error forking repo from template:', error);
            throw error;
        }
    }

    // Note: Hoạt động tốt, chỉ hoạt động với repo được fork từ template
    const syncBranchFromTemplate = async (owner: any, repo: any, branch: any) => {
        try {
            const response = await githubAPI.post(`/repos/${owner}/${repo}/merge-upstream`, {
                branch: branch,
            });

            return response;
        } catch (error) {
            console.error('Error creating repo or branch from template:', error);
            throw error;
        }
    }

    // Note: Hàm tạo một branch bài tập từ 1 branch template (cùng repo)
    const createBranchFromBranch = async (owner: any, repo: any, branch: any, baseBranch: any) => {
        try {
            const baseBranchSha = await getBranchSha(owner, repo, baseBranch);
            const response = await createBranchForRepo(owner, repo, branch, baseBranchSha);

            return response;
        } catch (error) {
            console.error('Error creating branch from branch:', error);
            throw error;
        }
    }

    // Hàm để lấy thông tin của một action cụ thể
    const getActionInfo = async (owner: any, repo: any, runId: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}/actions/runs/${runId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting action info:', error);
            throw error;
        }
    };

    // Hàm để lấy danh sách các actions trong một repository trên một nhánh nhất định
    const getActionsByBranch = async (owner: any, repo: any, branch: any) => {
        try {
            const response = await githubAPI.get(`/repos/${owner}/${repo}/actions/runs`, {
                params: {
                    branch: branch,
                    t: new Date().getTime(),
                },
            });
            return response.data.workflow_runs;
        } catch (error) {
            console.error('Error getting actions by branch:', error);
            throw error;
        }
    };

    return {
        ensureCWorkflow,
        getFileSha,
        getFileContent,
        getBranchSha,
        createBranchForRepo,
        commitFile,
        getRepoInfo,
        getRepoBranchInfo,
        createRepo,
        getActionInfo,
        getActionsByBranch,
        createRepoFromTemplate,
        forkRepoFromTemplate,
        syncBranchFromTemplate,
        createBranchFromBranch
    };
};

export default createGitHubAPI;
