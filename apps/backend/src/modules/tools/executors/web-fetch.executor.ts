/**
 * Web Fetch Executor
 *
 * Fetches URL content and converts to markdown.
 */

import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { AppError } from '../../../types/index.js';

const MAX_CONTENT_SIZE = 500000; // 500KB
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

export class WebFetchExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'web_fetch',
    description: 'Fetch content from a URL and convert to markdown. Supports HTML pages. Domain filtering and size limits apply.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch',
        },
        timeout_ms: {
          type: 'number',
          description: 'Request timeout in milliseconds (default: 10000)',
        },
      },
      required: ['url'],
    },
  };

  readonly category = 'web' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const url = this.assertString(args.url, 'url');
    const timeoutMs = args.timeout_ms !== undefined ? this.assertNumber(args.timeout_ms, 'timeout_ms') : DEFAULT_TIMEOUT_MS;

    try {
      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch (err) {
        throw new AppError('Invalid URL format', 400, 'INVALID_URL');
      }

      // Only allow http/https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new AppError('Only HTTP and HTTPS protocols are allowed', 400, 'INVALID_PROTOCOL');
      }

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Nirex-Bot/1.0',
          },
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (!response.ok) {
        throw new AppError(`HTTP ${response.status}: ${response.statusText}`, 400, 'HTTP_ERROR');
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new AppError(`Unsupported content type: ${contentType}`, 400, 'UNSUPPORTED_CONTENT_TYPE');
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
        throw new AppError(`Content too large: ${contentLength} bytes`, 400, 'CONTENT_TOO_LARGE');
      }

      // Read content
      const html = await response.text();

      if (html.length > MAX_CONTENT_SIZE) {
        throw new AppError(`Content too large: ${html.length} bytes`, 400, 'CONTENT_TOO_LARGE');
      }

      // Convert to markdown
      const markdown = this.htmlToMarkdown(html);

      return this.createSuccessResult(
        'web_fetch_result',
        'web_fetch',
        markdown,
        {
          url,
          status: response.status,
          content_type: contentType,
          size: html.length,
        },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      const error = err as Error;
      if (error.name === 'AbortError') {
        return this.createErrorResult('web_fetch_error', 'web_fetch', 'Request timed out', 'TIMEOUT');
      }
      return this.createErrorResult('web_fetch_error', 'web_fetch', error, 'FETCH_ERROR');
    }
  }

  private htmlToMarkdown(html: string): string {
    // Simple HTML to Markdown conversion
    let text = html;

    // Remove script and style tags
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Convert headings
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
    text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n');
    text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n');

    // Convert links
    text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Convert lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<ul[^>]*>/gi, '\n');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<ol[^>]*>/gi, '\n');
    text = text.replace(/<\/ol>/gi, '\n');

    // Convert code blocks
    text = text.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n');
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Convert paragraphs and breaks
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Convert bold and italic
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Clean up whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }
}
