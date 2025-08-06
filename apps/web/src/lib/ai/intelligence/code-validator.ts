import { z } from 'zod';
import { standardErrorHandler } from '../error-handling/error-handler';

// Code validation interfaces
export interface CodeValidationResult {
  isValid: boolean;
  errors: CodeValidationError[];
  warnings: CodeValidationWarning[];
  suggestions: CodeValidationSuggestion[];
  securityIssues: SecurityIssue[];
  performance: PerformanceIssue[];
  dependencies: DependencyAnalysis;
}

export interface CodeValidationError {
  type: 'syntax' | 'semantic' | 'security' | 'dependency';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  fixable: boolean;
  suggestedFix?: string;
}

export interface CodeValidationWarning {
  type: 'deprecated' | 'unsafe' | 'performance' | 'style';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface CodeValidationSuggestion {
  type: 'optimization' | 'security' | 'readability' | 'modern';
  message: string;
  line?: number;
  column?: number;
  originalCode?: string;
  suggestedCode?: string;
  confidence: number; // 0-1
}

export interface SecurityIssue {
  type: 'xss' | 'injection' | 'eval' | 'prototype-pollution' | 'regex-dos';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  column?: number;
  cwe?: string; // Common Weakness Enumeration ID
  mitigation: string;
}

export interface PerformanceIssue {
  type: 'memory' | 'cpu' | 'blocking' | 'inefficient';
  message: string;
  line?: number;
  column?: number;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface DependencyAnalysis {
  used: string[];
  unused: string[];
  missing: string[];
  vulnerable: Array<{
    name: string;
    version?: string;
    vulnerability: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
}

// Security patterns to detect
const SECURITY_PATTERNS = {
  eval: {
    pattern: /\beval\s*\(/g,
    type: 'eval' as const,
    severity: 'critical' as const,
    message: 'Use of eval() can lead to code injection vulnerabilities',
    cwe: 'CWE-95',
    mitigation:
      'Use JSON.parse() for JSON data or safer alternatives for dynamic code execution',
  },
  newFunction: {
    pattern: /new\s+Function\s*\(/g,
    type: 'eval' as const,
    severity: 'high' as const,
    message: 'new Function() can execute arbitrary code',
    cwe: 'CWE-95',
    mitigation: 'Avoid dynamic code generation or use safer alternatives',
  },
  innerHTML: {
    pattern: /\.innerHTML\s*=/g,
    type: 'xss' as const,
    severity: 'high' as const,
    message: 'innerHTML assignment can lead to XSS vulnerabilities',
    cwe: 'CWE-79',
    mitigation: 'Use textContent, createElement, or sanitize HTML content',
  },
  documentWrite: {
    pattern: /document\.write\s*\(/g,
    type: 'xss' as const,
    severity: 'medium' as const,
    message: 'document.write can be exploited for XSS attacks',
    cwe: 'CWE-79',
    mitigation: 'Use modern DOM manipulation methods instead',
  },
  prototypeModification: {
    pattern: /\.prototype\s*\[\s*['"]/g,
    type: 'prototype-pollution' as const,
    severity: 'medium' as const,
    message: 'Prototype modification can lead to prototype pollution',
    cwe: 'CWE-1321',
    mitigation:
      'Avoid modifying native prototypes or use Object.defineProperty with proper descriptors',
  },
  regexDos: {
    pattern: /([+*]{2,}|\(\?.*?[+*]{2,}|\[[^\]]*[+*]{2,})/g,
    type: 'regex-dos' as const,
    severity: 'medium' as const,
    message:
      'Potential ReDoS (Regular Expression Denial of Service) vulnerability',
    cwe: 'CWE-1333',
    mitigation:
      'Avoid nested quantifiers and catastrophic backtracking patterns',
  },
};

// Performance anti-patterns
const PERFORMANCE_PATTERNS = {
  blockingLoop: {
    pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/g,
    type: 'blocking' as const,
    impact: 'high' as const,
    message: 'Infinite loops can block the main thread',
    suggestion: 'Use break conditions or setTimeout for async processing',
  },
  inefficientSearch: {
    pattern: /\.indexOf\s*\(\s*[^)]+\s*\)\s*!==?\s*-1/g,
    type: 'inefficient' as const,
    impact: 'low' as const,
    message: 'indexOf for existence check is less efficient than includes()',
    suggestion: 'Use .includes() instead of .indexOf() !== -1',
  },
  memoryLeak: {
    pattern: /addEventListener\s*\([^)]+\)\s*(?!.*removeEventListener)/g,
    type: 'memory' as const,
    impact: 'medium' as const,
    message: 'Event listeners without removal can cause memory leaks',
    suggestion: 'Always remove event listeners when no longer needed',
  },
};

// Modern JavaScript suggestions
const MODERNIZATION_PATTERNS = {
  var: {
    pattern: /\bvar\s+/g,
    type: 'modern' as const,
    message: 'Use const or let instead of var for better scoping',
    confidence: 0.9,
  },
  functionDeclaration: {
    pattern: /function\s*\(\s*[^)]*\s*\)\s*\{/g,
    type: 'modern' as const,
    message: 'Consider using arrow functions for shorter syntax',
    confidence: 0.7,
  },
  stringConcatenation: {
    pattern: /['"][^'"]*['"]\s*\+\s*[^+]/g,
    type: 'modern' as const,
    message: 'Use template literals instead of string concatenation',
    confidence: 0.8,
  },
};

// Dependency patterns
const COMMON_DEPENDENCIES = {
  react: ['React', 'useState', 'useEffect', 'Component'],
  lodash: ['_', 'forEach', 'map', 'filter', 'reduce'],
  axios: ['axios'],
  express: ['express', 'app.get', 'app.post'],
  jquery: ['$', 'jQuery'],
};

/**
 * Advanced code validator with AST-like pattern analysis
 */
export class AdvancedCodeValidator {
  /**
   * Validate JavaScript/TypeScript code
   */
  async validateCode(
    code: string,
    language: 'javascript' | 'typescript',
    context: {
      enableSecurityChecks?: boolean;
      enablePerformanceChecks?: boolean;
      enableModernizationSuggestions?: boolean;
      strictMode?: boolean;
    } = {}
  ): Promise<CodeValidationResult> {
    const {
      enableSecurityChecks = true,
      enablePerformanceChecks = true,
      enableModernizationSuggestions = true,
      strictMode = false,
    } = context;

    const result: CodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      securityIssues: [],
      performance: [],
      dependencies: {
        used: [],
        unused: [],
        missing: [],
        vulnerable: [],
      },
    };

    try {
      // Basic syntax validation
      await this.validateSyntaxThroughExecution(code, language, result);

      // Security analysis
      if (enableSecurityChecks) {
        this.analyzeSecurityIssues(code, result);
      }

      // Performance analysis
      if (enablePerformanceChecks) {
        this.analyzePerformanceIssues(code, result);
      }

      // Modernization suggestions
      if (enableModernizationSuggestions) {
        this.suggestModernizations(code, result);
      }

      // Dependency analysis
      this.analyzeDependencies(code, result);

      // TypeScript specific checks
      if (language === 'typescript') {
        this.validateTypeScript(code, result);
      }

      // Determine overall validity
      result.isValid =
        result.errors.length === 0 &&
        result.securityIssues.filter((issue) => issue.severity === 'critical')
          .length === 0;
    } catch (error) {
      const toolError = standardErrorHandler.handleError(error, {
        context: 'code-validation',
        language,
      });

      result.errors.push({
        type: 'syntax',
        message: `Validation error: ${toolError.message}`,
        severity: 'error',
        fixable: false,
      });
      result.isValid = false;
    }

    return result;
  }

  /**
   * Basic syntax validation using execution-based parsing
   */
  private async validateSyntaxThroughExecution(
    code: string,
    language: 'javascript' | 'typescript',
    result: CodeValidationResult
  ): Promise<void> {
    try {
      // Basic JavaScript parsing attempt via execution
      if (language === 'javascript') {
        // Check for basic syntax errors through Function constructor
        new Function(code); // This will throw on syntax errors
      }

      // Check for common syntax issues
      const syntaxIssues = this.findSyntaxIssues(code);
      result.errors.push(...syntaxIssues);
    } catch (error) {
      // Standardized error handling pattern
      const syntaxError: CodeValidationError = {
        type: 'syntax',
        message:
          error instanceof Error ? error.message : 'Unknown syntax error',
        severity: 'error',
        fixable: false,
      };
      result.errors.push(syntaxError);
    }
  }

  /**
   * Find common syntax issues using pattern matching
   */
  private findSyntaxIssues(code: string): CodeValidationError[] {
    const issues: CodeValidationError[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Unclosed brackets
      const openBrackets = (line.match(/[{[(]/g) || []).length;
      const closeBrackets = (line.match(/[}\])]/g) || []).length;

      // Missing semicolons (simplified check)
      if (line.trim().match(/^(let|const|var|return|throw)\s+.*[^;{}\s]$/)) {
        issues.push({
          type: 'syntax',
          message: 'Missing semicolon',
          line: lineNumber,
          severity: 'warning',
          fixable: true,
          suggestedFix: line + ';',
        });
      }

      // Undefined variables (basic check)
      const matches = line.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
      if (matches) {
        matches.forEach((match) => {
          const funcName = match.replace(/\s*\($/, '');
          if (!this.isCommonBuiltInOrFrameworkFunction(funcName)) {
            issues.push({
              type: 'semantic',
              message: `Potentially undefined function: ${funcName}`,
              line: lineNumber,
              severity: 'warning',
              fixable: false,
            });
          }
        });
      }
    });

    return issues;
  }

  /**
   * Analyze security vulnerabilities
   */
  private analyzeSecurityIssues(
    code: string,
    result: CodeValidationResult
  ): void {
    Object.entries(SECURITY_PATTERNS).forEach(([key, pattern]) => {
      let match;
      while ((match = pattern.pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);

        result.securityIssues.push({
          type: pattern.type,
          severity: pattern.severity,
          message: pattern.message,
          line: lineNumber,
          cwe: pattern.cwe,
          mitigation: pattern.mitigation,
        });

        // Add as error if critical
        if (pattern.severity === 'critical') {
          result.errors.push({
            type: 'security',
            message: pattern.message,
            line: lineNumber,
            severity: 'error',
            fixable: false,
          });
        }
      }
    });
  }

  /**
   * Analyze performance issues
   */
  private analyzePerformanceIssues(
    code: string,
    result: CodeValidationResult
  ): void {
    Object.entries(PERFORMANCE_PATTERNS).forEach(([key, pattern]) => {
      let match;
      while ((match = pattern.pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);

        result.performance.push({
          type: pattern.type,
          message: pattern.message,
          line: lineNumber,
          impact: pattern.impact,
          suggestion: pattern.suggestion,
        });

        // Add as warning for high impact issues
        if (pattern.impact === 'high') {
          result.warnings.push({
            type: 'performance',
            message: pattern.message,
            line: lineNumber,
            suggestion: pattern.suggestion,
          });
        }
      }
    });
  }

  /**
   * Suggest code modernizations
   */
  private suggestModernizations(
    code: string,
    result: CodeValidationResult
  ): void {
    Object.entries(MODERNIZATION_PATTERNS).forEach(([key, pattern]) => {
      let match;
      while ((match = pattern.pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);

        result.suggestions.push({
          type: pattern.type,
          message: pattern.message,
          line: lineNumber,
          confidence: pattern.confidence,
        });
      }
    });
  }

  /**
   * Analyze dependencies
   */
  private analyzeDependencies(
    code: string,
    result: CodeValidationResult
  ): void {
    const used = new Set<string>();
    const missing = new Set<string>();

    // Find import statements
    const importMatches =
      code.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
    importMatches.forEach((match) => {
      const moduleName = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
      if (moduleName) {
        used.add(moduleName);
      }
    });

    // Find require statements
    const requireMatches =
      code.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
    requireMatches.forEach((match) => {
      const moduleName = match.match(/['"]([^'"]+)['"]/)?.[1];
      if (moduleName) {
        used.add(moduleName);
      }
    });

    // Check for commonly used functions that require dependencies
    Object.entries(COMMON_DEPENDENCIES).forEach(([dep, functions]) => {
      functions.forEach((func) => {
        if (code.includes(func) && !used.has(dep)) {
          missing.add(dep);
        }
      });
    });

    // Note: Analysis has limitations - 'unused' requires package.json comparison,
    // 'vulnerable' requires vulnerability database integration
    result.dependencies = {
      used: Array.from(used),
      unused: [], // TODO: Requires package.json analysis for comprehensive unused dependency detection
      missing: Array.from(missing),
      vulnerable: [], // TODO: Requires vulnerability database integration (e.g., npm audit, Snyk)
    };
  }

  /**
   * TypeScript specific validation
   */
  private validateTypeScript(code: string, result: CodeValidationResult): void {
    // Check for any types
    const anyMatches = code.match(/:\s*any\b/g) || [];
    anyMatches.forEach((match, index) => {
      const lineNumber = this.getLineNumber(code, code.indexOf(match));
      result.warnings.push({
        type: 'style',
        message: 'Avoid using "any" type - use specific types instead',
        line: lineNumber,
        suggestion: 'Define proper TypeScript interfaces or use union types',
      });
    });

    // Check for missing type annotations on functions
    const functionMatches =
      code.match(/function\s+\w+\s*\([^)]*\)\s*\{/g) || [];
    functionMatches.forEach((match) => {
      if (!match.includes(':')) {
        const lineNumber = this.getLineNumber(code, code.indexOf(match));
        result.suggestions.push({
          type: 'readability',
          message: 'Consider adding return type annotation to function',
          line: lineNumber,
          confidence: 0.8,
        });
      }
    });
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  /**
   * Check if a function name is a known built-in, framework function, or follows common patterns
   */
  private isCommonBuiltInOrFrameworkFunction(name: string): boolean {
    const knownFunctions = [
      // Built-ins
      'console',
      'parseInt',
      'parseFloat',
      'isNaN',
      'isFinite',
      'encodeURIComponent',
      'decodeURIComponent',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      // DOM
      'document',
      'window',
      'navigator',
      'location',
      'history',
      // Common methods
      'forEach',
      'map',
      'filter',
      'reduce',
      'find',
      'includes',
      'indexOf',
      // React hooks
      'useState',
      'useEffect',
      'useContext',
      'useReducer',
      'useMemo',
      'useCallback',
    ];

    return (
      knownFunctions.includes(name) ||
      name.startsWith('use') || // React hooks pattern
      name.charAt(0) === name.charAt(0).toUpperCase()
    ); // Constructor pattern
  }

  /**
   * Repair code based on validation results
   */
  async repairCode(
    code: string,
    validationResult: CodeValidationResult,
    context: {
      autoFix?: boolean;
      prioritizeBy?: 'security' | 'performance' | 'syntax';
    } = {}
  ): Promise<{
    repairedCode: string;
    appliedFixes: string[];
    remainingIssues: number;
  }> {
    const { autoFix = false, prioritizeBy = 'security' } = context;
    let repairedCode = code;
    const appliedFixes: string[] = [];

    // Apply fixable errors first
    const fixableErrors = validationResult.errors.filter(
      (error) => error.fixable
    );

    for (const error of fixableErrors) {
      if (error.suggestedFix && error.line) {
        const lines = repairedCode.split('\n');
        if (lines[error.line - 1]) {
          lines[error.line - 1] = error.suggestedFix;
          repairedCode = lines.join('\n');
          appliedFixes.push(`Fixed ${error.type}: ${error.message}`);
        }
      }
    }

    // Apply security fixes if enabled
    if (autoFix) {
      // Apply simple fixes based on patterns
      repairedCode = this.applySecurityFixes(repairedCode, appliedFixes);
      repairedCode = this.applyPerformanceFixes(repairedCode, appliedFixes);
      repairedCode = this.applyModernizationFixes(repairedCode, appliedFixes);
    }

    // Count remaining issues
    const newValidation = await this.validateCode(repairedCode, 'javascript');
    const remainingIssues =
      newValidation.errors.length +
      newValidation.securityIssues.filter(
        (issue) => issue.severity === 'critical'
      ).length;

    return {
      repairedCode,
      appliedFixes,
      remainingIssues,
    };
  }

  /**
   * Apply basic security fixes
   */
  private applySecurityFixes(code: string, appliedFixes: string[]): string {
    let fixed = code;

    // Replace innerHTML with textContent for simple cases
    fixed = fixed.replace(
      /\.innerHTML\s*=\s*(['"][^'"]*['"])/g,
      '.textContent = $1'
    );
    if (fixed !== code) {
      appliedFixes.push(
        'Replaced innerHTML with textContent for simple string assignments'
      );
    }

    return fixed;
  }

  /**
   * Apply basic performance fixes
   */
  private applyPerformanceFixes(code: string, appliedFixes: string[]): string {
    let fixed = code;

    // Replace indexOf !== -1 with includes()
    fixed = fixed.replace(
      /\.indexOf\s*\(\s*([^)]+)\s*\)\s*!==?\s*-1/g,
      '.includes($1)'
    );
    if (fixed !== code) {
      appliedFixes.push('Replaced indexOf !== -1 with includes()');
    }

    return fixed;
  }

  /**
   * Apply modernization fixes
   */
  private applyModernizationFixes(
    code: string,
    appliedFixes: string[]
  ): string {
    let fixed = code;

    // Replace var with const/let (simplified)
    fixed = fixed.replace(/\bvar\s+(\w+)\s*=\s*([^;]+);?/g, 'const $1 = $2;');
    if (fixed !== code) {
      appliedFixes.push('Replaced var with const for immutable variables');
    }

    return fixed;
  }
}

// Export validator instance
export const codeValidator = new AdvancedCodeValidator();

// Validation schemas for API integration
export const codeValidationRequestSchema = z.object({
  code: z.string().min(1).max(100_000),
  language: z.enum(['javascript', 'typescript']),
  enableSecurityChecks: z.boolean().optional().default(true),
  enablePerformanceChecks: z.boolean().optional().default(true),
  enableModernizationSuggestions: z.boolean().optional().default(true),
  strictMode: z.boolean().optional().default(false),
  autoRepair: z.boolean().optional().default(false),
});

export type CodeValidationRequest = z.infer<typeof codeValidationRequestSchema>;
