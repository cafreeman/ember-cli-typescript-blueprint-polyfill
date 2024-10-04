const path = require('path');

function replaceExtension(filePath, newExt) {
  const { dir, name } = path.parse(filePath);

  return path.format({
    dir,
    name,
    ext: newExt,
  });
}

function replaceTypeScriptExtension(filePath) {
  const extensionMap = {
    '.ts': '.js',
    '.gts': '.gjs',
  };
  const ext = path.extname(filePath);
  const newExt = extensionMap[ext];

  return replaceExtension(filePath, newExt);
}

function isTypeScriptFile(filePath) {
  const extension = path.extname(filePath);
  return extension === '.ts' || extension === '.gts';
}

module.exports = {
  replaceExtension,
  replaceTypeScriptExtension,
  isTypeScriptFile,
};
