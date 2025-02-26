#!/usr/bin/env bash

# Create workspace file
echo "packages:
  - 'packages/*'" > pnpm-workspace.yaml

# Create packages directory
mkdir -p packages/node-deepresearch packages/jina-ai

# Move root code to node-deepresearch package
cp -r src packages/node-deepresearch/
cp package.json tsconfig.json jest.config.js jest.setup.js packages/node-deepresearch/

# Move jina-ai code to jina-ai package
cp -r jina-ai/* packages/jina-ai/
rm -rf jina-ai

# Copy shared configuration files to root
cp .eslintrc.js .dockerignore LICENSE README.md lefthook.yml ./