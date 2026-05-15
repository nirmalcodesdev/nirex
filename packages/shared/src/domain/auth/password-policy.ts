/**
 * Production password policy helpers.
 *
 * The policy follows modern verifier guidance:
 * - prefer length over character-class composition rules
 * - accept passphrases, spaces, and Unicode
 * - reject common, compromised-style, contextual, repeated, and sequential secrets
 * - normalize before hashing/verifying so equivalent Unicode is treated consistently
 */

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  recommendedLength: 20,
} as const;

export type PasswordIssueCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'blank'
  | 'unsupported_character'
  | 'common_password'
  | 'repeated_pattern'
  | 'sequential_pattern'
  | 'contains_context';

export interface PasswordValidationIssue {
  code: PasswordIssueCode;
  message: string;
}

export interface PasswordValidationContext {
  email?: string | undefined;
  fullName?: string | undefined;
  appName?: string | undefined;
  additionalBlocklistTerms?: readonly string[] | undefined;
}

export interface PasswordRequirementStatus {
  code: 'length' | 'not_common' | 'not_contextual' | 'not_patterned' | 'supported_characters';
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Enter a password' | 'Too short' | 'Weak' | 'Good' | 'Strong' | 'Excellent';
  percent: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  normalizedPassword: string;
  length: number;
  issues: PasswordValidationIssue[];
  requirements: PasswordRequirementStatus[];
  strength: PasswordStrength;
}

const DEFAULT_CONTEXT_TERMS = ['nirex', 'nirex code', 'nirexcode'];

const COMMON_WEAK_TERMS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  'abc123',
  'admin',
  'administrator',
  'changeme',
  'default',
  'dragon',
  'football',
  'iloveyou',
  'letmein',
  'login',
  'master',
  'monkey',
  'password',
  'passw0rd',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'secret',
  'superman',
  'trustnoone',
  'user',
  'welcome',
  'welcome1',
  'correcthorsebatterystaple',
]);

const KEYBOARD_AND_SEQUENCE_STRINGS = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'qwertyuiopasdfghjklzxcvbnm',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

const LEET_SUBSTITUTIONS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '+': 't',
};

const UNSUPPORTED_CHARACTERS = /[\p{Cc}\p{Cf}\p{Cs}]/u;

export function normalizePassword(password: string): string {
  return password.normalize('NFKC');
}

export function getPasswordLength(password: string): number {
  return Array.from(normalizePassword(password)).length;
}

export function validatePasswordPolicy(
  password: string,
  context: PasswordValidationContext = {},
): PasswordValidationResult {
  const normalizedPassword = normalizePassword(password);
  const length = Array.from(normalizedPassword).length;
  const issues = collectPasswordIssues(normalizedPassword, context);
  const requirements = buildRequirementStatuses(normalizedPassword, context, issues);
  const strength = getPasswordStrength(normalizedPassword, context, issues);

  return {
    valid: issues.length === 0,
    normalizedPassword,
    length,
    issues,
    requirements,
    strength,
  };
}

export function getPasswordRequirementStatus(
  password: string,
  context: PasswordValidationContext = {},
): PasswordRequirementStatus[] {
  return validatePasswordPolicy(password, context).requirements;
}

export function getPasswordStrength(
  password: string,
  context: PasswordValidationContext = {},
  precomputedIssues?: readonly PasswordValidationIssue[],
): PasswordStrength {
  const normalized = normalizePassword(password);
  const length = Array.from(normalized).length;

  if (length === 0) {
    return { score: 0, label: 'Enter a password', percent: 0 };
  }

  if (length < PASSWORD_POLICY.minLength) {
    return { score: 1, label: 'Too short', percent: 25 };
  }

  const issues = precomputedIssues ?? collectPasswordIssues(normalized, context);
  if (issues.some((issue) => issue.code !== 'too_short' && issue.code !== 'too_long')) {
    return { score: 1, label: 'Weak', percent: 25 };
  }

  let score: PasswordStrength['score'] = 2;
  if (length >= PASSWORD_POLICY.recommendedLength) score = 3;
  if (length >= 28) score = 4;

  const distinctCharacterClasses = [
    /\p{Ll}/u.test(normalized),
    /\p{Lu}/u.test(normalized),
    /\p{N}/u.test(normalized),
    /[^\p{L}\p{N}\s]/u.test(normalized),
    /\s/u.test(normalized),
  ].filter(Boolean).length;

  if (length >= PASSWORD_POLICY.recommendedLength && distinctCharacterClasses >= 3) {
    score = Math.max(score, 4) as PasswordStrength['score'];
  }

  const labels: Record<PasswordStrength['score'], PasswordStrength['label']> = {
    0: 'Enter a password',
    1: 'Weak',
    2: 'Good',
    3: 'Strong',
    4: 'Excellent',
  };

  return {
    score,
    label: labels[score],
    percent: score * 25,
  };
}

