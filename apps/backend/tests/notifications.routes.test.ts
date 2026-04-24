import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('notifications routes', () => {
  it('requires authentication for list endpoint', async () => {
    const response = await request(app).get('/api/notifications');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      code: 'UNAUTHENTICATED',
    });
  });
});
