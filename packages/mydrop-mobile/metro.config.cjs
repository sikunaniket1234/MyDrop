const path = require("node:path");
const fs = require("node:fs");
const { resolve } = require("metro-resolver");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const workspaceRoot = path.resolve(__dirname, "../..");
const packageRoot = __dirname;
const modulePath = name => fs.realpathSync(path.join(packageRoot, "node_modules", name));
const reactNativeRoot = modulePath("react-native");
const reactRoot = modulePath("react");
const resolveModuleRoot = name => {
  const packageJsonPath = require.resolve(path.join(name, "package.json"), {
    paths: [packageRoot, workspaceRoot, reactNativeRoot],
  });
  return path.dirname(packageJsonPath);
};

module.exports = mergeConfig(getDefaultConfig(__dirname), {
  resolver: {
    extraNodeModules: new Proxy(
      {},
      {
        get: (_target, name) => resolveModuleRoot(String(name)),
      },
    ),
    nodeModulesPaths: [path.join(packageRoot, "node_modules"), path.join(workspaceRoot, "node_modules")],
    resolveRequest: (context, moduleName, platform) => {
      const origin = context.originModulePath ?? "";
      const isMyDropSource = origin.startsWith(path.join(packageRoot, "src"));
      if (isMyDropSource && moduleName.startsWith(".") && moduleName.endsWith(".js")) {
        try {
          return resolve(context, moduleName.replace(/\.js$/, ".ts"), platform);
        } catch {
          return resolve(context, moduleName.replace(/\.js$/, ".tsx"), platform);
        }
      }

      return resolve(context, moduleName, platform);
    },
    unstable_enablePackageExports: true,
    unstable_enableSymlinks: true,
  },
  watchFolders: [
    path.join(workspaceRoot, "packages"),
    path.join(workspaceRoot, "node_modules", ".pnpm"),
    reactNativeRoot,
    reactRoot,
  ],
});
