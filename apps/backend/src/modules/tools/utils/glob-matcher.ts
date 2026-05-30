/**
 * Glob Matcher
 *
 * Native glob pattern matching implementation supporting *, **, ?, and basic patterns.
 * No external dependencies required.
 */

import path from 'path';

/**
 * Convert a glob pattern to a RegExp
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = '^';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    if (!char) break; // Safety check for undefined

    if (char === '*') {
      // Check for **
      if (pattern[i + 1] === '*') {
        // ** matches any number of directories
        if (pattern[i + 2] === '/' || pattern[i + 2] === path.sep || i + 2 === pattern.length) {
          regexStr += '.*';
          i += 2;
          if (pattern[i] === '/' || pattern[i] === path.sep) {
            i++;
          }
          continue;
        }
      }
      // * matches anything except path separator
      regexStr += `[^${path.sep === '\\' ? '\\\\' : path.sep}]*`;
    } else if (char === '?') {
      // ? matches any single character except path separator
      regexStr += `[^${path.sep === '\\' ? '\\\\' : path.sep}]`;
    } else if (char === '[') {
      // Character class
      const closeIdx = pattern.indexOf(']', i);
      if (closeIdx > i) {
        const charClass = pattern.slice(i + 1, closeIdx);
        regexStr += `[${charClass.replace(/\\/g, '\\\\')}]`;
        i = closeIdx;
      } else {
        regexStr += '\\[';
      }
    } else if ('.+^${}()|\\'.includes(char)) {
      // Escape regex special characters
      regexStr += '\\' + char;
    } else {
      regexStr += char;
    }

    i++;
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

/**
 * Test if a path matches a glob pattern
 */
export function matchGlob(filePath: string, pattern: string): boolean {
  // Normalize paths for cross-platform compatibility
  const normalizedPath = filePath.split(path.sep).join('/');
  const normalizedPattern = pattern.split(path.sep).join('/');

  const regex = globToRegex(normalizedPattern);
  return regex.test(normalizedPath);
}

/**
 * Filter an array of paths by glob pattern
 */
export function filterByGlob(filePaths: string[], pattern: string): string[] {
  return filePaths.filter((p) => matchGlob(p, pattern));
}

/**
 * Test if a path matches any of multiple glob patterns
 */
export function matchAnyGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlob(filePath, pattern));
}
