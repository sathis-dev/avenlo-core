const { MongoMemoryServer } = require('mongodb-memory-server');
const { RedisMemoryServer } = require('redis-memory-server');

async function startServices() {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'avenlo_core',
    }
  });

  const uri = mongod.getUri();
  console.log(`✅ MongoDB Memory Server running at ${uri}`);

  const redisServer = await RedisMemoryServer.create({
    instance: {
      port: 6379
    }
  });

  const redisHost = await redisServer.getHost();
  const redisPort = await redisServer.getPort();
  console.log(`✅ Redis Memory Server running at redis://${redisHost}:${redisPort}`);
  
  // Keep the process alive
  setInterval(() => {}, 1000);
}

startServices().catch(console.error);
