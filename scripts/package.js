#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const platformArg = args.find(arg => arg.startsWith('--platform='));
const archArg = args.find(arg => arg.startsWith('--arch='));

const PLATFORM = platformArg ? platformArg.split('=')[1] : process.platform;
const ARCH = archArg ? archArg.split('=')[1] : process.arch;
const NAME = 'gemini-wakatime';

function createArchive() {
  const ext = PLATFORM === 'win32' ? 'zip' : 'tar.gz';
  const filename = `${PLATFORM}.${ARCH}.${NAME}.${ext}`;

  console.log(`Creating archive: ${filename}`);

  if (!fs.existsSync('dist')) {
    execSync('npm run build', { stdio: 'inherit' });
  }

  fs.mkdirSync('release', { recursive: true });

  const filesToPackage = [
    'gemini-extension.json',
    'GEMINI.md',
    'package.json',
    'dist/wakatime-server.js',
  ];

  const tempDir = path.join('release', 'temp');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  filesToPackage.forEach(file => {
    if (fs.existsSync(file)) {
      const destPath = path.join(tempDir, path.basename(file));
      fs.copyFileSync(file, destPath);
    }
  });

  if (ext === 'zip') {
    execSync(`cd release/temp && zip -r ../${filename} .`, { stdio: 'inherit' });
  } else {
    execSync(`cd release/temp && tar czf ../${filename} .`, { stdio: 'inherit' });
  }

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log(`Created: release/${filename}`);
}

try {
  createArchive();
} catch (err) {
  console.error('Failed to create archive:', err);
  process.exit(1);
}
