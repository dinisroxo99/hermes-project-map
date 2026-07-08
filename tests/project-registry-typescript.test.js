import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { detectProjectType } from "../src/analyzers/common/analyzer-detection.js";
import { analyzeProjectStructure } from "../src/lib/project-structure.js";

function makeTempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("detectProjectType recognises .NET solutions with .slnx and nested csproj files", () => {
  const root = makeTempRoot("hermes-project-map-dotnet-");
  fs.writeFileSync(path.join(root, "Faturas.slnx"), "<Solution></Solution>\n");
  fs.mkdirSync(path.join(root, "Faturas.Application"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "Faturas.Application", "Faturas.Application.csproj"),
    '<Project Sdk="Microsoft.NET.Sdk"></Project>\n'
  );

  assert.equal(detectProjectType(root), "dotnet");
});

test("analyzeProjectStructure builds TypeScript layers and features for UI filters", () => {
  const root = makeTempRoot("hermes-project-map-typescript-");
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}\n');
  fs.writeFileSync(path.join(root, "tsconfig.json"), '{"compilerOptions":{}}\n');

  fs.mkdirSync(path.join(root, "src", "features", "invoices", "components"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "features", "invoices", "components", "invoice-list.tsx"),
    "export const InvoiceList = () => null;\n"
  );

  fs.mkdirSync(path.join(root, "src", "features", "invoices", "hooks"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "features", "invoices", "hooks", "use-invoices.ts"),
    "export function useInvoices() { return []; }\n"
  );

  fs.mkdirSync(path.join(root, "src", "features", "suppliers", "types"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "features", "suppliers", "types", "supplier.ts"),
    "export interface Supplier { id: string }\n"
  );

  const structure = analyzeProjectStructure({
    name: "faturas-frontend",
    absolutePath: root
  });

  assert.equal(structure.projectType, "typescript");
  assert.equal(structure.canSubdivide, true);
  assert.deepEqual(
    structure.layers.map((layer) => layer.name),
    ["logic", "presentation", "types"]
  );
  assert.ok(structure.features.some((feature) => feature.name === "invoices"));
  assert.ok(structure.features.some((feature) => feature.name === "suppliers"));
});
