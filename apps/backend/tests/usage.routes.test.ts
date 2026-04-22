import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('usage routes', () => {
  it('requires authentication for overview endpoint', async () => {
    const response = await request(app).get('/api/usage/overview');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });
});
