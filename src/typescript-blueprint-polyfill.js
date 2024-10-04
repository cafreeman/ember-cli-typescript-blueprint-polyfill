const chalk = require('chalk');
const path = require('path');
const {
  replaceExtension,
  replaceTypeScriptExtension,
  isTypeScriptFile,
} = require('./utils');

module.exports = function (context) {
  const blueprintClass = context._super.constructor.prototype;
  const originalProcessFiles = context.processFiles;
  const originalInstall = context.install;
  const originalUninstall = context.uninstall;

  if (Object.keys(blueprintClass).includes('shouldConvertToJS')) {
    return;
  }

  context.install = function () {
    this.blueprintFunction = 'install';
    return originalInstall.apply(this, arguments);
  };

  context.uninstall = function () {
    this.blueprintFunction = 'uninstall';
    return originalUninstall.apply(this, arguments);
  };

  context.shouldConvertToJS = function (options, fileInfo) {
    // If this isn't turned on, it doesn't matter what else was passed, we're not touching it.
    if (!this.shouldTransformTypeScript) {
      return false;
    }

    // If the blueprint isn't a TS file to begin with, there's nothing to convert.
    if (!isTypeScriptFile(fileInfo.outputPath)) {
      // If the user wants TypeScript output but there is no TypeScript blueprint available, we want
      // to warn them that they're not going to get what they're expecting while still at least giving
      // them the JS output. We check for this *after* checking `shouldTranformTypeScript` because
      // it's possible for people to set `{typescript: true}` in their `.ember-cli` file, which would
      // then erroneously trigger this message every time they generate a JS blueprint even though
      // they didn't pass the flag.
      if (options.typescript === true) {
        this.ui.writeLine(
          chalk.yellow(
            "You passed the '--typescript' flag but there is no TypeScript blueprint available. " +
              'A JavaScript blueprint will be generated instead.'
          )
        );
      }

      return false;
    }

    // Indicates when the user explicitly passed either `--typescript` or `--no-typescript` as opposed
    // to not passing a flag at all and allowing for default behavior
    const userExplicitlySelectedTypeScriptStatus =
      options.typescript !== undefined;

    // Indicates when the user has asked for TypeScript either globally (by setting
    // `isTypeScriptProject` to true) or locally (by passing the `--typescript` flag when they
    // invoked the generator). Although ember-cli merges `.ember-cli` and all of the flag values into
    // one object, we thought the DX would be improved by differentiating between what is intended
    // to be global vs. local config.
    const shouldUseTypeScript = userExplicitlySelectedTypeScriptStatus
      ? options.typescript
      : options.isTypeScriptProject;

    // if the user wants TS output and we have a TS file available, we do *not* want to downlevel to JS
    if (shouldUseTypeScript) {
      return false;
    }

    return true;
  };

  context.convertToJS = async function (fileInfo) {
    let rendered = await fileInfo.render();

    fileInfo.rendered = await removeTypes(
      path.extname(fileInfo.displayPath),
      rendered
    );
    fileInfo.displayPath = replaceTypeScriptExtension(fileInfo.displayPath);
    fileInfo.outputPath = replaceTypeScriptExtension(fileInfo.outputPath);

    return fileInfo;
  };

  context.processFiles = function () {
    const upstreamResult = originalProcessFiles.apply(this, arguments);

    return upstreamResult.then((fileInfos) => {
      return Promise.all(
        fileInfos.map((info) => {
          if (this.shouldConvertToJS(this.options, info)) {
            return this.convertToJS(info);
          }

          return info;
        })
      );
    });
  };

  context._getFileInfos = function (files, intoDir, templateVariables) {
    const fileInfos = files.map(
      this.buildFileInfo.bind(this, intoDir, templateVariables)
    );

    if (this.blueprintFunction === 'install') {
      return fileInfos;
    }

    return fileInfos.reduce((acc, info) => {
      // if it's possible that this blueprint could have produced either typescript OR javascript, we have to do some
      // work to figure out which files to delete.
      if (this.shouldTransformTypeScript) {
        if (this.options.typescript === true) {
          // if the user explicitly passed `--typescript`, we only want to delete TS files, so we stick with the existing
          // info object since it will contain a .ts outputPath (since we know this blueprint is authored in TS because
          // of our check above)
          acc.push(info);
          return acc;
        }

        const jsInfo = Object.create(info);
        Object.assign(jsInfo, {
          outputPath: replaceExtension(info.outputPath, '.js'),
          displayPath: replaceExtension(info.displayPath, '.js'),
        });

        if (this.options.typescript === false) {
          // if the user explicitly passed `--no-typescript`, we only want to delete JS file, so we return our newly
          // created jsInfo object since it contains the javascript version of the output path.
          acc.push(jsInfo);
          return acc;
        }

        if (this.options.typescript === undefined) {
          // if the user didn't specify one way or the other, then both the JS and TS paths are possibilities, so we add
          // both of them to the list. `finishProcessingForUninstall` will actually look to see which of them exists and
          // delete whatever it finds.
          acc.push(info, jsInfo);
          return acc;
        }
      }

      acc.push(info);
      return acc;
    }, []);
  };
};

/**
    Removes types from .ts and .gts files.
    Based on the code in ember-cli: https://github.com/ember-cli/ember-cli/blob/2dc099a90dc0a4e583e43e4020d691b342f1e891/lib/models/blueprint.js#L531

    @private
    @method removeTypes
    @param {string} extension
    @param {string} code
    @return {Promise}
  */
async function removeTypes(extension, code) {
  const { removeTypes: removeTypesFn } = require('remove-types');

  if (extension === '.gts') {
    const { Preprocessor } = require('content-tag');
    const preprocessor = new Preprocessor();
    // Strip template tags
    const templateTagIdentifier = (index) =>
      `template = __TEMPLATE_TAG_${index}__;`;
    const templateTagIdentifierBraces = (index) =>
      `(template = __TEMPLATE_TAG_${index}__);`;
    const templateTagMatches = preprocessor.parse(code);
    let strippedCode = code;
    for (let i = 0; i < templateTagMatches.length; i++) {
      const match = templateTagMatches[i];
      const templateTag = substringBytes(
        code,
        match.range.start,
        match.range.end
      );
      strippedCode = strippedCode.replace(
        templateTag,
        templateTagIdentifier(i)
      );
    }

    // Remove types
    const transformed = await removeTypesFn(strippedCode);

    // Readd stripped template tags
    let transformedWithTemplateTag = transformed;
    for (let i = 0; i < templateTagMatches.length; i++) {
      const match = templateTagMatches[i];
      const templateTag = substringBytes(
        code,
        match.range.start,
        match.range.end
      );
      transformedWithTemplateTag = transformedWithTemplateTag.replace(
        templateTagIdentifier(i),
        templateTag
      );
      transformedWithTemplateTag = transformedWithTemplateTag.replace(
        templateTagIdentifierBraces(i),
        templateTag
      );
    }

    return transformedWithTemplateTag;
  }

  return await removeTypesFn(code);
}

/**
 * Takes a substring of a string based on byte offsets.
 * @private
 * @method substringBytes
 * @param {string} value : The input string.
 * @param {number} start : The byte index of the substring start.
 * @param {number} end : The byte index of the substring end.
 * @return {string} : The substring.
 */
function substringBytes(value, start, end) {
  let buf = Buffer.from(value);
  return buf.subarray(start, end).toString();
}
