#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns that might indicate hardcoded secrets
const SECRET_PATTERNS = [
  // API Keys and Tokens
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{32,}/, severity: 'CRITICAL' },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/, severity: 'CRITICAL' },
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'CRITICAL' },
  { name: 'Generic API Key', pattern: /api[_-]?key\s*[:=]\s*["'][^"']{20,}["']/, severity: 'HIGH' },
  { name: 'JWT Secret', pattern: /jwt[_-]?secret\s*[:=]\s*["'][^"']{32,}["']/, severity: 'CRITICAL' },
  
  // Database URLs with credentials
  { name: 'Database URL with credentials', pattern: /postgres:\/\/[^:]+:[^@]+@/, severity: 'CRITICAL' },
  { name: 'MongoDB URI with credentials', pattern: /mongodb:\/\/[^:]+:[^@]+@/, severity: 'CRITICAL' },
  
  // Generic secrets
  { name: 'Password assignment', pattern: /password\s*[:=]\s*["'][^"']{8,}["']/, severity: 'MEDIUM' },
  { name: 'Secret assignment', pattern: /secret\s*[:=]\s*["'][^"']{16,}["']/, severity: 'HIGH' },
  { name: 'Token assignment', pattern: /token\s*[:=]\s*["'][^"']{20,}["']/, severity: 'HIGH' },
  
  // Private keys
  { name: 'Private Key', pattern: /-----BEGIN[\s\S]*PRIVATE KEY-----/, severity: 'CRITICAL' },
  { name: 'RSA Private Key', pattern: /-----BEGIN RSA PRIVATE KEY-----/, severity: 'CRITICAL' },
  
  // Common hardcoded values
  { name: 'Hardcoded localhost with credentials', pattern: /localhost:[0-9]+\/[^\/]*:[^@]*@/, severity: 'MEDIUM' },
];

// Files to ignore
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.log$/,
  /\.lock$/,
  /audit-secrets\.js$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
];

// Extensions to scan
const SCAN_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.json', '.env', '.yaml', '.yml'];

class SecretAuditor {
  constructor() {
    this.findings = [];
    this.scannedFiles = 0;
    this.startTime = Date.now();
  }

  shouldIgnoreFile(filePath) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  shouldScanFile(filePath) {
    const ext = path.extname(filePath);
    return SCAN_EXTENSIONS.includes(ext) || path.basename(filePath).startsWith('.env');
  }

  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, lineNumber) => {
        SECRET_PATTERNS.forEach(({ name, pattern, severity }) => {
          const matches = line.match(pattern);
          if (matches) {
            // Skip if it's clearly an environment variable reference
            if (line.includes('process.env.') || line.includes('${') || line.includes('$')) {
              return;
            }
            
            // Skip comments that explain what should be here
            if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('*')) {
              return;
            }
            
            this.findings.push({
              file: path.relative(process.cwd(), filePath),
              line: lineNumber + 1,
              severity,
              type: name,
              content: line.trim(),
              match: matches[0]
            });
          }
        });
      });
      
      this.scannedFiles++;
    } catch (error) {
      console.warn(`Warning: Could not scan file ${filePath}: ${error.message}`);
    }
  }

  scanDirectory(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldIgnoreFile(fullPath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (entry.isFile() && this.shouldScanFile(fullPath)) {
          this.scanFile(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dirPath}: ${error.message}`);
    }
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const report = {
      summary: {
        totalFiles: this.scannedFiles,
        totalFindings: this.findings.length,
        scanDuration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        severityBreakdown: {
          CRITICAL: this.findings.filter(f => f.severity === 'CRITICAL').length,
          HIGH: this.findings.filter(f => f.severity === 'HIGH').length,
          MEDIUM: this.findings.filter(f => f.severity === 'MEDIUM').length
        }
      },
      findings: this.findings.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
    };

    return report;
  }

  printReport(report) {
    console.log('\n🔍 SECRET AUDIT REPORT');
    console.log('====================');
    console.log(`📊 Scanned ${report.summary.totalFiles} files in ${report.summary.scanDuration}`);
    console.log(`🔍 Found ${report.summary.totalFindings} potential issues`);
    
    if (report.summary.totalFindings === 0) {
      console.log('✅ No hardcoded secrets detected!');
      return true;
    }

    console.log('\n📈 Severity Breakdown:');
    console.log(`   🔴 CRITICAL: ${report.summary.severityBreakdown.CRITICAL}`);
    console.log(`   🟡 HIGH: ${report.summary.severityBreakdown.HIGH}`);
    console.log(`   🟠 MEDIUM: ${report.summary.severityBreakdown.MEDIUM}`);

    console.log('\n🚨 FINDINGS:');
    console.log('============');
    
    report.findings.forEach((finding, index) => {
      const severity = finding.severity === 'CRITICAL' ? '🔴' : 
                     finding.severity === 'HIGH' ? '🟡' : '🟠';
      
      console.log(`\n${index + 1}. ${severity} ${finding.type} (${finding.severity})`);
      console.log(`   📁 File: ${finding.file}:${finding.line}`);
      console.log(`   📄 Content: ${finding.content}`);
      console.log(`   🎯 Match: "${finding.match}"`);
    });

    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('===================');
    console.log('1. Move all secrets to environment variables');
    console.log('2. Use .env files for local development (ensure they are in .gitignore)');
    console.log('3. Use a secret management service in production');
    console.log('4. Never commit API keys, passwords, or tokens to version control');
    console.log('5. Use environment-specific configuration');

    // Return false if critical or high severity issues found
    return report.summary.severityBreakdown.CRITICAL === 0 && 
           report.summary.severityBreakdown.HIGH === 0;
  }
}

function main() {
  console.log('🔍 Starting security audit for hardcoded secrets...\n');
  
  const auditor = new SecretAuditor();
  const rootDir = path.resolve(__dirname, '..');
  
  auditor.scanDirectory(rootDir);
  const report = auditor.generateReport();
  const passed = auditor.printReport(report);
  
  // Save report to file
  const reportPath = path.join(rootDir, 'secret-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  // Exit with error if critical/high issues found
  if (!passed) {
    console.log('\n❌ Security audit failed: Critical or high severity issues detected');
    process.exit(1);
  } else {
    console.log('\n✅ Security audit passed: No critical or high severity issues detected');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SecretAuditor }; 