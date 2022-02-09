const FixturifyProject = require('ember-cli/tests/helpers/fixturify-project');
const ember = require('ember-cli/tests/helpers/ember');
const file = require('./helpers/file');

const TS_FIXTURE = `export default function foo(a: string, b: number): string {
  return a + b;
}
`;

const JS_FIXTURE = `export default function foo(a, b) {
  return a + b;
}
`;

describe('ember generate', () => {
  let fixturifyProject;
  let project;

  beforeEach(() => {
    fixturifyProject = new FixturifyProject('best-ever', '0.0.0');
    fixturifyProject.addDevDependency('ember-cli', '*');
  });

  afterEach(() => {
    fixturifyProject.dispose();
  });

  describe('with typescript blueprint', () => {
    beforeEach(() => {
      fixturifyProject.addAddon('my-addon', '1.0.0', (addon) => {
        addon.files['index.js'] = 'module.exports = { name: "foo" };';
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

      fixturifyProject.writeSync();

      project = fixturifyProject.buildProjectModel();
      project.initializeAddons();
      process.chdir(project.root);
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
      fixturifyProject.writeSync();

      await ember(['generate', 'my-blueprint', 'foo']);

      const generated = await file('app/my-blueprints/foo.ts');
      expect(generated).toEqual(TS_FIXTURE);
    });

    test('it generates javascript when isTypeScriptProject is explicitly false', async () => {
      fixturifyProject.files['.ember-cli'] = JSON.stringify({
        isTypeScriptProject: false,
      });
      fixturifyProject.writeSync();

      await ember(['generate', 'my-blueprint', 'foo']);

      const generated = await file('app/my-blueprints/foo.js');
      expect(generated).toEqual(JS_FIXTURE);
    });

    test('it generates typescript if {typescript: true} is present in ember-cli', async () => {
      fixturifyProject.files['.ember-cli'] = JSON.stringify({
        typescript: true,
      });
      fixturifyProject.writeSync();

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
      fixturifyProject.writeSync();

      await ember(['generate', 'my-blueprint', 'foo', '--no-typescript']);

      const generated = await file('app/my-blueprints/foo.js');
      expect(generated).toEqual(JS_FIXTURE);
    });
  });

  describe('with javascript blueprint', () => {
    beforeEach(() => {
      fixturifyProject.addAddon('my-addon', '1.0.0', (addon) => {
        addon.files['index.js'] = 'module.exports = { name: "foo" };';
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

      fixturifyProject.writeSync();

      project = fixturifyProject.buildProjectModel();
      project.initializeAddons();
      process.chdir(project.root);
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