export function getPrimaryPasswordPolicyMessage(
  password: string,
  context: PasswordValidationContext = {},
): string | null {
  const result = validatePasswordPolicy(password, context);
  return result.issues[0]?.message ?? null;
}

function collectPasswordIssues(
  normalizedPassword: string,
  context: PasswordValidationContext,
): PasswordValidationIssue[] {
  if (normalizedPassword.length === 0) {
    return [{ code: 'required', message: 'Password is required.' }];
  }

  const length = Array.from(normalizedPassword).length;
  const issues: PasswordValidationIssue[] = [];

  if (length < PASSWORD_POLICY.minLength) {
    issues.push({
      code: 'too_short',
      message: `Password must be at least ${PASSWORD_POLICY.minLength} characters.`,
    });
  }

  if (length > PASSWORD_POLICY.maxLength) {
    issues.push({
      code: 'too_long',
      message: `Password must be at most ${PASSWORD_POLICY.maxLength} characters.`,
    });
  }

  if (normalizedPassword.trim().length === 0) {
    issues.push({
      code: 'blank',
      message: 'Password cannot be only spaces.',
    });
  }

  if (UNSUPPORTED_CHARACTERS.test(normalizedPassword)) {
    issues.push({
      code: 'unsupported_character',
      message: 'Password cannot contain control or invisible characters.',
    });
  }

  if (isCommonPasswordVariant(normalizedPassword)) {
    issues.push({
      code: 'common_password',
      message: 'Choose a less common password. This one is too easy to guess.',
    });
  }

  if (hasRepeatedPattern(normalizedPassword)) {
    issues.push({
      code: 'repeated_pattern',
      message: 'Avoid repeated words or character patterns.',
    });
  }

  if (hasSequentialPattern(normalizedPassword)) {
    issues.push({
      code: 'sequential_pattern',
      message: 'Avoid keyboard, alphabetic, or numeric sequences.',
    });
  }

  if (containsContextTerm(normalizedPassword, context)) {
    issues.push({
      code: 'contains_context',
      message: 'Do not include your name, email, or Nirex in your password.',
    });
  }

  return issues;
}

function buildRequirementStatuses(
  normalizedPassword: string,
  context: PasswordValidationContext,
  issues: readonly PasswordValidationIssue[],
): PasswordRequirementStatus[] {
  const length = Array.from(normalizedPassword).length;
  const issueCodes = new Set(issues.map((issue) => issue.code));
  const hasPassword = length > 0;

  return [
    {
      code: 'length',
      label: `At least ${PASSWORD_POLICY.minLength} characters`,
      met: length >= PASSWORD_POLICY.minLength && length <= PASSWORD_POLICY.maxLength,
    },
    {
      code: 'not_common',
      label: 'Not common or compromised-style',
      met: hasPassword && !issueCodes.has('common_password'),
    },
    {
      code: 'not_patterned',
      label: 'No repeated or sequential patterns',
      met: hasPassword && !issueCodes.has('repeated_pattern') && !issueCodes.has('sequential_pattern'),
    },
    {
      code: 'not_contextual',
      label: hasContextSignals(context) ? 'No name, email, or Nirex terms' : 'No Nirex or app-specific terms',
      met: hasPassword && !issueCodes.has('contains_context'),
    },
    {
      code: 'supported_characters',
      label: 'No control or invisible characters',
      met: hasPassword && !issueCodes.has('unsupported_character') && !issueCodes.has('blank'),
    },
  ];
}

function isCommonPasswordVariant(password: string): boolean {
  const candidates = getComparableCandidates(password);

  for (const candidate of candidates) {
    if (COMMON_WEAK_TERMS.has(candidate)) return true;

    const repeatedBase = getRepeatedBase(candidate);
    if (repeatedBase && COMMON_WEAK_TERMS.has(repeatedBase)) return true;
  }

  return false;
}

