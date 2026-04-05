export const APP_NAME = 'Nirex';
export const APP_NAME_SUFFIX = 'Code';

export const API_VERSION = 'v1';

export interface StandardResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  statusCode: number;
}

export * from './frontend/types/footer.types.js'
export * from './frontend/types/navlink.types.js'
export * from "./frontend/lib/utils.js"