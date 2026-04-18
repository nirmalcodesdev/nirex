const { faker } = require('@faker-js/faker');

// Track created users for login attempts
const testUsers = [];

module.exports = {
  generateRandomUser: (context, events, done) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    context.vars.email = `loadtest_${timestamp}_${random}@example.com`;
    context.vars.fullName = faker.person.fullName();
    context.vars.password = 'SecurePass123!';

    // Store for potential login
    testUsers.push({
      email: context.vars.email,
      password: context.vars.password,
    });

    return done();
  },

  getTestCredentials: (context, events, done) => {
    // Use known test credentials or generated ones
    if (testUsers.length > 0 && Math.random() > 0.3) {
      // 70% chance to use existing user
      const user = testUsers[Math.floor(Math.random() * testUsers.length)];
      context.vars.email = user.email;
      context.vars.password = user.password;
    } else {
      // 30% chance to use non-existent or random
      context.vars.email = `nonexistent_${Date.now()}@example.com`;
      context.vars.password = 'WrongPassword123!';
    }

    return done();
  },

  generateSessionData: (context, events, done) => {
    context.vars.deviceInfo = faker.helpers.arrayElement([
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.0',
      'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.0',
    ]);

    context.vars.ipAddress = faker.internet.ip();

    return done();
  },
};
