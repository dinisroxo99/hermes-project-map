import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeProjectStructure,
  inferFeatureFromSymbol,
  inferLayerFromProjectName
} from "../src/lib/project-structure.js";

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-project-map-"));

  fs.writeFileSync(path.join(root, "Faturas.sln"), "Microsoft Visual Studio Solution File, Format Version 12.00\n");

  const projects = [
    "Fatura.API",
    "Faturas.Application",
    "Faturas.Domain",
    "Faturas.Infrastructure"
  ];

  for (const project of projects) {
    const dir = path.join(root, project);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${project}.csproj`), `<Project Sdk=\"Microsoft.NET.Sdk\"></Project>`);
  }

  fs.mkdirSync(path.join(root, "Faturas.Application", "Invoices", "Commands"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "Faturas.Application", "Invoices", "Commands", "CreateInvoiceCommand.cs"),
    "namespace Faturas.Application.Invoices.Commands; public class CreateInvoiceCommand {}"
  );

  fs.mkdirSync(path.join(root, "Faturas.Domain", "Suppliers"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "Faturas.Domain", "Suppliers", "Supplier.cs"),
    "namespace Faturas.Domain.Suppliers; public class Supplier {}"
  );

  fs.mkdirSync(path.join(root, "Faturas.Infrastructure", "Services", "Taxes"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "Faturas.Infrastructure", "Services", "Taxes", "TaxSyncService.cs"),
    "namespace Faturas.Infrastructure.Services.Taxes; public class TaxSyncService {}"
  );

  return root;
}

test("analyzeProjectStructure detects solution, projects, layers and features", () => {
  const root = makeTempProject();

  const structure = analyzeProjectStructure({
    name: "faturas-backend",
    absolutePath: root
  });

  assert.equal(structure.solution.name, "Faturas");
  assert.equal(structure.projects.length, 4);
  assert.deepEqual(
    structure.projects.map((project) => [project.name, project.layer]),
    [
      ["Fatura.API", "API"],
      ["Faturas.Application", "Application"],
      ["Faturas.Domain", "Domain"],
      ["Faturas.Infrastructure", "Infrastructure"]
    ]
  );

  assert.equal(structure.canSubdivide, true);
  assert.deepEqual(structure.layers.map((layer) => layer.name), ["API", "Application", "Domain", "Infrastructure"]);
  assert.ok(structure.features.some((feature) => feature.name === "Invoices"));
  assert.ok(structure.features.some((feature) => feature.name === "Suppliers"));
  assert.ok(structure.features.some((feature) => feature.name === "Taxes"));
});

test("inferLayerFromProjectName maps common .NET architecture projects", () => {
  assert.equal(inferLayerFromProjectName("Fatura.API"), "API");
  assert.equal(inferLayerFromProjectName("Faturas.Application"), "Application");
  assert.equal(inferLayerFromProjectName("Faturas.Domain"), "Domain");
  assert.equal(inferLayerFromProjectName("Faturas.Infrastructure"), "Infrastructure");
  assert.equal(inferLayerFromProjectName("SharedKernel"), "Other");
});

test("inferFeatureFromSymbol prefers path and namespace business segments", () => {
  assert.equal(inferFeatureFromSymbol({
    projectName: "Faturas.Application",
    layer: "Application",
    relativeFile: "Faturas.Application/Invoices/Commands/CreateInvoiceCommand.cs",
    namespace: "Faturas.Application.Invoices.Commands",
    name: "CreateInvoiceCommand"
  }), "Invoices");

  assert.equal(inferFeatureFromSymbol({
    projectName: "Faturas.Infrastructure",
    layer: "Infrastructure",
    relativeFile: "Faturas.Infrastructure/Services/Toconline/ToconlineClient.cs",
    namespace: "Faturas.Infrastructure.Services.Toconline",
    name: "ToconlineClient"
  }), "Toconline");
});
