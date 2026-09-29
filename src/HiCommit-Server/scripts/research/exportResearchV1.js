require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const sequelize = require('../../configs/database');

const args = process.argv.slice(2);

function getArg(name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

function hasArg(name) {
    return args.includes(name);
}

function decodeBase64(value) {
    if (!value) return null;

    try {
        return Buffer.from(value, 'base64').toString('utf8');
    } catch {
        return null;
    }
}

async function main() {
    const idsArg = getArg('--ids');
    const problemArg = getArg('--problem');
    const exportAll = hasArg('--all');

    if (!idsArg && !problemArg && !exportAll) {
        console.error(
            'Usage: node exportResearchV1.js --ids ID1,ID2 | --problem SLUG | --all'
        );
        process.exit(1);
    }

    await sequelize.authenticate();

    const replacements = {};
    let whereClause = '';

    if (idsArg) {
        const ids = idsArg
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);

        if (ids.length === 0) {
            throw new Error('No valid submission IDs supplied.');
        }

        whereClause = 'WHERE s.id IN (:ids)';
        replacements.ids = ids;
    } else if (problemArg) {
        whereClause = 'WHERE s.problem_slug = :problem_slug';
        replacements.problem_slug = problemArg;
    }

    const submissions = await sequelize.query(
        `
        WITH ranked_submissions AS (
            SELECT
                s.id,
                s.problem_slug,
                CASE
                    WHEN UPPER(s.problem_slug) REGEXP '^A[0-9][0-9]($|-|_)'
                    THEN UPPER(SUBSTRING(s.problem_slug, 1, 3))
                    ELSE NULL
                END AS assignment_id,
                s.username,
                s.status,
                s.pass_count,
                s.total_count,
                (
                    SELECT p.score
                    FROM problems p
                    WHERE p.slug = s.problem_slug
                    LIMIT 1
                ) AS max_points,
                s.duration,
                s.createdAt,
                s.updatedAt,
                ROW_NUMBER() OVER (
                    PARTITION BY s.username, s.problem_slug
                    ORDER BY s.createdAt, s.id
                ) AS attempt_seq,
                MIN(s.createdAt) OVER (
                    PARTITION BY s.username, s.problem_slug
                ) AS first_attempt_at
            FROM submissions s
        )
        SELECT *
        FROM ranked_submissions s
        ${whereClause}
        ORDER BY s.username, s.problem_slug, s.createdAt, s.id
        `,
        {
            replacements,
            type: QueryTypes.SELECT
        }
    );

    const outputDir = path.resolve(
        __dirname,
        '../../../../research_exports'
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    const outputPath = path.join(
        outputDir,
        `research_export_v1_${timestamp}.jsonl`
    );

    const stream = fs.createWriteStream(outputPath, {
        encoding: 'utf8'
    });

    for (const submission of submissions) {
        const sourceRows = await sequelize.query(
            `
            SELECT
                path,
                language,
                encoding,
                content_base64,
                sha256,
                size_bytes,
                line_count
            FROM submission_sources
            WHERE submission_id = :submission_id
            ORDER BY path
            `,
            {
                replacements: {
                    submission_id: submission.id
                },
                type: QueryTypes.SELECT
            }
        );

        const compileResult = await sequelize.query(
            `
            SELECT
                status,
                exit_code,
                duration_ms,
                compiler,
                compiler_version,
                command,
                stdout,
                stderr
            FROM submission_compile_results
            WHERE submission_id = :submission_id
            LIMIT 1
            `,
            {
                replacements: {
                    submission_id: submission.id
                },
                type: QueryTypes.SELECT
            }
        );

        const testRows = await sequelize.query(
            `
            SELECT
                testcase_id,
                testcase_version,
                test_order,
                input,
                expected_output,
                actual_output,
                status,
                exit_code,
                signal_number,
                stderr,
                duration_ms,
                timeout_ms
            FROM submission_test_results
            WHERE submission_id = :submission_id
            ORDER BY test_order, id
            `,
            {
                replacements: {
                    submission_id: submission.id
                },
                type: QueryTypes.SELECT
            }
        );

        const provenanceRows = await sequelize.query(
            `
            SELECT
                schema_version,
                github_run_id,
                github_run_attempt,
                commit_sha,
                workflow_name,
                execution_environment,
                architecture,
                runner_version,
                problem_version,
                testset_version
            FROM submission_provenance
            WHERE submission_id = :submission_id
            LIMIT 1
            `,
            {
                replacements: {
                    submission_id: submission.id
                },
                type: QueryTypes.SELECT
            }
        );

        const compile = compileResult[0] || null;
        const provenance = provenanceRows[0] || null;

        const firstAttemptAt = new Date(submission.first_attempt_at);
        const currentAttemptAt = new Date(submission.createdAt);

        const timestampOffsetSeconds = Math.max(
            0,
            Math.round(
                (currentAttemptAt.getTime() -
                    firstAttemptAt.getTime()) / 1000
            )
        );

        const sources = sourceRows.map(source => ({
            path: source.path,
            language: source.language,
            encoding: source.encoding,
            sha256: source.sha256,
            size_bytes: source.size_bytes,
            line_count: source.line_count,
            content: decodeBase64(source.content_base64)
        }));

        const passed = testRows.filter(
            row => row.status === 'PASSED'
        ).length;

        const failed = testRows.filter(
            row => row.status === 'FAILED'
        ).length;

        const error = testRows.filter(
            row => row.status === 'ERROR'
        ).length;

        const timeout = testRows.filter(
            row => row.status === 'TIMEOUT'
        ).length;

        let telemetryLevel = 'legacy';

        const hasSource = sources.length > 0;
        const hasCompile = compile !== null;
        const hasProvenance = provenance !== null;

        if (hasSource && hasCompile && hasProvenance) {
            telemetryLevel = 'core';

            const hasProblemVersion =
                provenance.problem_version !== null &&
                provenance.problem_version !== '';

            const hasTestVersioning =
                testRows.length === 0 ||
                (
                    provenance.testset_version !== null &&
                    provenance.testset_version !== '' &&
                    testRows.every(
                        test =>
                            test.testcase_version !== null &&
                            test.testcase_version !== ''
                    )
                );

            if (hasProblemVersion && hasTestVersioning) {
                telemetryLevel = 'versioned';
            }
        }

        const record = {
            schema_version: '1.0',
            telemetry_level: telemetryLevel,
            meta: {
                student_id: submission.username,
                assignment_id: submission.assignment_id,
                problem_slug: submission.problem_slug,
                submission_id: submission.id,
                attempt_seq: Number(submission.attempt_seq),
                timestamp: submission.createdAt,
                timestamp_offset_seconds: timestampOffsetSeconds
            },

            sources,

            compile: compile
                ? {
                    status: compile.status,
                    exit_code: compile.exit_code,
                    duration_ms: compile.duration_ms,
                    compiler: compile.compiler,
                    compiler_version: compile.compiler_version,
                    command: compile.command,
                    stdout: compile.stdout,
                    stderr: compile.stderr
                }
                : null,

            tests: {
                executed: testRows.length > 0,
                total: testRows.length,
                passed,
                failed,
                error,
                timeout,
                cases: testRows.map(test => ({
                    testcase_id: test.testcase_id,
                    testcase_version: test.testcase_version,
                    test_order: test.test_order,
                    status: test.status,
                    input: test.input,
                    expected_output: test.expected_output,
                    actual_output: test.actual_output,
                    exit_code: test.exit_code,
                    signal_number: test.signal_number,
                    stderr: test.stderr,
                    duration_ms: test.duration_ms,
                    timeout_ms: test.timeout_ms
                }))
            },

            result: {
                status: submission.status,
                pass_count: submission.pass_count,
                total_count: submission.total_count,
                duration_seconds: submission.duration
            },

            score: {
                max_points: submission.max_points,
                earned_points:
                    submission.max_points !== null &&
                    submission.pass_count !== null &&
                    submission.total_count > 0
                        ? Number(
                            (
                                submission.max_points *
                                submission.pass_count /
                                submission.total_count
                            ).toFixed(2)
                        )
                        : null,
                score_ratio:
                    submission.pass_count !== null &&
                    submission.total_count > 0
                        ? Number(
                            (
                                submission.pass_count /
                                submission.total_count
                            ).toFixed(4)
                        )
                        : null,
                derived_from: "pass_count/total_count"
            },

            provenance
        };

        stream.write(JSON.stringify(record) + '\n');
    }

    stream.end();

    await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
    });

    console.log(`Exported ${submissions.length} attempts`);
    console.log(`Output: ${outputPath}`);
}

main()
    .catch(error => {
        console.error('Research export failed:');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
