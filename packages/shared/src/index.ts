export const APP_NAME = 'NirexCode';

export const API_VERSION = 'v1';

export interface StandardResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  statusCode: number;
}
