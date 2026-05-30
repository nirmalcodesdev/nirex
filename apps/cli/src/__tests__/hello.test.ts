import { describe, it, expect } from 'vitest';
import { helloCommand } from '../commands/hello.js';

describe('Hello Command', () => {
  it('outputs greeting with default name', () => {
    const consoleSpy = { output: '' as string };
    const originalLog = console.log;

    console.log = (...args: unknown[]) => {
      consoleSpy.output += args.join(' ') + '\n';
    };

    try {
      helloCommand('World');
      expect(consoleSpy.output).toContain('Hello, World!');
      expect(consoleSpy.output).toContain('Nirex');
    } finally {
      console.log = originalLog;
    }
  });

  it('outputs greeting with custom name', () => {
    const consoleSpy = { output: '' as string };
    const originalLog = console.log;

    console.log = (...args: unknown[]) => {
      consoleSpy.output += args.join(' ') + '\n';
    };

    try {
      helloCommand('Alice');
      expect(consoleSpy.output).toContain('Hello, Alice!');
    } finally {
      console.log = originalLog;
    }
  });
});
