# Security Audit Documentation

## Overview

This project implements comprehensive security auditing through automated CI/CD pipelines and local development tools. Every build is scanned for security vulnerabilities, and builds **will fail** if critical or high-severity vulnerabilities are detected.

## Automated CI/CD Security Auditing

### Main CI Pipeline (`.github/workflows/ci.yml`)

The main CI pipeline runs on every push and pull request to `main` and `develop` branches:

- **Backend Security Audit**: Scans `backend-switchai` dependencies
- **Frontend Security Audit**: Scans `frontend-switchai` dependencies  
- **Build Process**: Only proceeds if security audits pass
- **Failure Policy**: Builds fail immediately on critical or high-severity vulnerabilities

### Security Tests Pipeline (`.github/workflows/security-tests.yml`)

Additional comprehensive security testing that runs:
- Daily at 2 AM UTC (scheduled)
- On push/PR to main branches
- Custom security test suite
- Dependency vulnerability scanning
- CodeQL static analysis
- Secret scanning with TruffleHog

## Local Development Security Commands

### Backend (`backend-switchai/`)

```bash
# Basic audit (shows all vulnerabilities)
pnpm run audit

# Show only high and critical vulnerabilities
pnpm run audit:high

# Show only critical vulnerabilities  
pnpm run audit:critical

# Run security check (fails on high/critical vulnerabilities)
pnpm run audit:security

# Attempt to automatically fix vulnerabilities
pnpm run audit:fix
```

### Frontend (`frontend-switchai/`)

```bash
# Basic audit (shows all vulnerabilities)
pnpm run audit

# Show only high and critical vulnerabilities
pnpm run audit:high

# Show only critical vulnerabilities
pnpm run audit:critical

# Run security check (fails on high/critical vulnerabilities)
pnpm run audit:security

# Attempt to automatically fix vulnerabilities
pnpm run audit:fix
```

## Build Failure Policy

### What Causes Build Failures

Builds will **fail** if any of the following are detected:

1. **Critical Vulnerabilities**: Any number of critical security vulnerabilities
2. **High Severity Vulnerabilities**: Any number of high severity vulnerabilities
3. **Security Test Failures**: Failed security test suite execution

### What Does NOT Cause Build Failures

- Moderate severity vulnerabilities (logged but not blocking)
- Low severity vulnerabilities (logged but not blocking)  
- Info level vulnerabilities (logged but not blocking)

## Security Audit Artifacts

All CI runs generate downloadable artifacts:

- **Backend Audit Results**: `backend-audit-results` (JSON format)
- **Frontend Audit Results**: `frontend-audit-results` (JSON format)
- **Security Test Reports**: `security-test-results-node-*` (JSON + text)

Artifacts are retained for 30 days and can be downloaded from the Actions tab.

## How to Handle Security Vulnerabilities

### 1. Automatic Fixes (Recommended First Step)

```bash
cd backend-switchai
pnpm run audit:fix

cd frontend-switchai  
pnpm run audit:fix
```

### 2. Manual Investigation

If automatic fixes don't resolve the issues:

1. Run `pnpm audit` to see detailed vulnerability information
2. Check the specific packages and versions affected
3. Look for alternative packages or update strategies
4. Consider if the vulnerability affects your specific use case

### 3. Emergency Bypassing (Use with Caution)

For critical production deployments where vulnerabilities must be temporarily accepted:

```bash
# This bypasses audit checks - USE ONLY IN EMERGENCIES
pnpm audit --audit-level=critical
```

**Warning**: Bypassing security checks should only be done with full understanding of the risks and proper documentation of the decision.

## Integration with Development Workflow

### Pre-commit Recommendations

Consider adding security audits to your pre-commit hooks:

```bash
# In your pre-commit script
pnpm run audit:security
```

### Local Development Best Practices

1. Run `pnpm run audit:security` before committing changes
2. Regularly update dependencies: `pnpm update`
3. Monitor security advisories for packages you use
4. Use `pnpm run audit:fix` to automatically address vulnerabilities

## CI/CD Workflow Details

### Job Dependencies

1. **Security Audits Run First**: Both backend and frontend audits must pass
2. **Builds Follow Audits**: Application builds only start after successful audits
3. **Security Summary**: Provides overall status and recommendations

### Failure Recovery

When builds fail due to security vulnerabilities:

1. Check the CI logs for specific vulnerability details
2. Download audit artifacts for detailed analysis
3. Apply fixes locally using the audit commands
4. Test the fixes locally before pushing
5. Push the fixes to trigger a new build

## Monitoring and Alerts

- **Daily Scheduled Scans**: Automated daily security checks
- **Pull Request Comments**: Security test results posted to PRs
- **GitHub Step Summary**: Detailed results in workflow summaries
- **Artifact Storage**: Historical audit data for trend analysis

## Contact and Support

For questions about security auditing or to report security issues:

1. Check the workflow logs and artifacts first
2. Review this documentation
3. Create an issue with the `security` label
4. For critical security issues, follow responsible disclosure practices 