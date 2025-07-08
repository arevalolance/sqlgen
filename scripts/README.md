# SqlGen Scripts - Usage Examples

This directory contains demonstration scripts that showcase the capabilities of the SqlGen text-to-SQL library using your actual local database.

## Prerequisites

Before running these scripts, ensure you have:

1. **Node.js 18+** installed
2. **PostgreSQL database** running and accessible
3. **Qdrant vector database** running (optional, can use Docker)
4. **OpenAI API key** for text-to-SQL generation

## Quick Start

### 1. Install Dependencies

```bash
# Install script dependencies
cd scripts
npm install

# Or use pnpm from the root
pnpm install
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp ../.env.example ../.env
```

Edit the `.env` file with your actual configuration:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
# OR use individual variables:
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=your_database_name
# DATABASE_USER=your_username
# DATABASE_PASSWORD=your_password

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=sql_schemas
```

### 3. Start Qdrant (if not already running)

Using Docker:
```bash
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

### 4. Run the Demo Scripts

```bash
# Complete automated demo
npm run demo

# Or run scripts individually
npm run setup     # Train on your database schema
npm run basic     # Basic query examples
npm run advanced  # Complex query examples
npm run interactive # Interactive query session
```

## Script Details

### 1. Setup and Training (`01-setup-and-train.ts`)

**Purpose**: Connects to your database, discovers the schema, and trains vector embeddings.

**What it does**:
- Discovers all tables and relationships in your database
- Generates vector embeddings for schema information
- Stores embeddings in Qdrant for semantic search
- Tests the setup with a simple query

**Usage**:
```bash
npm run setup
# or
pnpm tsx scripts/01-setup-and-train.ts
```

**Expected Output**:
```
🚀 SqlGen Setup and Training Script
===================================

✅ Configuration loaded successfully
📊 Starting database schema discovery and training...

🔍 Discovering database schema...
✅ Database schema discovery completed
🧠 Training vector embeddings...
✅ Training completed successfully!

📈 Training Results:
==================
✓ Database connection: localhost:5432/mydb
✓ Vector database: http://localhost:6333
✓ Collection: sql_schemas
✓ AI Model: gpt-4
✓ Embedding Model: text-embedding-3-small

🧪 Testing setup with a simple query...
Question: "Show me all tables in the database"
Processing...
✅ Test query successful!
```

### 2. Basic Queries (`02-basic-queries.ts`)

**Purpose**: Demonstrates simple, common database queries.

**What it does**:
- Runs 10 basic queries like "How many records are in each table?"
- Shows confidence scores and execution times
- Displays sample results from your actual database

**Usage**:
```bash
npm run basic
# or
pnpm tsx scripts/02-basic-queries.ts
```

**Expected Output**:
```
🔍 SqlGen Basic Queries Demo
============================

1. 🔍 Query: "How many records are in each table?"
   ✅ Generated SQL: SELECT schemaname, tablename, n_tup_ins FROM pg_stat_user_tables;
   📊 Confidence: 85.2%
   ⚡ AI Response Time: 1250ms
   📋 Results: 8 rows
   🎯 Confidence Level: 🟢 High

📊 Summary
==========
✅ Successful queries: 9/10
❌ Failed queries: 1
⏱️  Average response time: 1387ms
🎯 Success rate: 90.0%
```

### 3. Advanced Queries (`03-advanced-queries.ts`)

**Purpose**: Tests complex SQL generation with JOINs, subqueries, and analytics.

**What it does**:
- Generates complex SQL with multiple tables, JOINs, and aggregations
- Analyzes SQL complexity and features
- Shows confidence analysis for complex queries

**Usage**:
```bash
npm run advanced
# or
pnpm tsx scripts/03-advanced-queries.ts
```

**Expected Output**:
```
🧠 SqlGen Advanced Queries Demo
===============================

1. 🧠 Advanced Query: "Show me the top 10 most frequently used values in each table"
   ✅ Generated SQL: SELECT 'users' as table_name, email, COUNT(*) as frequency FROM users GROUP BY email ORDER BY frequency DESC LIMIT 10;
   📊 Confidence: 78.5%
   🧮 SQL Complexity: Medium (5/10)
   🔍 SQL Features: GROUP BY, ORDER BY, Multiple tables
   🎯 Confidence Analysis: Good (Medium confidence on complex query)

📊 Advanced Query Analysis
==========================
✅ Successful queries: 12/15
🧮 Average SQL complexity: 6.2/10
🟢 High confidence (≥80%): 7
🟡 Medium confidence (60-79%): 4
🔴 Low confidence (<60%): 1
```

