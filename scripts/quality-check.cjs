#!/usr/bin/env node

/**
 * Quality check script using standard tools instead of fragile regex parsing.
 */

const { execSync } = require('child_process');

function runCommand(command, description) {
    console.log(`🔍 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        console.log(`✅ ${description} passed\n`);
    } catch (error) {
        console.error(`❌ ${description} failed`);
        process.exit(1);
    }
}

console.log('🚀 Running quality checks with standard tools...\n');

// 1. TypeScript compilation check
runCommand('npx tsc --noEmit', 'TypeScript compilation');

// 2. Dead code detection using ts-prune (already installed)
runCommand('npx ts-prune', 'Dead code detection');

// 3. ESLint for code quality and duplicates
runCommand('npx eslint src/**/*.ts', 'Code linting');

// 4. Build verification
runCommand('npm run build', 'Build verification');

console.log('🎉 All quality checks passed!');