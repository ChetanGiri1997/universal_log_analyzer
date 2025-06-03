// MongoDB initialization script
db = db.getSiblingDB('log_analyzer');

// Create collections
db.createCollection('logs');
db.createCollection('templates');

// Create indexes for better query performance
db.logs.createIndex({ "timestamp": -1 });
db.logs.createIndex({ "level": 1 });
db.logs.createIndex({ "source": 1 });
db.logs.createIndex({ "template_id": 1 });
db.logs.createIndex({ "message": "text" });

db.templates.createIndex({ "template_id": 1 }, { unique: true });
db.templates.createIndex({ "count": -1 });
db.templates.createIndex({ "last_seen": -1 });

print('Database initialized with indexes');