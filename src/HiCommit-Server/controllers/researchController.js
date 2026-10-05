const fs = require('fs');
const path = require('path');

const Course = require('../models/course');
const {
    main: exportResearch,
    preview
} = require('../scripts/research/exportResearchV2');

function normalizeList(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .map(item => String(item).trim())
            .filter(Boolean);
    }

    return String(value)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function buildExporterArgs(filters = {}) {
    const args = [];

    const ids = normalizeList(filters.ids);
    const problems = normalizeList(filters.problems);

    if (filters.all === true) {
        args.push('--all');
    }

    if (ids.length > 0) {
        args.push('--ids', ids.join(','));
    }

    if (problems.length === 1) {
        args.push('--problem', problems[0]);
    } else if (problems.length > 1) {
        args.push('--problems', problems.join(','));
    }

    if (filters.role) {
        args.push('--role', String(filters.role).trim());
    }

    if (filters.course_id) {
        args.push('--course', String(filters.course_id).trim());
    }

    if (filters.contest_id) {
        args.push('--contest', String(filters.contest_id).trim());
    }

    if (filters.context) {
        args.push('--context', String(filters.context).trim());
    }

    if (filters.from) {
        args.push('--from', String(filters.from).trim());
    }

    if (filters.to) {
        args.push('--to', String(filters.to).trim());
    }

    return args;
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function validateResearchExportAccess(user, filters = {}) {
    if (user.role !== 'TEACHER') {
        return;
    }

    if (filters.all === true) {
        throw createHttpError(
            403,
            'Teacher cannot export all research data'
        );
    }

    if (filters.contest_id) {
        throw createHttpError(
            403,
            'Teacher research export is limited to owned courses'
        );
    }

    if (
        filters.context &&
        String(filters.context).trim().toUpperCase() !== 'COURSE'
    ) {
        throw createHttpError(
            403,
            'Teacher research export is limited to COURSE context'
        );
    }

    if (!filters.course_id) {
        throw createHttpError(
            400,
            'course_id is required for teacher research export'
        );
    }

    const course = await Course.findByPk(
        String(filters.course_id).trim()
    );

    if (!course) {
        throw createHttpError(404, 'Course not found');
    }

    if (course.created_by !== user.id) {
        throw createHttpError(403, 'Forbidden');
    }
}

function cleanupExportFiles(result) {
    const paths = [
        result?.outputPath,
        result?.metaPath
    ].filter(Boolean);

    for (const filePath of paths) {
        fs.unlink(filePath, error => {
            if (error && error.code !== 'ENOENT') {
                console.error(
                    'Error cleaning research export file:',
                    error
                );
            }
        });
    }
}

exports.previewResearchExport = async (req, res) => {
    try {
        const filters = req.body || {};

        await validateResearchExportAccess(
            req.user,
            filters
        );

        const args = buildExporterArgs(filters);
        const result = await preview(args);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(error.status || 400).json({
            error: error.message
        });
    }
};

exports.downloadResearchExport = async (req, res) => {
    let exportResult = null;

    try {
        const filters = req.body || {};

        await validateResearchExportAccess(
            req.user,
            filters
        );

        const args = buildExporterArgs(filters);
        exportResult = await exportResearch(args);

        const metadataBase64 = Buffer
            .from(
                JSON.stringify(exportResult.metadata),
                'utf8'
            )
            .toString('base64');

        res.setHeader(
            'X-Research-Export-Metadata',
            metadataBase64
        );

        res.setHeader(
            'X-Research-Export-Metadata-Filename',
            path.basename(exportResult.metaPath)
        );

        res.setHeader(
            'X-Research-Export-Attempts',
            String(exportResult.attempts_exported)
        );

        return res.download(
            exportResult.outputPath,
            path.basename(exportResult.outputPath),
            error => {
                cleanupExportFiles(exportResult);

                if (error) {
                    console.error(
                        'Research export download failed:',
                        error
                    );
                }
            }
        );
    } catch (error) {
        if (exportResult) {
            cleanupExportFiles(exportResult);
        }

        return res.status(error.status || 400).json({
            error: error.message
        });
    }
};

exports.buildExporterArgs = buildExporterArgs;
