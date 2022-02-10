/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assertFilesExist", "assertFilesNotExist"] }] */
const { Project } = require('fixturify-project');
const path = require('path');
const execa = require('execa');
const fs = require('fs-extra');

const ROOT = process.cwd();
const EmberCLITargets = ['ember-cli-3-24', 'ember-cli-3-28', 'ember-cli'];
// const EmberCLITargets = ['ember-cli'];

describe('ember destroy', () => {
  let fixturifyProject;

  EmberCLITargets.forEach((target) => {
    describe(`ember-cli: ${target}`, function () {
      async function ember(args) {
        const cliBinPath = require.resolve(`${target}/bin/ember`);

        return execa(cliBinPath, args);
      }

      beforeEach(() => {
        fixturifyProject = new Project('best-ever', '0.0.0', {
          files: {},
        });
        fixturifyProject.linkDevDependency('ember-cli', {
          baseDir: __dirname,
          resolveName: target,
        });
        addAddon('my-addon', '1.0.0', (addon) => {
          addon.files.blueprints = {
            'my-blueprint': {
              'index.js': `
                  const typescriptBlueprintPolyfill = require('ember-cli-typescript-blueprint-polyfill');

                  module.exports = {
                    shouldTransformTypeScript: true,
                    init() {
                      this._super && this._super.init.apply(this, arguments);
                      typescriptBlueprintPolyfill(this);
                    }
                  }
                  `,
              files: {
                app: {
                  'my-blueprints': {
                    '__name__.ts': `export default function <%= camelizedModuleName %>(a: string, b: number): string {
    return a + b;
  }
  `,
                  },
                },
              },
            },
          };
        });
      });

      afterEach(() => {
        process.chdir(ROOT);

        fixturifyProject.dispose();
      });

      function addAddon(name, version, callback = () => {}) {
        let addon = fixturifyProject.addDevDependency(name, version, {
          files: {
            'index.js': `module.exports = { name: require("./package").name };`,
          },
        });

        addon.pkg.keywords.push('ember-addon');
        addon.pkg['ember-addon'] = {};

        addon.linkDependency('ember-cli-typescript-blueprint-polyfill', {
          target: path.join(__dirname, '..'),
        });

        callback(addon);
      }

      function assertFilesExist(files) {
        files.forEach((file) => {
          expect(fs.pathExistsSync(file)).toBe(true);
        });
      }

      async function assertFilesNotExist(files) {
        files.forEach((file) => {
          expect(fs.pathExistsSync(file)).toBe(false);
        });
      }

      describe('with flags', () => {
        beforeEach(() => {
          fixturifyProject.writeSync();
          process.chdir(fixturifyProject.baseDir);
        });
        test('it deletes JS files generated from typescript blueprints and transformed', async () => {
          const files = ['app/my-blueprints/foo.js'];
          await ember(['generate', 'my-blueprint', 'foo']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo']);
          assertFilesNotExist(files);
        });

        it('deletes TS files generated from typescript blueprints with --typescript', async function () {
          const files = ['app/my-blueprints/foo.ts'];
          await ember(['generate', 'my-blueprint', 'foo', '--typescript']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo']);
          assertFilesNotExist(files);
        });

        it('deletes TS files generated from typescript blueprints when --typescript is passed', async function () {
          const files = ['app/my-blueprints/foo.ts'];
          await ember(['generate', 'my-blueprint', 'foo', '--typescript']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo', '--typescript']);
          assertFilesNotExist(files);
        });

        it('does not delete anything if --typescript is passed and there are no TS files', async function () {
          const files = ['app/my-blueprints/foo.js'];

          await ember(['generate', 'my-blueprint', 'foo']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo', '--typescript']);
          assertFilesExist(files);
        });

        it('does not delete anything if --no-typescript is passed and there are no JS files', async function () {
          const files = ['app/my-blueprints/foo.ts'];

          await ember(['generate', 'my-blueprint', 'foo', '--typescript']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo', '--no-typescript']);
          assertFilesExist(files);
        });

        describe('when JS and TS files are present', function () {
          it('deletes the TS file when --typescript is passed', async function () {
            const files = [
              'app/my-blueprints/foo.ts',
              'app/my-blueprints/foo.js',
            ];

            const [tsFile, jsFile] = files;

            await ember(['generate', 'my-blueprint', 'foo']);
            await ember(['generate', 'my-blueprint', 'foo', '--typescript']);
            assertFilesExist(files);

            await ember(['destroy', 'my-blueprint', 'foo', '--typescript']);

            assertFilesNotExist([tsFile]);
            assertFilesExist([jsFile]);
          });

          it('deletes the JS file when --no-typescript flag is passed', async function () {
            const files = [
              'app/my-blueprints/foo.ts',
              'app/my-blueprints/foo.js',
            ];

            const [tsFile, jsFile] = files;

            await ember(['generate', 'my-blueprint', 'foo']);
            await ember(['generate', 'my-blueprint', 'foo', '--typescript']);
            assertFilesExist(files);

            await ember(['destroy', 'my-blueprint', 'foo', '--no-typescript']);

            assertFilesExist([tsFile]);
            assertFilesNotExist([jsFile]);
          });

          it('deletes both files when no flags are passed', async function () {
            const files = [
              'app/my-blueprints/foo.ts',
              'app/my-blueprints/foo.js',
            ];

            await ember(['generate', 'my-blueprint', 'foo']);
            await ember(['generate', 'my-blueprint', 'foo', '--typescript']);
            assertFilesExist(files);

            await ember(['destroy', 'my-blueprint', 'foo']);

            assertFilesNotExist(files);
          });
        });
      });

      describe('with project config', () => {
        it('deletes TS files generated from typescript blueprints in a typescript project', async function () {
          const files = ['app/my-blueprints/foo.ts'];

          fixturifyProject.files['.ember-cli'] = JSON.stringify({
            isTypeScriptProject: true,
          });
          fixturifyProject.writeSync();
          process.chdir(fixturifyProject.baseDir);

          await ember(['generate', 'my-blueprint', 'foo']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo']);
          assertFilesNotExist(files);
        });

        it('deletes TS files generated from typescript blueprints when {typescript: true} is present in .ember-cli', async function () {
          const files = ['app/my-blueprints/foo.ts'];

          fixturifyProject.files['.ember-cli'] = JSON.stringify({
            typescript: true,
          });
          fixturifyProject.writeSync();
          process.chdir(fixturifyProject.baseDir);

          await ember(['generate', 'my-blueprint', 'foo']);
          assertFilesExist(files);

          await ember(['destroy', 'my-blueprint', 'foo']);
          assertFilesNotExist(files);
        });
      });
    });
  });
});
