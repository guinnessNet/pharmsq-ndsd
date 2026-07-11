import { DefinePlugin, type Configuration } from 'webpack';
import { rules } from './webpack.rules';

export const mainConfig: Configuration = {
  entry: './src/main/index.ts',
  module: {
    rules,
  },
  plugins: [
    // NDSD_TEST_BUILD 를 "패키징 시점" 값으로 고정(compile-time 상수화).
    // 운영 빌드(미설정)에서는 SPY 드라이버 게이트(automation/index.ts spyDir)가
    // 코드 수준에서 항상 닫힌다 — 배포본에 NDSD_SPY_DIR 환경변수를 넣어도
    // 무전송 가짜 성공(SPY)이 활성화될 수 없다. 통합 테스트용 빌드만
    // `NDSD_TEST_BUILD=1 npm run package` 로 만든다.
    new DefinePlugin({
      'process.env.NDSD_TEST_BUILD': JSON.stringify(process.env.NDSD_TEST_BUILD ?? ''),
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
};
