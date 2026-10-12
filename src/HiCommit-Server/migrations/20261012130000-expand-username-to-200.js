'use strict';

module.exports = {
  async up(queryInterface) {
    for (const table of ['users', 'submissions']) {
      const columns = await queryInterface.describeTable(table);
      const type = columns.username.type.toUpperCase();
      const match = /^VARCHAR\((\d+)\)$/.exec(type);

      if (!match) {
        throw new Error(`Unexpected ${table}.username type: ${type}`);
      }

      if (Number(match[1]) < 200) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`username\` VARCHAR(200) NOT NULL`
        );
      }
    }
  },

  async down() {
    throw new Error(
      'Automatic rollback is disabled to prevent truncating existing usernames.'
    );
  }
};
