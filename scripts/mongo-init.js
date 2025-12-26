// ====================================
// AVENLO CORE - MONGODB INITIALIZATION
// ====================================

// Switch to the avenlo_core database
db = db.getSiblingDB('avenlo_core');

// Create collections with validators
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['discordId', 'username'],
      properties: {
        discordId: {
          bsonType: 'string',
          description: 'Discord user ID - required'
        },
        username: {
          bsonType: 'string',
          description: 'Username - required'
        },
        credits: {
          bsonType: 'int',
          minimum: 0,
          description: 'User credits balance'
        }
      }
    }
  }
});

db.createCollection('projects', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'slug', 'clientId', 'guildId'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Project name - required'
        },
        slug: {
          bsonType: 'string',
          description: 'URL-friendly slug - required'
        },
        status: {
          enum: ['discovery', 'scoping', 'quoted', 'accepted', 'in-progress', 'review', 'completed', 'paused', 'cancelled'],
          description: 'Project status'
        }
      }
    }
  }
});

db.createCollection('transactions');
db.createCollection('interview_sessions');
db.createCollection('dashboards');

// Create indexes
db.users.createIndex({ discordId: 1 }, { unique: true });
db.users.createIndex({ credits: -1 });
db.users.createIndex({ githubUsername: 1 }, { sparse: true });

db.projects.createIndex({ slug: 1 }, { unique: true });
db.projects.createIndex({ clientId: 1, status: 1 });
db.projects.createIndex({ guildId: 1, status: 1 });

db.transactions.createIndex({ discordId: 1, createdAt: -1 });
db.transactions.createIndex({ transactionId: 1 }, { unique: true });

db.interview_sessions.createIndex({ sessionId: 1 }, { unique: true });
db.interview_sessions.createIndex({ userId: 1, status: 1 });
db.interview_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.dashboards.createIndex({ messageId: 1 }, { unique: true });
db.dashboards.createIndex({ 'repository.owner': 1, 'repository.name': 1 });

print('Avenlo Core database initialized successfully!');
