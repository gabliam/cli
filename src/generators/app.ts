import chalk from 'chalk';
import { execSync } from 'child_process';
import path from 'path';
import Generator from 'yeoman-generator';
const sortPjson = require('sort-pjson');

const GABLIAM_VERSION = 'latest';
const debug = require('debug')('generator-gabliam');

let hasYarn = false;
try {
  execSync('yarn -v', { stdio: 'ignore' });
  hasYarn = true;
} catch {}

interface Answers {
  description: string;
  version: string;
  github: { repo: string; user: string };
  author: string;
  license: string;
  pkg: string;

  installPlugin: boolean;

  plugins?: string[];

  webType?: 'express' | 'koa';
}

class App extends Generator {
  answers: Answers;

  pjson: any;
  githubUser: string | undefined;
  projectPath: string;
  yarn: boolean;
  projectName: string;
  pluginsBootstrap: { name: string; importPath: string }[] = [];
  pluginsInstall: string[] = [];

  constructor(args: any, opts: any) {
    super(args, opts);
    this.projectPath = opts.projectPath;
    this.projectName = opts.projectName;
    this.yarn = hasYarn;
  }

  async prompting() {
    this.destinationRoot(path.resolve(this.projectPath));
    process.chdir(this.destinationRoot());

    this.pjson = {
      scripts: {
        start: 'gab start',
        watch: `nodemon -e ts --watch 'src/**/*.ts' --watch 'index.ts' --ignore 'src/**/*.spec.ts' --exec gabliam start`,
        build: 'tsc',
      },
      engines: {},
      files: ['lib', 'index.js', 'index.d.ts'],
      ...this.fs.readJSON('package.json', {}),
    };

    let repository = this.destinationRoot()
      .split(path.sep)
      .slice(-2)
      .join('/');

    this.githubUser = await this.user.github.username().catch(debug);

    if (this.githubUser) {
      repository = `${this.githubUser}/${repository.split('/')[1]}`;
    }

    const defaults = {
      name: this.determineAppname().replace(/ /g, '-'),
      version: '0.0.0',
      license: 'MIT',
      author: this.githubUser
        ? `${this.user.git.name()} @${this.githubUser}`
        : this.user.git.name(),
      dependencies: {},
      repository,
      ...this.pjson,
      engines: {
        node: '>=10.0.0',
        ...this.pjson.engines,
      },
      options: this.options,
    };

    this.answers = (await this.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'description',
        default: defaults.description,
        when: !this.pjson.description,
      },
      {
        type: 'input',
        name: 'author',
        message: 'author',
        default: defaults.author,
        when: !this.pjson.author,
      },
      {
        type: 'input',
        name: 'version',
        message: 'version',
        default: defaults.version,
        when: !this.pjson.version,
      },
      {
        type: 'input',
        name: 'license',
        message: 'license',
        default: defaults.license,
        when: !this.pjson.license,
      },
      {
        type: 'input',
        name: 'github.user',
        message:
          'Who is the GitHub owner of repository (https://github.com/OWNER/repo)',
        default: repository
          .split('/')
          .slice(0, -1)
          .pop(),
        when: !this.pjson.repository,
      },
      {
        type: 'input',
        name: 'github.repo',
        message:
          'What is the GitHub name of repository (https://github.com/owner/REPO)',
        default: (answers: any) =>
          (this.pjson.repository || this.projectName || this.pjson.name)
            .split('/')
            .pop(),
        when: !this.pjson.repository,
      },
      {
        type: 'list',
        name: 'pkg',
        message: 'Select a package manager',
        choices: [
          { name: 'npm', value: 'npm' },
          { name: 'yarn', value: 'yarn' },
        ],
        default: () => (this.options.yarn || hasYarn ? 1 : 0),
      },
      {
        type: 'confirm',
        name: 'installPlugin',
        message: 'Do you want install plugin',
      },
      {
        name: 'plugins',
        type: 'checkbox',
        message: 'Choose plugins to install',
        choices: [
          { name: 'Rest', value: 'rest' },
          { name: 'Amqp', value: 'amqp' },
          { name: 'Graphql', value: 'graphql' },
        ],
        when: (response: any) => response.installPlugin,
      },
      {
        name: 'webType',
        type: 'list',
        message: 'Choose the web framework',
        choices: [
          { name: 'express', value: 'express' },
          { name: 'koa', value: 'koa' },
        ],
        when: (response: any) =>
          response.installPlugin &&
          (response.plugins.includes('rest') ||
            response.plugins.includes('graphql')),
      },
    ])) as any;

    if (this.answers.installPlugin && Array.isArray(this.answers.plugins)) {
      const hasGraphql = this.answers.plugins.includes('graphql');
      const hasRest = this.answers.plugins.includes('rest');
      const hasAmqp = this.answers.plugins.includes('amqp');
      const isExpress = this.answers.webType === 'express';
      const isKoa = this.answers.webType === 'koa';

      if (hasGraphql || hasRest) {
        this.pluginsInstall.push(`@gabliam/web-core@${GABLIAM_VERSION}`);
        if (hasGraphql) {
          this.pluginsInstall.push(`@gabliam/graphql-core@${GABLIAM_VERSION}`);
        }
        if (isExpress) {
          this.pluginsInstall.push(`@gabliam/express@${GABLIAM_VERSION}`);
          this.pluginsBootstrap.push({
            importPath: '@gabliam/express',
            name: 'ExpressPlugin',
          });
          if (hasGraphql) {
            this.pluginsInstall.push(
              `@gabliam/graphql-express@${GABLIAM_VERSION}`
            );
            this.pluginsBootstrap.push({
              importPath: '@gabliam/graphql-express',
              name: 'GraphqlExpressPlugin',
            });
          }
        } else if (isKoa) {
          this.pluginsInstall.push(`@gabliam/koa@${GABLIAM_VERSION}`);
          this.pluginsBootstrap.push({
            importPath: '@gabliam/koa',
            name: 'KoaPlugin',
          });
          if (hasGraphql) {
            this.pluginsInstall.push(`@gabliam/graphql-koa@${GABLIAM_VERSION}`);
            this.pluginsBootstrap.push({
              importPath: '@gabliam/graphql-koa',
              name: 'GraphqlKoaPlugin',
            });
          }
        }
      }

      if (hasAmqp) {
        this.pluginsInstall.push(`@gabliam/amqp@${GABLIAM_VERSION}`);
        this.pluginsBootstrap.push({
          importPath: '@gabliam/amqp',
          name: 'AmqpPlugin',
        });
      }
    }

    this.pjson = {
      ...this.pjson,
      name: defaults.name,
      description: this.answers.description || defaults.description,
      version: this.answers.version || defaults.version,
      engines: {
        ...this.pjson.engines,
        node: defaults.engines.node,
      },
      author: this.answers.author || defaults.author,
      license: this.answers.license || defaults.license,
      repository: this.answers.github
        ? `${this.answers.github.user}/${this.answers.github.repo}`
        : defaults.repository,
    };
  }

  writing() {
    this.sourceRoot(path.join(__dirname, '../../templates/app'));
    this.fs.copy(
      this.templatePath('tslint.json'),
      this.destinationPath('tslint.json')
    );
    this.fs.copy(
      this.templatePath('tsconfig.json'),
      this.destinationPath('tsconfig.json')
    );
    this.fs.copy(
      this.templatePath('editorconfig'),
      this.destinationPath('.editorconfig')
    );
    this.fs.copy(
      this.templatePath('gitattributes'),
      this.destinationPath('.gitattributes')
    );
    this.fs.copy(
      this.templatePath('gitignore'),
      this.destinationPath('.gitignore')
    );
    this.fs.copy(
      this.templatePath('prettierrc'),
      this.destinationPath('.prettierrc')
    );
    this.fs.copy(
      this.templatePath('config/application.yml'),
      this.destinationPath('config/application.yml')
    );
    this.fs.copyTpl(
      this.templatePath('index.ts.ejs'),
      this.destinationPath('index.ts'),
      this
    );
    this.fs.writeJSON(
      this.destinationPath('./package.json'),
      sortPjson(this.pjson)
    );
    this.fs.copyTpl(
      this.templatePath('README.md.ejs'),
      this.destinationPath('README.md'),
      this
    );

    if (this.pjson.license === 'MIT') {
      this.fs.copyTpl(
        this.templatePath('LICENSE.mit'),
        this.destinationPath('LICENSE'),
        this
      );
    }

    if (this.answers.installPlugin && Array.isArray(this.answers.plugins)) {
      if (this.answers.plugins.includes('rest')) {
        this.fs.copy(
          this.templatePath('rest/hello-controller.ts'),
          this.destinationPath('src/hello-controller.ts')
        );
      }
    }
  }

  install() {
    const dependencies = [
      `@gabliam/core@${GABLIAM_VERSION}`,
      `@gabliam/log4js@${GABLIAM_VERSION}`
    ];

    if (this.pluginsInstall.length) {
      dependencies.push(...this.pluginsInstall);
    }
    const devDependencies = [
      '@gabliam/tslint@^1.0.2',
      '@types/node@^10.12.21',
      'reflect-metadata@^0.1.13',
      'nodemon@^1.18.9',
      'ts-node@^8.0.2',
      'tslint@^5.12.1',
      'typescript@^3.2.4',
    ];

    const yarnOpts = {} as any;
    if (process.env.YARN_MUTEX) {
      yarnOpts.mutex = process.env.YARN_MUTEX;
    }

    const useYarn = this.yarn && this.answers.pkg === 'yarn';

    const install = (deps: string[], opts: object) =>
      useYarn ? this.yarnInstall(deps, opts) : this.npmInstall(deps, opts);
    const dev = useYarn ? { dev: true } : { 'save-dev': true };
    const save = useYarn ? {} : { save: true };
    return Promise.all([
      install(devDependencies, { ...yarnOpts, ...dev, ignoreScripts: true }),
      install(dependencies, { ...yarnOpts, ...save }),
    ]);
  }

  end() {
    this.log(
      chalk.green(`\nCreated ${this.pjson.name} in ${this.destinationRoot()}`)
    );
  }
}

export = App;