### 4. Interactive Demo (`04-interactive-demo.ts`)

**Purpose**: Provides an interactive session where you can ask questions in real-time.

**What it does**:
- Interactive command-line interface
- Real-time query processing
- Session statistics and history
- Query explanation and validation

**Usage**:
```bash
npm run interactive
# or
pnpm tsx scripts/04-interactive-demo.ts
```

**Available Commands**:
- `help` - Show available commands
- `stats` - Show session statistics
- `history` - Show query history
- `explain` - Explain the last SQL query
- `validate` - Validate the last SQL query
- `clear` - Clear the screen
- `quit` / `exit` - Exit the demo

**Example Session**:
```
🎮 SqlGen Interactive Demo
==========================

🤔 Ask me anything about your database: Show me all users created today

🔍 Processing: "Show me all users created today"
⏳ Generating SQL...

✅ Query Results:
==================
🔧 Generated SQL: SELECT * FROM users WHERE DATE(created_at) = CURRENT_DATE;
📊 Confidence: 92.3%
⚡ Processing Time: 1150ms
🟢 Confidence Level: High - Very likely correct
📋 Results: 3 rows

🤔 Ask me anything about your database: stats

📊 Session Statistics:
======================
⏱️  Session Duration: 2m 15s
📝 Total Queries: 5
✅ Successful: 4
❌ Failed: 1
🎯 Success Rate: 80.0%
📈 Average Confidence: 84.2%
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *required* | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4` | OpenAI model to use |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for vector search |
| `DATABASE_URL` | - | PostgreSQL connection URL |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION_NAME` | `sql_schemas` | Collection name for embeddings |
| `PIPELINE_MIN_CONFIDENCE` | `0.7` | Minimum confidence threshold |
| `PIPELINE_DRY_RUN` | `false` | Run in dry-run mode (no DB execution) |
| `LOG_LEVEL` | `info` | Logging level |

### Database Connection

You can specify your database connection in two ways:

1. **Connection URL** (recommended):
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```

2. **Individual parameters**:
   ```env
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=your_database_name
   DATABASE_USER=your_username
   DATABASE_PASSWORD=your_password
   DATABASE_SSL=false
   ```

## Troubleshooting

### Common Issues

1. **"Missing required environment variable: OPENAI_API_KEY"**
   - Make sure you've set your OpenAI API key in the `.env` file
   - Get your API key from [OpenAI's website](https://platform.openai.com/api-keys)

2. **Database connection errors**
   - Verify your PostgreSQL server is running
   - Check your database connection parameters
   - Ensure the database exists and is accessible

3. **Qdrant connection errors**
   - Make sure Qdrant is running on the specified port
   - Check if the URL is correct (default: `http://localhost:6333`)
   - Try running Qdrant with Docker: `docker run -p 6333:6333 qdrant/qdrant`

4. **"Make sure to run the setup script first"**
   - You must run the setup script before other demos
   - The setup script trains the AI on your database schema

5. **Low confidence scores**
   - Try rephrasing your questions more clearly
   - Use specific table and column names when possible
   - Complex queries may naturally have lower confidence

### Performance Tips

1. **Optimize your queries**:
   - Be specific about what you want
   - Use clear, unambiguous language
   - Reference actual table/column names when known

2. **Database performance**:
   - Ensure your database has proper indexes
   - Complex queries on large tables may take time
   - Consider using `LIMIT` for large result sets

3. **AI model selection**:
   - `gpt-4` provides better accuracy but is slower
   - `gpt-3.5-turbo` is faster but may have lower accuracy
   - Adjust based on your needs and budget

## Integration Example

Here's how you might integrate SqlGen into your own application:

```typescript
import { createSqlGen } from '../src/index.js'
import { setupEnvironment } from './config.js'

// Initialize SqlGen
const config = setupEnvironment()
const sqlGen = createSqlGen(config)

// Ask a question
const result = await Effect.runPromise(sqlGen.ask("How many users signed up last month?"))

console.log('SQL:', result.sql)
console.log('Results:', result.results)
console.log('Confidence:', result.confidence)
```

## Next Steps

1. **Customize the queries** in the demo scripts for your specific use case
2. **Integrate SqlGen** into your application using the patterns shown
3. **Train on additional schemas** or DDL files using the training methods
4. **Experiment with different models** and confidence thresholds
5. **Build your own interactive tools** using the SqlGen API

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the main project documentation
3. Ensure all prerequisites are met
4. Check the console output for detailed error messages

## License

These scripts are provided as examples and follow the same license as the main SqlGen project.