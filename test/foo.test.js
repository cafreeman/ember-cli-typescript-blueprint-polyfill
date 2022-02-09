const { Project } = require('fixturify-project');
const path = require('path');
const execa = require('execa');
const file = require('./helpers/file');

const TS_FIXTURE = `export default function foo(a: string, b: number): string {
  return a + b;
}
`;

const JS_FIXTURE = `export default function foo(a, b) {
  return a + b;
}
`;

const ROOT = process.cwd();
//const EmberCLITargets = ['ember-cli-3-24', 'ember-cli-3-28', 'ember-cli'];
const EmberCLITargets = ['ember-cli'];

describe('ember generate', () => {
  let fixturifyProject;

  EmberCLITargets.forEach((target) => {

    describe(`ember-cli: ${target}`, function() {
      async function ember(args) {
        fixturifyProject.writeSync();
        process.chdir(fixturifyProject.baseDir);

        const cliBinPath = require.resolve(`${target}/bin/ember`);

        return execa(cliBinPath, args);
      }

      beforeEach(() => {
        fixturifyProject = new Project('best-ever', '0.0.0', {
          files: {},
        });
        fixturifyProject.linkDevDependency('ember-cli', { baseDir: __dirname, resolveName: target });
      });

      afterEach(async () => {
        process.chdir(ROOT);

        await fixturifyProject.dispose();
      });

      function addAddon(name, version, callback = () => {}) {
        let addon = fixturifyProject.addDevDependency(name, version, {
          files: {
            'index.js': `module.exports = { name: require("./package").name };`
          },
        });

        addon.pkg.keywords.push('ember-addon');
        addon.pkg['ember-addon'] = {};

        addon.linkDependency('ember-cli-typescript-blueprint-polyfill', { target: path.join(__dirname, '..') });

        callback(addon)
      }

      describe('with typescript blueprint', () => {
        beforeEach(() => {
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

        test('it generates javascript by default', async () => {
          await ember(['generate', 'my-blueprint', 'foo']);

          const generated = await file('app/my-blueprints/foo.js');

          expect(generated).toEqual(JS_FIXTURE);
        });

        test('it generates typescript with --typescript', async () => {
          await ember(['generate', 'my-blueprint', 'foo', '--typescript']);

          const generated = await file('app/my-blueprints/foo.ts');

          expect(generated).toEqual(TS_FIXTURE);
        });

        test('it generates typescript when isTypeScriptProject is true', async () => {
          fixturifyProject.files['.ember-cli'] = JSON.stringify({
            isTypeScriptProject: true,
          });

          await ember(['generate', 'my-blueprint', 'foo']);

          const generated = await file('app/my-blueprints/foo.ts');
          expect(generated).toEqual(TS_FIXTURE);
        });

        test('it generates javascript when isTypeScriptProject is explicitly false', async () => {
          fixturifyProject.files['.ember-cli'] = JSON.stringify({
            isTypeScriptProject: false,
          });

          await ember(['generate', 'my-blueprint', 'foo']);

          const generated = await file('app/my-blueprints/foo.js');
          expect(generated).toEqual(JS_FIXTURE);
        });

        test('it generates typescript if {typescript: true} is present in ember-cli', async () => {
          fixturifyProject.files['.ember-cli'] = JSON.stringify({
            typescript: true,
          });

          await ember(['generate', 'my-blueprint', 'foo']);

          const generated = await file('app/my-blueprints/foo.ts');
          expect(generated).toEqual(TS_FIXTURE);
        });

        test('does not generate typescript when --no-typescript is passed', async () => {
          await ember(['generate', 'my-blueprint', 'foo', '--no-typescript']);

          const generated = await file('app/my-blueprints/foo.js');
          expect(generated).toEqual(JS_FIXTURE);
        });

        test('does not generate typescript when --no-typescript is passed, even in a typescript project', async () => {
          fixturifyProject.files['.ember-cli'] = JSON.stringify({
            isTypeScriptProject: true,
          });

          await ember(['generate', 'my-blueprint', 'foo', '--no-typescript']);

          const generated = await file('app/my-blueprints/foo.js');
          expect(generated).toEqual(JS_FIXTURE);
        });
      });

      describe('with javascript blueprint', () => {
        beforeEach(() => {
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
                      '__name__.js': `export default function <%= camelizedModuleName %>(a, b) {
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

        test('does not generate typescript when the `--typescript` flag is used but no typescript blueprint exists', async () => {
          const result = await ember([
            'generate',
            'my-blueprint',
            'foo',
            '--typescript',
          ]);
          const output = result.outputStream.map((v) => v.toString());

          const generated = await file('app/my-blueprints/foo.js');

          expect(generated).toEqual(JS_FIXTURE);
          expect(output.join('\n')).toEqual(
            expect.stringContaining(
              "You passed the '--typescript' flag but there is no TypeScript blueprint available."
            )
          );
        });
      });
    });
  });
});
