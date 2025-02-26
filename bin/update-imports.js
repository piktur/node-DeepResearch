#!/usr/bin/env node --experimental-strip-types
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var ts_morph_1 = require("ts-morph");
// Define the packages to process
var packages = [
    'packages/node-deepresearch',
    'packages/jina-ai'
];
// Process each package
for (var _i = 0, packages_1 = packages; _i < packages_1.length; _i++) {
    var packagePath = packages_1[_i];
    console.log("Processing package: ".concat(packagePath));
    var project = new ts_morph_1.Project({
        tsConfigFilePath: path.join(packagePath, 'tsconfig.json'),
    });
    // Add source files
    project.addSourceFilesAtPaths([
        path.join(packagePath, 'src/**/*.ts'),
        path.join(packagePath, 'src/**/*.js'),
    ]);
    var sourceFiles = project.getSourceFiles();
    console.log("Found ".concat(sourceFiles.length, " source files"));
    for (var _a = 0, sourceFiles_1 = sourceFiles; _a < sourceFiles_1.length; _a++) {
        var sourceFile = sourceFiles_1[_a];
        var hasChanges = false;
        var filePath = sourceFile.getFilePath();
        console.log("Processing file: ".concat(filePath));
        // Get all import declarations
        var importDeclarations = sourceFile.getImportDeclarations();
        for (var _b = 0, importDeclarations_1 = importDeclarations; _b < importDeclarations_1.length; _b++) {
            var importDecl = importDeclarations_1[_b];
            var moduleSpecifier = importDecl.getModuleSpecifierValue();
            // Skip if it's not a relative import
            if (!moduleSpecifier.startsWith('.')) {
                continue;
            }
            // Skip package.json imports
            if (moduleSpecifier.includes('package.json') || moduleSpecifier.includes('config.json')) {
                continue;
            }
            // Get the source file directory
            var sourceFileDir = path.dirname(filePath);
            // Resolve the absolute path of the imported file
            var resolvedPath = path.resolve(sourceFileDir, moduleSpecifier);
            // Get the path relative to the src directory
            var srcDir = path.join(packagePath, 'src');
            var relativePath = path.relative(srcDir, resolvedPath);
            // Convert backslashes to forward slashes for consistency
            relativePath = relativePath.replace(/\\/g, '/');
            // Create the new import path with #src alias
            var newModuleSpecifier = "#src/".concat(relativePath);
            // Add .js extension if not present
            var finalModuleSpecifier = newModuleSpecifier.endsWith('.js')
                ? newModuleSpecifier
                : "".concat(newModuleSpecifier, ".js");
            // Update the import declaration
            importDecl.setModuleSpecifier(finalModuleSpecifier);
            hasChanges = true;
            console.log("  Updated import: ".concat(moduleSpecifier, " -> ").concat(finalModuleSpecifier));
        }
        // Save the file if changes were made
        if (hasChanges) {
            sourceFile.saveSync();
            console.log("  Saved changes to ".concat(filePath));
        }
    }
}
console.log('Import transformation complete!');
