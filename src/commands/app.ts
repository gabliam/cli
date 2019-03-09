import { Command } from '@oclif/command';
import { createEnv } from 'yeoman-environment';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export default class App extends Command {
  static description = 'describe the command here';

  static examples = [`$ gab app`];

  static args = [
    {
      name: 'name',
      required: true,
      description: 'The name of the new workspace and initial project.',
    },
  ];

  async run() {
    const { args } = this.parse(App);
    const env = createEnv();

    const projectPath = path.resolve(process.cwd(), args.name);

    if (!await fs.pathExists(projectPath)) {
      await fs.mkdir(projectPath);
    } else {
      console.log(chalk.red(`${args.name} exist. Please choose another project name.`));
      process.exit(1);
    }

    env.register(require.resolve(`../generators/app`), `gabliam:app`);

    await new Promise((resolve, reject) => {
      env.run(
        `gabliam:app`,
        {
          projectPath,
          projectName: args.name
        },
        (err: Error, results: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        }
      );
    });
  }
}
