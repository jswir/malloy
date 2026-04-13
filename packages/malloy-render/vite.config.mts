import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base.mts';

const entry = process.env.VITE_ENTRY;

export default mergeConfig(baseViteConfig, {
  build: {
    lib: entry === 'echarts'
      ? {
          entry: 'src/echarts-index.ts',
          name: 'echarts',
          fileName: 'echarts',
          formats: ['es'],
        }
      : {
          entry: 'src/index.ts',
          name: 'index',
          fileName: 'index',
        },
  },
});
