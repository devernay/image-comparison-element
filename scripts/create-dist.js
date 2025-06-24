/**
 * Script to create a distribution archive of the project
 * Includes all source files, documentation, and auxiliary files
 * The archive filename includes the current date and time
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Get current date and time for the filename
const now = new Date();
const timestamp = now.toISOString()
  .replace(/:/g, '-')
  .replace(/\..+/, '')
  .replace('T', '_');

const outputFilename = `image-comparison-element_${timestamp}.zip`;
const output = fs.createWriteStream(path.join(__dirname, '..', 'dist', outputFilename));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Listen for archive warnings
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

// Handle archive errors
archive.on('error', (err) => {
  throw err;
});

// Pipe archive data to the output file
archive.pipe(output);

// Add source files
archive.directory('src/', 'src');

// Add public files
archive.directory('public/', 'public');

// Add scripts
archive.directory('scripts/', 'scripts');

// Add individual files at the root
const rootFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'webpack.config.js',
  'server.js',
  'README.md',
  'LICENSE',
  '.gitignore'
];

rootFiles.forEach(file => {
  if (fs.existsSync(file)) {
    archive.file(file, { name: file });
  }
});

// Finalize the archive
archive.finalize();

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`Distribution archive created: dist/${outputFilename}`);
  console.log(`Total size: ${sizeInMB} MB`);
});
