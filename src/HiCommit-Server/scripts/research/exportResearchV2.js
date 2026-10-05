require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const sequelize = require('../../configs/database');

function getArg(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

function hasArg(args, name) {
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

async function main(args = process.argv.slice(2), options = {}) {
    const idsArg = getArg(args, '--ids');
    const problemArg = getArg(args, '--problem');
    const problemsArg = getArg(args, '--problems');
    const roleArg = getArg(args, '--role');
    const courseArg = getArg(args, '--course');
    const contestArg = getArg(args, '--contest');
    const contextArg = getArg(args, '--context');
    const fromArg = getArg(args, '--from');
    const toArg = getArg(args, '--to');
    const exportAll = hasArg(args, '--all');

    const hasAnyFilter =
        idsArg ||
        problemArg ||
        problemsArg ||
        roleArg ||
        courseArg ||
        contestArg ||
        contextArg ||
        fromArg ||
        toArg;

    if (!hasAnyFilter && !exportAll) {
        throw new Error(
            [
                'Usage: node exportResearchV2.js [filters]',
                '',
                'Selectors:',
                '  --ids ID1,ID2',
                '  --problem SLUG',
                '  --problems SLUG1,SLUG2',
                '  --role STUDENT|TEACHER|ADMIN',
                '  --course COURSE_ID',
                '  --contest CONTEST_ID',
                '  --context FREE|COURSE|CONTEST',
                '  --from YYYY-MM-DD|ISO_TIMESTAMP',
                '  --to YYYY-MM-DD|ISO_TIMESTAMP',
                '  --all',
                '',
                'Multiple filters are combined with AND.'
            ].join('\n')
        );
    }

    if (problemArg && problemsArg) {
        throw new Error(
            'Use either --problem or --problems, not both.'
        );
    }

    const validRoles = new Set([
        'STUDENT',
        'TEACHER',
        'ADMIN'
    ]);

    const role = roleArg
        ? roleArg.trim().toUpperCase()
        : null;

    if (role && !validRoles.has(role)) {
        throw new Error(
            `Invalid --role value: ${roleArg}`
        );
    }

    const validContexts = new Set([
        'FREE',
        'COURSE',
        'CONTEST'
    ]);

    const context = contextArg
        ? contextArg.trim().toUpperCase()
        : null;

    if (context && !validContexts.has(context)) {
        throw new Error(
            `Invalid --context value: ${contextArg}`
        );
    }

    if (courseArg && context && context !== 'COURSE') {
        throw new Error(
            '--course can only be combined with --context COURSE.'
        );
    }

    if (contestArg && context && context !== 'CONTEST') {
        throw new Error(
            '--contest can only be combined with --context CONTEST.'
        );
    }

    if (courseArg && contestArg) {
        throw new Error(
            'A submission cannot be filtered by both --course and --contest.'
        );
    }

    function parseDateArg(value, name, endOfDay = false) {
        if (!value) return null;

        const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

        const date = dateOnly
            ? new Date(
                `${value}T${endOfDay
                    ? '23:59:59.999'
                    : '00:00:00.000'}Z`
            )
            : new Date(value);

        if (Number.isNaN(date.getTime())) {
            throw new Error(
                `Invalid ${name} value: ${value}`
            );
        }

        return date;
    }

    const fromDate = parseDateArg(
        fromArg,
        '--from'
    );

    const toDate = parseDateArg(
        toArg,
        '--to',
        true
    );

    if (
        fromDate &&
        toDate &&
        fromDate.getTime() > toDate.getTime()
    ) {
        throw new Error(
            '--from must be earlier than or equal to --to.'
        );
    }

    await sequelize.authenticate();

    const replacements = {};
    const conditions = [];

    if (idsArg) {
        const ids = idsArg
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);

        if (ids.length === 0) {
            throw new Error(
                'No valid submission IDs supplied.'
            );
        }

        conditions.push('s.id IN (:ids)');
        replacements.ids = ids;
    }

    const problemValues = problemArg
        ? [problemArg.trim()]
        : problemsArg
            ? problemsArg
                .split(',')
                .map(v => v.trim())
                .filter(Boolean)
            : [];

    if (
        (problemArg || problemsArg) &&
        problemValues.length === 0
    ) {
        throw new Error(
            'No valid problem slugs supplied.'
        );
    }

    if (problemValues.length === 1) {
        conditions.push(
            's.problem_slug = :problem_slug'
        );
        replacements.problem_slug =
            problemValues[0];
    } else if (problemValues.length > 1) {
        conditions.push(
            's.problem_slug IN (:problem_slugs)'
        );
        replacements.problem_slugs =
            problemValues;
    }

    if (role) {
        conditions.push(
            's.actor_role = :actor_role'
        );
        replacements.actor_role = role;
    }

    if (context) {
        conditions.push(
            's.problem_type = :problem_type'
        );
        replacements.problem_type = context;
    }

    if (courseArg) {
        conditions.push(
            "s.problem_type = 'COURSE'"
        );
        conditions.push(
            's.problem_parent = :course_id'
        );
        replacements.course_id =
            courseArg.trim();
    }

    if (contestArg) {
        conditions.push(
            "s.problem_type = 'CONTEST'"
        );
        conditions.push(
            's.problem_parent = :contest_id'
        );
        replacements.contest_id =
            contestArg.trim();
    }

    if (fromDate) {
        conditions.push(
            's.createdAt >= :from_date'
        );
        replacements.from_date = fromDate;
    }

    if (toDate) {
        conditions.push(
            's.createdAt <= :to_date'
        );
        replacements.to_date = toDate;
    }

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

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
                u.role AS actor_role,
                p.type AS problem_type,
                p.parent AS problem_parent,
                s.status,
                s.pass_count,
                s.total_count,
                p.score AS max_points,
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
            LEFT JOIN users u
                ON BINARY u.username = BINARY s.username
            LEFT JOIN problems p
                ON BINARY p.slug = BINARY s.problem_slug
        )
        SELECT *
        FROM ranked_submissions s
        ${whereClause}
        ORDER BY
            s.username,
            s.problem_slug,
            s.createdAt,
            s.id
        `,
        {
            replacements,
            type: QueryTypes.SELECT
        }
    );

    if (options.previewOnly) {
        return {
            exporter_version: '2.0',
            record_schema_version: '1.0',
            attempts_exported: submissions.length,
            filters: {
                combine_with: 'AND',
                all: exportAll,
                ids: idsArg
                    ? idsArg
                        .split(',')
                        .map(v => v.trim())
                        .filter(Boolean)
                    : null,
                problems:
                    problemValues.length > 0
                        ? problemValues
                        : null,
                role,
                course_id:
                    courseArg
                        ? courseArg.trim()
                        : null,
                contest_id:
                    contestArg
                        ? contestArg.trim()
                        : null,
                context,
                from_utc:
                    fromDate
                        ? fromDate.toISOString()
                        : null,
                to_utc:
                    toDate
                        ? toDate.toISOString()
                        : null
            }
        };
    }

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
        `research_export_v2_${timestamp}.jsonl`
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

    const metaPath = path.join(
        outputDir,
        `research_export_v2_${timestamp}.meta.json`
    );

    const exportMeta = {
        exporter_version: '2.0',
        record_schema_version: '1.0',
        generated_at_utc: new Date().toISOString(),
        attempts_exported: submissions.length,
        output_file: path.basename(outputPath),
        filters: {
            combine_with: 'AND',
            all: exportAll,
            ids: idsArg
                ? idsArg
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean)
                : null,
            problems:
                problemValues.length > 0
                    ? problemValues
                    : null,
            role,
            course_id:
                courseArg
                    ? courseArg.trim()
                    : null,
            contest_id:
                contestArg
                    ? contestArg.trim()
                    : null,
            context,
            from_utc:
                fromDate
                    ? fromDate.toISOString()
                    : null,
            to_utc:
                toDate
                    ? toDate.toISOString()
                    : null
        },
        semantics: {
            role:
                'Current users.role at export time; role is not snapshotted on the submission.',
            context:
                'Derived from current problems.type and problems.parent metadata.',
            contest:
                'Contest filtering uses problems.type=CONTEST and problems.parent=contest_id; it does not infer context from contests.problems.',
            attempt_seq:
                'Computed over the full username + problem_slug submission history before export filters are applied.',
            time:
                'Submission createdAt is filtered in UTC.'
        }
    };

    fs.writeFileSync(
        metaPath,
        JSON.stringify(exportMeta, null, 2) + '\n',
        'utf8'
    );

    console.log(`Exported ${submissions.length} attempts`);
    console.log(`Output: ${outputPath}`);
    console.log(`Metadata: ${metaPath}`);

    return {
        attempts_exported: submissions.length,
        outputPath,
        metaPath,
        metadata: exportMeta
    };
}

async function preview(args) {
    return main(args, { previewOnly: true });
}

module.exports = {
    main,
    preview
};

if (require.main === module) {
    main()
        .catch(error => {
            console.error('Research export failed:');
            console.error(error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await sequelize.close();
        });
}
