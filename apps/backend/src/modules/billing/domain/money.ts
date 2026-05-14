import { AppError } from '../../../types/index.js';

export interface MoneyInput {
  amountMinor: number;
  currency: string;
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(normalized)) {
    throw new AppError('Invalid currency code.', 422, 'INVALID_CURRENCY');
  }
  return normalized;
}

function assertInteger(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new AppError('Money amounts must be integers in the smallest currency unit.', 422, 'INVALID_MONEY_AMOUNT');
  }
}

export class Money {
  readonly amountMinor: number;
  readonly currency: string;

  private constructor(amountMinor: number, currency: string) {
    assertInteger(amountMinor);
    this.amountMinor = amountMinor;
    this.currency = normalizeCurrency(currency);
  }

  static of(amountMinor: number, currency: string): Money {
    return new Money(amountMinor, currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  static from(input: MoneyInput): Money {
    return new Money(input.amountMinor, input.currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  multiplyByInteger(multiplier: number): Money {
    if (!Number.isInteger(multiplier)) {
      throw new AppError('Money multiplier must be an integer.', 422, 'INVALID_MONEY_MULTIPLIER');
    }
    return new Money(this.amountMinor * multiplier, this.currency);
  }

  prorate(numerator: number, denominator: number): Money {
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
      throw new AppError('Invalid proration ratio.', 422, 'INVALID_PRORATION_RATIO');
    }
    return new Money(Math.trunc((this.amountMinor * numerator) / denominator), this.currency);
  }

  max(other: Money): Money {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor ? this : other;
  }

  toJSON(): MoneyInput {
    return {
      amountMinor: this.amountMinor,
      currency: this.currency,
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new AppError('Currency mismatch.', 422, 'CURRENCY_MISMATCH');
    }
  }
}

export function assertMoneyInput(input: MoneyInput): MoneyInput {
  return Money.from(input).toJSON();
}
