import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { config } from './config';
import { logAPIError, logPerformance } from './logger';

// Database connection singleton
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool | null = null;
  private connectionCount = 0;
  private readonly maxConnectionAttempts = 3;
  private readonly connectionTimeout = 5000; // 5 seconds

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private createPoolConfig(): PoolConfig {
    const databaseUrl = config.getDatabaseUrl();

    // Parse connection string or use individual config
    const poolConfig: PoolConfig = {
      connectionString: databaseUrl,
      // Connection pool configuration
      max: 20, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients in the pool
      idleTimeoutMillis: 30_000, // How long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: this.connectionTimeout,

      // SSL configuration for production
      ssl: config.isProduction()
        ? {
            rejectUnauthorized: false, // For Heroku/Vercel Postgres
          }
        : false,

      // Application name for debugging
      application_name: 'symlog-web',

      // Statement timeout to prevent long-running queries
      statement_timeout: 30_000, // 30 seconds

      // Query timeout
      query_timeout: 30_000,
    };

    return poolConfig;
  }

  async initialize(): Promise<void> {
    if (this.pool) {
      return; // Already initialized
    }

    const startTime = Date.now();

    try {
      const poolConfig = this.createPoolConfig();
      this.pool = new Pool(poolConfig);

      // Set up event listeners
      this.pool.on('connect', (client) => {
        this.connectionCount++;
        console.log(
          `Database client connected. Total connections: ${this.connectionCount}`
        );
      });

      this.pool.on('acquire', (client) => {
        // console.log('Client acquired from pool')
      });

      this.pool.on('error', (err, client) => {
        console.error('Unexpected error on idle database client', err);
        logAPIError('db-pool-error', err);
      });

      this.pool.on('remove', (client) => {
        this.connectionCount--;
        console.log(
          `Database client removed. Total connections: ${this.connectionCount}`
        );
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      const duration = Date.now() - startTime;
      logPerformance('db_pool_initialization', duration);
      console.log(`Database pool initialized successfully in ${duration}ms`);
    } catch (error) {
      logAPIError('db-initialization', error);
      throw new Error(
        `Failed to initialize database connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const client = await this.pool!.connect();

      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logPerformance('db_client_acquisition_slow', duration);
      }

      return client;
    } catch (error) {
      logAPIError('db-get-client', error);
      throw new Error(
        `Failed to get database client: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async query<T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const client = await this.getClient();
    const startTime = Date.now();

    try {
      const result = await client.query<T>(text, params);

      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logPerformance('db_query_slow', duration, {
          query: text.substring(0, 100),
          rowCount: result.rowCount,
        });
      }

      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      };
    } catch (error) {
      logAPIError('db-query', error, {
        query: text.substring(0, 100),
        params: params?.length,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    poolSize: number;
    idleCount: number;
    waitingCount: number;
  }> {
    if (!this.pool) {
      return {
        healthy: false,
        poolSize: 0,
        idleCount: 0,
        waitingCount: 0,
      };
    }

    try {
      const result = await this.query('SELECT NOW() as current_time');

      return {
        healthy: true,
        poolSize: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      };
    } catch (error) {
      return {
        healthy: false,
        poolSize: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      };
    }
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connectionCount = 0;
      console.log('Database pool shut down successfully');
    }
  }

  // Helper methods for common queries
  async findOne<T extends Record<string, any>>(
    table: string,
    conditions: Record<string, any>
  ): Promise<T | null> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');

    const query = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;
    const result = await this.query<T>(query, values);

    return result.rows[0] || null;
  }

  async findMany<T extends Record<string, any>>(
    table: string,
    conditions: Record<string, any> = {},
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
    } = {}
  ): Promise<T[]> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    let query = `SELECT * FROM ${table}`;

    if (keys.length > 0) {
      const whereClause = keys
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = await this.query<T>(query, values);
    return result.rows;
  }

  async insert<T extends Record<string, any>>(
    table: string,
    data: Record<string, any>
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.query<T>(query, values);

    return result.rows[0];
  }

  async update<T extends Record<string, any>>(
    table: string,
    conditions: Record<string, any>,
    data: Record<string, any>
  ): Promise<T[]> {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);

    const setClause = dataKeys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const whereClause = conditionKeys
      .map((key, index) => `${key} = $${dataKeys.length + index + 1}`)
      .join(' AND ');

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
    const result = await this.query<T>(query, [
      ...dataValues,
      ...conditionValues,
    ]);

    return result.rows;
  }

  async delete(
    table: string,
    conditions: Record<string, any>
  ): Promise<number> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');

    const query = `DELETE FROM ${table} WHERE ${whereClause}`;
    const result = await this.query(query, values);

    return result.rowCount;
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();

// Initialize on first import (except in tests)
if (process.env.NODE_ENV !== 'test') {
  db.initialize().catch((error) => {
    console.error('Failed to initialize database:', error);
  });
}

// Graceful shutdown
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', async () => {
    await db.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await db.shutdown();
    process.exit(0);
  });
}
