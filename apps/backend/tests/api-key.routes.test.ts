import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('api-key routes', () => {
  it('requires JWT authentication for API key management endpoints', async () => {
    const response = await request(app).get('/api/v1/api-keys');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });

  it('requires API key for self-identification endpoint', async () => {
    const response = await request(app).get('/api/v1/api-keys/self');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });
});
