import sortPackageJson from 'sort-package-json';
import { when, polishFileContent } from '../utils';
import { CreateAppContext } from '../types';

export default ({ projectName, platforms }: CreateAppContext) => {
  const packageConfigs = {
    name: projectName,
    private: true,
    scripts: {
      clean: 'rm -rf ./lib ./dist && rm -f tsconfig.tsbuildinfo',

      migrate: 'per-env',
      'migrate:development': 'ts-node ./src/cli/migrate.ts',
      'migrate:production': 'node ./lib/cli/migrate.js',

      build: `npm run clean && npm run build:source${when(
        platforms.includes('webview')
      )` && npm run build:next`}`,
      'build:source': 'tsc',
      'build:next': platforms.includes('webview')
        ? 'next build ./webview'
        : undefined,

      start: 'per-env',
      'start:development': 'ts-node ./src/index.ts',
      'start:production': 'node ./lib/index.js',

      dev: 'ts-node ./src/cli/dev.ts',
    },
    dependencies: {
      '@machinat/per-env': '^1.1.0',
      commander: '^7.2.0',
      dotenv: '^8.2.0',
      umzug: '^3.0.0-beta.15',
    },
    devDependencies: {
      '@types/node': '^14.14.41',
      nodemon: '^2.0.7',
      'ts-node': '^9.1.1',
      typescript: '^4.2.4',
      localtunnel: '^2.0.1',
    },
  };

  if (platforms.includes('webview')) {
    packageConfigs.dependencies = {
      ...packageConfigs.dependencies,
      ...{
        next: '^11.0.1',
        react: '^17.0.2',
        'react-dom': '^17.0.2',
      },
    };

    packageConfigs.devDependencies['@types/react'] = '^17.0.2';
  }

  return polishFileContent(
    JSON.stringify(sortPackageJson(packageConfigs), null, 2)
  );
};
