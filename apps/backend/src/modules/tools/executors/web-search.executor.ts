/**
 * Web Search Executor
 *
 * Searches the web using Brave Search API or Tavily.
 * Requires API key in environment variables.
 */

import type { ToolDefinition, ToolResult } from '@nirex/shared';
import type { ExecutionContext } from '../execution-context.js';
import { BaseToolExecutor } from './base.executor.js';
import { AppError } from '../../../types/index.js';

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export class WebSearchExecutor extends BaseToolExecutor {
  readonly definition: ToolDefinition = {
    name: 'web_search',
    description: 'Search the web and return relevant results. Requires BRAVE_SEARCH_API_KEY or TAVILY_API_KEY environment variable.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5, max: 10)',
        },
      },
      required: ['query'],
    },
  };

  readonly category = 'web' as const;
  readonly requiresApproval = false;
  readonly isDestructive = false;

  async execute(args: Record<string, unknown>, ctx: ExecutionContext): Promise<ToolResult> {
    const query = this.assertString(args.query, 'query');
    const maxResults = args.max_results !== undefined ? Math.min(this.assertNumber(args.max_results, 'max_results'), 10) : 5;

    try {
      // Check if API keys are available
      if (!BRAVE_API_KEY && !TAVILY_API_KEY) {
        throw new AppError(
          'Web search is not configured. Set BRAVE_SEARCH_API_KEY or TAVILY_API_KEY environment variable.',
          503,
          'SERVICE_UNAVAILABLE',
        );
      }

      let results: Array<{ title: string; url: string; snippet: string }>;

      if (BRAVE_API_KEY) {
        results = await this.searchWithBrave(query, maxResults);
      } else if (TAVILY_API_KEY) {
        results = await this.searchWithTavily(query, maxResults);
      } else {
        throw new AppError('No search provider available', 503, 'SERVICE_UNAVAILABLE');
      }

      // Format output
      const lines: string[] = [];
      lines.push(`Query: ${query}`);
      lines.push(`Results: ${results.length}`);
      lines.push('');

      for (let i = 0; i < results.length; i++) {
        const result = results[i]!;
        lines.push(`${i + 1}. ${result.title}`);
        lines.push(`   ${result.url}`);
        lines.push(`   ${result.snippet}`);
        lines.push('');
      }

      const content = lines.join('\n');

      return this.createSuccessResult(
        'web_search_result',
        'web_search',
        content,
        {
          query,
          results: results.length,
          provider: BRAVE_API_KEY ? 'brave' : 'tavily',
        },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      return this.createErrorResult('web_search_error', 'web_search', err as Error, 'SEARCH_ERROR');
    }
  }

  private async searchWithBrave(query: string, maxResults: number): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY!,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description: string;
        }>;
      };
    };

    const results = data.web?.results || [];
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
  }

  private async searchWithTavily(query: string, maxResults: number): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      results?: Array<{
        title: string;
        url: string;
        content: string;
      }>;
    };

    const results = data.results || [];
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }
}
