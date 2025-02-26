#!/usr/bin/env node --experimental-strip-types

import * as path from "path";
import { Project } from "ts-morph";

// Define the packages to process
const packages = ["packages/node-deepresearch", "packages/jina-ai"];

// Process each package
for (const packagePath of packages) {
  console.log(`Processing package: ${packagePath}`);

  const project = new Project({
    tsConfigFilePath: path.join(packagePath, "tsconfig.json"),
  });

  // Add source files
  project.addSourceFilesAtPaths([
    path.join(packagePath, "src/**/*.ts"),
    path.join(packagePath, "src/**/*.js"),
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`Found ${sourceFiles.length} source files`);

  for (const sourceFile of sourceFiles) {
    let hasChanges = false;
    const filePath = sourceFile.getFilePath();
    console.log(`Processing file: ${filePath}`);

    // Get all import declarations
    const importDeclarations = sourceFile.getImportDeclarations();

    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      // Skip if it's not a relative import
      if (!moduleSpecifier.startsWith(".")) {
        continue;
      }

      // Skip package.json imports
      if (
        moduleSpecifier.includes("package.json") ||
        moduleSpecifier.includes("config.json")
      ) {
        continue;
      }

      // Get the source file directory
      const sourceFileDir = path.dirname(filePath);

      // Resolve the absolute path of the imported file
      const resolvedPath = path.resolve(sourceFileDir, moduleSpecifier);

      // Get the path relative to the src directory
      const srcDir = path.join(packagePath, "src");
      let relativePath = path.relative(srcDir, resolvedPath);

      // Convert backslashes to forward slashes for consistency
      relativePath = relativePath.replace(/\\/g, "/");

      // Create the new import path with #src alias
      const newModuleSpecifier = `#src/${relativePath}`;

      // Add .js extension if not present
      const finalModuleSpecifier = newModuleSpecifier.endsWith(".js")
        ? newModuleSpecifier
        : `${newModuleSpecifier}.js`;

      // Update the import declaration
      importDecl.setModuleSpecifier(finalModuleSpecifier);
      hasChanges = true;

      console.log(
        `  Updated import: ${moduleSpecifier} -> ${finalModuleSpecifier}`,
      );
    }

    // Save the file if changes were made
    if (hasChanges) {
      sourceFile.saveSync();
      console.log(`  Saved changes to ${filePath}`);
    }
  }
}

console.log("Import transformation complete!");
