const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

// Native (N-API) modules can't be bundled by webpack — the compiled .node binary
// has to ship as a real file. pnpm's node_modules are symlinks into a content-addressed
// store, which trips up `vsce`'s dependency-pruning (it shells out to `npm ls`, which
// doesn't understand pnpm's layout). Copying with `dereference: true` resolves the
// symlinks into real files under dist/node_modules, which `vsce package
// --no-dependencies` (see package.json) then ships as-is alongside extension.js.
// node-gyp-build (tree-sitter's/tree-sitter-ruby's own runtime prebuild loader) is
// copied once into a shared dist/node_modules/node-gyp-build — Node's module
// resolution walks up parent node_modules directories, so both consumers find it there.
// Resolved via require.resolve (starting from tree-sitter's own directory) rather than
// a hardcoded .pnpm/node-gyp-build@<version> path, so this doesn't silently break when
// the transitive version bumps.
const nodeGypBuildDir = path.dirname(
  require.resolve('node-gyp-build/package.json', { paths: [path.dirname(require.resolve('tree-sitter/package.json'))] }),
)

// Only the files each package's runtime code path actually touches — not deps/src
// (C/C++ source used solely for compiling from scratch, tens of MB we never need
// since we ship prebuilt binaries).
const nativeModuleCopyPatterns = [
  { from: 'node_modules/better-sqlite3/lib', to: 'node_modules/better-sqlite3/lib' },
  { from: 'node_modules/better-sqlite3/prebuilds', to: 'node_modules/better-sqlite3/prebuilds' },
  { from: 'node_modules/better-sqlite3/package.json', to: 'node_modules/better-sqlite3/package.json' },
  { from: 'node_modules/tree-sitter/index.js', to: 'node_modules/tree-sitter/index.js' },
  { from: 'node_modules/tree-sitter/prebuilds', to: 'node_modules/tree-sitter/prebuilds' },
  { from: 'node_modules/tree-sitter/package.json', to: 'node_modules/tree-sitter/package.json' },
  { from: 'node_modules/tree-sitter-ruby/bindings', to: 'node_modules/tree-sitter-ruby/bindings' },
  { from: 'node_modules/tree-sitter-ruby/prebuilds', to: 'node_modules/tree-sitter-ruby/prebuilds' },
  { from: 'node_modules/tree-sitter-ruby/src/node-types.json', to: 'node_modules/tree-sitter-ruby/src/node-types.json' },
  { from: 'node_modules/tree-sitter-ruby/package.json', to: 'node_modules/tree-sitter-ruby/package.json' },
  { from: nodeGypBuildDir, to: 'node_modules/node-gyp-build' },
]

module.exports = {
  target: 'node',
  mode: 'production',
  entry: {
    extension: './src/extension.ts',
    // Runs off the extension host thread via worker_threads — must be its own
    // standalone entry point (a real .js file on disk), not inlined into extension.js.
    'indexer/indexer.worker': './src/indexer/indexer.worker.ts',
    // Phase 14: standalone MCP server, launched by an MCP client as its own process
    // (not loaded by the VS Code extension host) — also needs to be a real .js file.
    'mcp/server': './src/mcp/server.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  plugins: [
    new CopyWebpackPlugin({ patterns: nativeModuleCopyPatterns }),
  ],
  externals: {
    vscode: 'commonjs vscode',
    // Native (N-API) modules: webpack can't bundle the compiled .node binary,
    // so these stay as real node_modules requires. vsce-package (see package.json)
    // ships node_modules for the "dependencies" section of package.json accordingly.
    'better-sqlite3': 'commonjs better-sqlite3',
    'tree-sitter': 'commonjs tree-sitter',
    'tree-sitter-ruby': 'commonjs tree-sitter-ruby',
    '@opentelemetry/api': 'commonjs @opentelemetry/api',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
}
