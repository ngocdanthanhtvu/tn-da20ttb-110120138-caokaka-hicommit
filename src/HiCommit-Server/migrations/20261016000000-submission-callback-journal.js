'use strict';
module.exports = {
  async up(q, S) {
    await q.createTable('submission_callbacks', {
      id: { type: S.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
      run_id: { type: S.STRING(16), allowNull: false },
      run_attempt: { type: S.INTEGER, allowNull: false },
      phase: { type: S.STRING(8), allowNull: false },
      digest: { type: S.CHAR(64), allowNull: false },
      payload: { type: S.TEXT('long'), allowNull: false },
      createdAt: { type: S.DATE, allowNull: false },
      updatedAt: { type: S.DATE, allowNull: false }
    }, { charset: 'utf8mb4', collate: 'utf8mb4_bin' });
    await q.addIndex('submission_callbacks', ['run_id', 'run_attempt', 'phase'], {
      unique: true, name: 'submission_callbacks_run_attempt_phase'
    });
  },
  async down() {
    throw new Error('Callback history must be backed up and retained; automatic rollback is disabled.');
  }
};
