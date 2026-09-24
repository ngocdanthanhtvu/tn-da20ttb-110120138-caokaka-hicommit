'use strict';

const REQUIRED_TABLES = [
  'comments',
  'contests',
  'courses',
  'discussions',
  'examples',
  'posts',
  'problems',
  'submission_compile_results',
  'submission_error_details',
  'submission_provenance',
  'submission_sources',
  'submission_test_results',
  'submissions',
  'testcases',
  'units',
  'usercontests',
  'usercourses',
  'users'
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const existingTables = await queryInterface.showAllTables();
    const normalizedTables = existingTables.map((table) =>
      typeof table === 'string' ? table : table.tableName
    );

    const missingTables = REQUIRED_TABLES.filter(
      (table) => !normalizedTables.includes(table)
    );

    if (missingTables.length > 0) {
      throw new Error(
        `HiCommit baseline schema is incomplete. Missing tables: ${missingTables.join(', ')}. ` +
        'Initialize a new database with database/baseline-schema.sql before running migrations.'
      );
    }
  },

  async down() {
    throw new Error(
      'The HiCommit baseline migration is irreversible and must not drop the baseline schema.'
    );
  }
};
