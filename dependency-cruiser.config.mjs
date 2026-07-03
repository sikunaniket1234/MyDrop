/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "ui-cannot-import-sync-internals",
      severity: "error",
      comment:
        "UI code may consume public services, but synchronization policy remains inside mydrop-core.",
      from: {
        path: "^packages/mydrop-(desktop|mobile|web)/src/(components|pages|screens|ui)/",
      },
      to: {
        path: "(^packages/mydrop-core/src/sync/|^@mydrop/core/sync(?:/|$))",
      },
    },
    {
      name: "core-cannot-import-react",
      severity: "error",
      comment: "mydrop-core is platform-independent and cannot depend on React.",
      from: { path: "^packages/mydrop-core/" },
      to: { path: "^react(?:/|$)" },
    },
    {
      name: "core-cannot-import-react-native",
      severity: "error",
      comment: "React Native integrations belong in mydrop-mobile.",
      from: { path: "^packages/mydrop-core/" },
      to: { path: "^react-native(?:/|$)" },
    },
    {
      name: "core-cannot-import-tauri",
      severity: "error",
      comment: "Tauri integrations belong in mydrop-desktop.",
      from: { path: "^packages/mydrop-core/" },
      to: { path: "^@tauri-apps(?:/|$)" },
    },
    {
      name: "web-cannot-import-peer-sync",
      severity: "error",
      comment: "mydrop-web is a thin client and must never contain or import peer synchronization.",
      from: { path: "^packages/mydrop-web/" },
      to: {
        path: "(^packages/mydrop-core/src/(sync|discovery)/|^@mydrop/core/(sync|discovery)(?:/|$))",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)(dist|node_modules|\\.turbo)/",
    includeOnly: "^packages/",
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "default"],
    },
  },
};
