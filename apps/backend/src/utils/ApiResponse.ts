import type { StandardResponse } from '@nirex/shared';

export class ApiResponse<T = unknown> implements StandardResponse<T> {
  public readonly success: boolean;
  public readonly message: string;
  public readonly data: T | null;
  public readonly statusCode: number;

  constructor(statusCode: number, data: T | null, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}
