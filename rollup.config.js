/**
 * 
 * Based on: https://gist.github.com/aleclarson/9900ed2a9a3119d865286b218e14d226
 * 
 */

// import dts from 'rollup-plugin-dts'
// import esbuild from 'rollup-plugin-esbuild'

import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

import packageJson from './package.json' assert { type: 'json' }
const name = packageJson.main.replace(/\.js$/, '')
const input = packageJson.entry
const globals = Object.keys({ 
  ...packageJson.dependencies
})

// const bundle = config => ({
//   ...config,
//   input,
//   // external: id => !/^[./]/.test(id),
// })

export default [
  {
    input,
    output: [
      {
        file: `${name}.js`,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: `${name}.mjs`,
        format: 'es',
        sourcemap: true,
      },
      {
        name: 'cem',
        file: `${name}.browser.js`,
        format: 'iife',
        sourcemap: true,
      },
    ],
    external: ["p5"],
    plugins: [
      nodeResolve(),
      typescript(),
      commonjs({ include: 'node_modules/**' })
    ],
  },
  // {
  //   plugins: [dts()],
  //   output: {
  //     file: `${name}.d.ts`,
  //     format: 'es',
  //   },
  // },
]
