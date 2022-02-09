const fs = require('fs-extra');

module.exports = async function file(path) {
  // eslint-disable-next-line jest/no-standalone-expect
  expect(await fs.pathExists(path)).toBe(true);
  return fs.readFile(path, { encoding: 'utf-8' });
};
