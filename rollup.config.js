import resolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'js/index.js',
  dest: 'app/index.js',
  format: 'iife',
  plugins: [
    resolve({ jsnext: true }),
  ],
};
