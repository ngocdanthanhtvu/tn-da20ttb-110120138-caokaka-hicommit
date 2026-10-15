'use strict';
const crypto = require('crypto');
const sequelize = require('../configs/database');
const Submission = require('../models/submission');
const Problem = require('../models/problem');
const Source = require('../models/submissionSource');
const Provenance = require('../models/submissionProvenance');
const Compile = require('../models/submissionCompileResult');
const ErrorDetail = require('../models/submissionErrorDetail');
const Test = require('../models/submissionTestResult');
const Callback = require('../models/submissionCallback');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(
        Object.keys(value).sort().map(key => [key, canonical(value[key])])
    );
    return value;
}
function validate(body, slug) {
    const b = { ...body, run_id: String(body.run_id ?? ''), run_attempt: Number(body.run_attempt),
        status: String(body.status || '').toUpperCase() };
    if (b.problem !== slug || typeof b.problem !== 'string' || !b.problem.length || b.problem.length > 255 ||
        typeof b.actor !== 'string' || !b.actor.length || b.actor.length > 200 ||
        !/^\d{1,16}$/.test(b.run_id) || !Number.isSafeInteger(b.run_attempt) || b.run_attempt < 1 || b.run_attempt > 2147483647 ||
        !/^[a-f0-9]{40}$/i.test(b.sha || '') || !['PENDING', 'PASSED', 'FAILED', 'ERROR', 'COMPILE_ERROR'].includes(b.status)) {
        fail('Invalid submission identity or status');
    }
    if (typeof b.code !== 'string' || Buffer.byteLength(b.code) > 1400000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.code)) fail('Invalid or oversized Base64 source');
    if (Buffer.byteLength(JSON.stringify(b)) > 8000000) fail('Callback is too large', 413);
    for (const [field, max] of Object.entries({ workflow_name:255, execution_environment:64, architecture:32,
        runner_version:32, schema_version:16, compiler:64, compiler_version:255, error_type:64, error_stage:64 })) {
        if (b[field] != null && (typeof b[field] !== 'string' || Array.from(b[field]).length > max)) fail(`Invalid ${field}`);
    }
    for (const field of ['testset_version', 'problem_version']) {
        if (b[field] != null && !/^[a-f0-9]{64}$/i.test(b[field])) fail(`Invalid ${field}`);
    }
    for (const field of ['duration', 'pass_count', 'total_count', 'compile_duration_ms']) {
        if (b[field] != null && (!Number.isInteger(b[field]) || b[field] < 0 || b[field] > 2147483647)) fail(`Invalid ${field}`);
    }
    if (b.compile_exit_code != null && (!Number.isInteger(b.compile_exit_code) || Math.abs(b.compile_exit_code) > 2147483647)) fail('Invalid compile exit code');
    if (b.commit_message != null && typeof b.commit_message !== 'string') fail('Invalid commit message');
    if (b.result != null && !Array.isArray(b.result)) fail('Invalid testcase results');
    if (Array.isArray(b.result)) {
        const ids = new Set();
        for (const test of b.result) {
            if (!test || typeof test.id !== 'string' || !test.id.length || test.id.length > 64 || ids.has(test.id) ||
                !['PASSED','FAILED','ERROR','TIMEOUT'].includes(String(test.status).toUpperCase())) fail('Invalid or duplicate testcase');
            for (const field of ['input','expected_output','actual_output','stderr']) {
                if (test[field] != null && typeof test[field] !== 'string') fail(`Invalid testcase ${field}`);
            }
            if (test.testcase_version != null && test.testcase_version !== '' && !/^[a-f0-9]{64}$/i.test(test.testcase_version)) fail('Invalid testcase version');
            for (const field of ['exit_code','signal','duration_ms','timeout_ms']) {
                if (test[field] != null && (!Number.isInteger(test[field]) || Math.abs(test[field]) > 2147483647)) fail(`Invalid testcase ${field}`);
            }
            ids.add(test.id);
        }
    }
    if (['PASSED', 'FAILED'].includes(b.status)) {
        if (!b.result?.length || b.total_count !== b.result.length ||
            b.pass_count !== b.result.filter(t => String(t.status).toUpperCase() === 'PASSED').length) fail('Inconsistent test counts');
        if (b.status === 'PASSED' && b.pass_count !== b.total_count) fail('Inconsistent passed status');
        if (b.status === 'FAILED' && b.pass_count === b.total_count) fail('Inconsistent failed status');
    }
    return b;
}
async function storeCallback(body, slug) {
    const b = validate(body, slug);
    // Only the pinned OIDC-verified runner may supply metadata. No GitHub REST call here.
    if (b.commit_message?.startsWith('[config]') || b.commit_message?.startsWith('Initialize')) {
        return { ignored: true };
    }
    const digest = hash(JSON.stringify(canonical(b)));
    const phase = b.status === 'PENDING' ? 'pending' : 'final';
    for (let retry = 0; ; retry++) {
        try {
            return await sequelize.transaction(async transaction => {
                const options = { transaction };
                let submission = await Submission.findByPk(b.run_id, { ...options, lock: transaction.LOCK.UPDATE });
                const created = !submission;
                if (!submission) submission = await Submission.create({
                    id:b.run_id, run_id:b.run_id, problem_slug:b.problem, username:b.actor, sha:b.sha,
                    code:b.code, status:'PENDING', commit:b.commit_message ? Array.from(b.commit_message).slice(0,255).join('') : null
                }, options);
                if (submission.username !== b.actor || submission.sha !== b.sha || submission.problem_slug !== b.problem || submission.code !== b.code) {
                    fail('Run identity does not match stored submission', 409);
                }
                const provenance = await Provenance.findByPk(b.run_id, options);
                const attempt = provenance?.github_run_attempt ?? 1;
                const existing = await Callback.findOne({ ...options, where:{ run_id:b.run_id, run_attempt:b.run_attempt, phase } });
                if (existing) {
                    if (phase === 'final' && existing.digest !== digest) fail('Conflicting final callback for the same run attempt',409);
                    return { duplicate:true, id:b.run_id };
                }
                await Callback.create({ run_id:b.run_id, run_attempt:b.run_attempt, phase, digest, payload:JSON.stringify(b) }, options);
                // Archive delayed callbacks but never replace a newer execution or a terminal result with pending.
                if (b.run_attempt < attempt || (!created && b.run_attempt === attempt && submission.status !== 'PENDING' && phase === 'pending')) {
                    return { stale:true, id:b.run_id };
                }
                // Legacy rows have no journal entry. A same-attempt retry must not replace their terminal result.
                if (!created && b.run_attempt === attempt && submission.status !== 'PENDING' && phase === 'final') {
                    if (submission.status !== b.status) fail('Existing terminal result requires a new run attempt',409);
                    return { duplicate:true, id:b.run_id };
                }
                const problem = await Problem.findOne({ ...options, where:{slug:b.problem}, attributes:['name','language','description','input','output','limit'] });
                if (!problem) fail('Problem not found',404);
                const p = problem.toJSON();
                const problemVersion = b.problem_version || (b.run_attempt === attempt && provenance?.problem_version) ||
                    hash(JSON.stringify([p.name,p.language,p.description,p.input,p.output,p.limit ?? null]));
                const source = Buffer.from(b.code,'base64');
                const text = source.toString('utf8');
                const lines = text ? text.split(/\r\n|\r|\n/) : [];
                if (lines.at(-1) === '') lines.pop();
                await Source.upsert({submission_id:b.run_id,path:'main.c',language:'c',encoding:'utf-8',
                    content_base64:b.code,sha256:hash(source),size_bytes:source.length,line_count:lines.length},options);
                await Provenance.upsert({submission_id:b.run_id,schema_version:b.schema_version ?? '1.0',github_run_id:b.run_id,
                    github_run_attempt:b.run_attempt,commit_sha:b.sha,workflow_name:b.workflow_name ?? null,
                    execution_environment:b.execution_environment ?? null,architecture:b.architecture ?? null,
                    runner_version:b.runner_version ?? null,problem_version:problemVersion,
                    testset_version:b.testset_version ?? (b.run_attempt === attempt ? provenance?.testset_version : null) ?? null},options);
                // Preserve pre-journal data before projecting a newer technical execution.
                if (!created && b.run_attempt > attempt) {
                    const prior = await Callback.findOne({ ...options, where: { run_id:b.run_id, run_attempt:attempt, phase:'final' } });
                    if (!prior) {
                        const snapshot = JSON.stringify({ submission:submission.toJSON(), provenance:provenance?.toJSON(),
                            compile:await Compile.findByPk(b.run_id,options),
                            error:await ErrorDetail.findByPk(b.run_id,options),
                            tests:await Test.findAll({...options,where:{submission_id:b.run_id}}) });
                        await Callback.findOrCreate({ ...options, where:{run_id:b.run_id,run_attempt:attempt,phase:'legacy'},
                            defaults:{digest:hash(snapshot),payload:snapshot} });
                    }
                }
                if (b.run_attempt > attempt || phase === 'final') {
                    await Test.destroy({...options,where:{submission_id:b.run_id}});
                    await Compile.destroy({...options,where:{submission_id:b.run_id}});
                    await ErrorDetail.destroy({...options,where:{submission_id:b.run_id}});
                }
                if (phase === 'final') {
                    if (b.compile_exit_code != null) await Compile.upsert({submission_id:b.run_id,
                        status:Number(b.compile_exit_code) === 0 ? 'SUCCESS':'FAILED',exit_code:b.compile_exit_code,
                        duration_ms:b.compile_duration_ms ?? null,compiler:b.compiler ?? null,compiler_version:b.compiler_version ?? null,
                        command:b.compile_command ?? null,stdout:b.compile_stdout ?? '',stderr:b.compile_stderr ?? ''},options);
                    if (b.error_type) await ErrorDetail.upsert({submission_id:b.run_id,error_type:b.error_type,error_stage:b.error_stage ?? null},options);
                    for (const [index,t] of (b.result ?? []).entries()) await Test.create({
                        submission_id:b.run_id,testcase_id:t.id,testcase_version:t.testcase_version || null,test_order:index+1,
                        input:t.input ?? null,expected_output:t.expected_output ?? null,actual_output:t.actual_output ?? null,
                        status:String(t.status).toUpperCase(),exit_code:t.exit_code ?? null,signal_number:t.signal ?? null,
                        stderr:t.stderr ?? '',duration_ms:t.duration_ms ?? null,timeout_ms:t.timeout_ms ?? null},options);
                }
                const status = b.result?.some(t => ['ERROR','TIMEOUT'].includes(String(t.status).toUpperCase())) ? 'ERROR' : b.status;
                await submission.update({status, result:b.result ?? null,pass_count:b.pass_count ?? null,total_count:b.total_count ?? null,
                    duration:b.duration ?? null,...(b.commit_message != null ? {commit:Array.from(b.commit_message).slice(0,255).join('')}: {})},options);
                return { changed:true, created, id:b.run_id, code:b.code };
            });
        } catch (error) {
            const transient = error.name === 'SequelizeUniqueConstraintError' || ['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code);
            if (!transient || retry >= 2) throw error;
        }
    }
}
module.exports = { storeCallback, validate };