function hasRepeatedPattern(password: string): boolean {
  const comparable = toAlphanumericLower(password);
  const chars = Array.from(comparable || password.toLowerCase());
  if (chars.length < PASSWORD_POLICY.minLength) return false;

  if (new Set(chars).size <= 2) return true;
  return getRepeatedBase(chars.join('')) !== null;
}

function hasSequentialPattern(password: string): boolean {
  const comparable = toAlphanumericLower(password);
  if (comparable.length < 6) return false;

  return KEYBOARD_AND_SEQUENCE_STRINGS.some((sequence) => {
    const sequences = [sequence, reverseString(sequence)];
    return sequences.some((candidate) => containsSequentialRun(comparable, candidate, 6));
  });
}

function containsContextTerm(password: string, context: PasswordValidationContext): boolean {
  const comparable = toLeetComparable(password);
  if (comparable.length === 0) return false;

  return deriveContextTerms(context).some((term) => term.length >= 4 && comparable.includes(term));
}

function hasContextSignals(context: PasswordValidationContext): boolean {
  return Boolean(context.email || context.fullName || context.appName || context.additionalBlocklistTerms?.length);
}

function deriveContextTerms(context: PasswordValidationContext): string[] {
  const terms = new Set(DEFAULT_CONTEXT_TERMS);

  addTermParts(terms, context.appName);
  addTermParts(terms, context.email);
  addTermParts(terms, context.email?.split('@')[0]);
  addTermParts(terms, context.fullName);

  for (const term of context.additionalBlocklistTerms ?? []) {
    addTermParts(terms, term);
  }

  return Array.from(terms)
    .map(toLeetComparable)
    .filter((term) => term.length >= 4);
}

function addTermParts(terms: Set<string>, value: string | undefined): void {
  if (!value) return;

  const normalized = normalizePassword(value).toLowerCase();
  terms.add(normalized);
  terms.add(normalized.replace(/[^a-z0-9]/g, ''));

  for (const part of normalized.split(/[^a-z0-9]+/g)) {
    if (part.length >= 4) terms.add(part);
  }
}

function getComparableCandidates(password: string): Set<string> {
  const alphanumeric = toAlphanumericLower(password);
  const strippedAlphanumeric = stripCommonEdges(alphanumeric);
  const leetComparable = toLeetComparable(password);
  const strippedLeetComparable = stripCommonEdges(leetComparable);

  return new Set([
    alphanumeric,
    strippedAlphanumeric,
    leetComparable,
    strippedLeetComparable,
    toLeetComparable(strippedAlphanumeric),
  ].filter((candidate) => candidate.length > 0));
}

function toAlphanumericLower(value: string): string {
  return normalizePassword(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function toLeetComparable(value: string): string {
  const normalized = normalizePassword(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

  let mapped = '';
  for (const char of Array.from(normalized)) {
    mapped += LEET_SUBSTITUTIONS[char] ?? char;
  }

  return mapped.replace(/[^a-z0-9]/g, '');
}

function stripCommonEdges(value: string): string {
  let result = value;
  let previous = '';

  while (result !== previous) {
    previous = result;
    result = result
      .replace(/^(?:my|the|new|old|secure|super)+/, '')
      .replace(/(?:19\d{2}|20\d{2}|\d{1,8})+$/, '');
  }

  return result;
}

function getRepeatedBase(value: string): string | null {
  if (value.length < 2) return null;

  for (let size = 1; size <= Math.min(8, Math.floor(value.length / 2)); size += 1) {
    if (value.length % size !== 0) continue;

    const base = value.slice(0, size);
    const repetitions = value.length / size;
    if (repetitions >= 2 && base.repeat(repetitions) === value) {
      return base;
    }
  }

  return null;
}

function containsSequentialRun(value: string, sequence: string, minRunLength: number): boolean {
  for (let index = 0; index <= sequence.length - minRunLength; index += 1) {
    const run = sequence.slice(index, index + minRunLength);
    if (value.includes(run)) return true;
  }

  return false;
}

function reverseString(value: string): string {
  return Array.from(value).reverse().join('');
}
