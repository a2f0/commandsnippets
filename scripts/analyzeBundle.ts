#!/usr/bin/env node

/**
 * Bundle size analysis script
 * Analyzes the build output and reports bundle sizes
 */

import fs from 'node:fs';
import path from 'node:path';

const BUILD_DIR = 'build';
const ASSETS_DIR = path.join(BUILD_DIR, 'assets');

interface FileSize {
  name: string;
  size: number;
  formattedSize: string;
}

interface BundleAnalysis {
  timestamp: string;
  totalSize: number;
  files: FileSize[];
}

function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, (error as Error).message);
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function analyzeBundle(): void {
  console.log('🔍 Analyzing bundle size...\n');

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ Build directory not found. Run "pnpm run build" first.');
    process.exit(1);
  }

  const files = fs.readdirSync(ASSETS_DIR);
  const jsFiles = files.filter(file => file.endsWith('.js'));

  let totalSize = 0;
  const fileSizes: FileSize[] = [];

  jsFiles.forEach(file => {
    const filePath = path.join(ASSETS_DIR, file);
    const size = getFileSize(filePath);
    totalSize += size;
    fileSizes.push({
      name: file,
      size,
      formattedSize: formatBytes(size),
    });
  });

  // Sort by size (largest first)
  fileSizes.sort((a, b) => b.size - a.size);

  console.log('📦 Bundle Analysis Results:\n');

  fileSizes.forEach(file => {
    console.log(`${file.name}: ${file.formattedSize}`);
  });

  console.log(`\n📊 Total Bundle Size: ${formatBytes(totalSize)}`);

  // Warning for large bundles
  if (totalSize > 500 * 1024) {
    // 500KB
    console.log('\n⚠️  Warning: Bundle size is larger than 500KB');
    console.log('💡 Consider:');
    console.log('   - Code splitting with dynamic imports');
    console.log('   - Tree shaking unused dependencies');
    console.log('   - Using smaller alternatives for large libraries');
  }

  // Save analysis to file
  const analysis: BundleAnalysis = {
    timestamp: new Date().toISOString(),
    totalSize,
    files: fileSizes,
  };

  fs.writeFileSync('bundle-analysis.json', JSON.stringify(analysis, null, 2));

  console.log('\n💾 Analysis saved to bundle-analysis.json');
}

analyzeBundle();
