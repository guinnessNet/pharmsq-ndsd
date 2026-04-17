import type { ForgeConfig } from '@electron-forge/shared-types';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // plugin-webpack 은 자체 staging 에서 dependencies 를 설치하는데
    // file:../pharmsq-ndsd-automation 로컬 경로는 해석 불가 → extraResource 로 asar 외부 복사.
    // 런타임에서는 process.resourcesPath 기준으로 require.
    extraResource: [
      '../pharmsq-ndsd-automation',
      './assets',
    ],
    icon: './assets/app-icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
      config: {},
    },
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupExe: 'pharmsq-ndsd-Setup.exe',
        setupIcon: './assets/app-icon.ico',
        noMsi: false,
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      // 기본 9000 은 Docker/WSL 등과 충돌하는 경우가 있어 9443 사용
      loggerPort: 9443,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/main/preload.ts',
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      // 오픈소스이지만 배포물 변조를 막기 위한 무결성 강제.
      // - OnlyLoadAppFromAsar: asar 외부에서 app 코드를 로드하지 못하게 한다.
      // - EnableEmbeddedAsarIntegrityValidation: 바이너리에 포함된 해시로 asar 를 검증.
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    }),
  ],
};

export default config;
