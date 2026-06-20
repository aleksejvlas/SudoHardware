const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const databaseDir = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.resolve(projectRoot, '..', 'database');

const getSqlPath = (fileName) => path.join(databaseDir, fileName);

module.exports = {
  projectRoot,
  databaseDir,
  getSqlPath,
  sqlFiles: {
    usersTable: getSqlPath('SQL_USERS_TABLE.sql'),
    productsSeed: getSqlPath('INSERT_PRODUCTS.sql')
  }
};
