/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { Pool, PoolClient } from 'pg';

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig, UserInfo } from './types';

// PostgreSQL 连接配置
export interface PostgresConnectionConfig {
  connectionString: string;
  ssl?: boolean;
}



// 重试机制
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`操作失败 (尝试 ${i + 1}/${maxRetries}):`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('重试次数已用完');
}

export class PostgresStorage implements IStorage {
  private pool: Pool;
  private isConnected = false;

  constructor(config: PostgresConnectionConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 360000,
    });

    this.pool.on('error', (err) => {
      console.error('PostgreSQL 连接池错误:', err);
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      // 测试连接
      const client = await this.pool.connect();
      console.log('PostgreSQL 连接成功');

      // 初始化数据库表
      await this.initializeTables(client);

      client.release();
      this.isConnected = true;
    } catch (error) {
      console.error('PostgreSQL 连接失败:', error);
      throw error;
    }
  }

  private async initializeTables(client: PoolClient): Promise<void> {
    const tables = [
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )`,

      // 管理员配置表
      `CREATE TABLE IF NOT EXISTS admin_config (
        id SERIAL PRIMARY KEY,
        config_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // 收藏夹表
      `CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        favorite_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, source, item_id),
        FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
      )`,

      // 播放记录表
      `CREATE TABLE IF NOT EXISTS play_records (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        record_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, source, item_id),
        FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
      )`,

      // 搜索历史表
      `CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        keyword VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
      )`,

      // 跳过配置表
      `CREATE TABLE IF NOT EXISTS skip_configs (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        skip_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, source, item_id),
        FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
      )`,

      // 索引
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username)`,
      `CREATE INDEX IF NOT EXISTS idx_play_records_username ON play_records(username)`,
      `CREATE INDEX IF NOT EXISTS idx_search_history_username ON search_history(username)`,
      `CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_skip_configs_username ON skip_configs(username)`,
    ];

    for (const sql of tables) {
      await client.query(sql);
    }

    console.log('PostgreSQL 表初始化完成');
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    await this.pool.end();
    this.isConnected = false;
    console.log('PostgreSQL 连接已关闭');
  }

  // 密码加密 - 使用 PBKDF2
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32).toString('hex');
    const iterations = 100000;
    const keyLength = 64;

    return new Promise((resolve, reject) => {
      pbkdf2(password, salt, iterations, keyLength, 'sha512', (err: any, derivedKey: Buffer) => {
        if (err) reject(err);
        else resolve(`pbkdf2$${iterations}$${salt}$${derivedKey.toString('hex')}`);
      });
    });
  }

  // 密码验证
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (hash.startsWith('pbkdf2$')) {
      const [, iterations, salt, key] = hash.split('$');
      const keyLength = key.length / 2;

      return new Promise((resolve, reject) => {
        pbkdf2(password, salt, parseInt(iterations), keyLength, 'sha512', (err: any, derivedKey: Buffer) => {
          if (err) reject(err);
          else {
            const expectedKey = Buffer.from(key, 'hex');
            resolve(timingSafeEqual(derivedKey, expectedKey));
          }
        });
      });
    }

    // 明文密码比较（向后兼容）
    return hash === password;
  }

  // 用户相关方法
  async registerUser(userName: string, password: string, email: string): Promise<void> {
    const hashedPassword = await this.hashPassword(password);

    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3)',
          [userName, hashedPassword, email]
        );
      } finally {
        client.release();
      }
    });
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT password_hash FROM users WHERE username = $1 AND is_active = true',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    if (result.rows.length === 0) return false;

    const storedHash = result.rows[0].password_hash;
    const isValid = await this.verifyPassword(password, storedHash);

    // 更新最后登录时间
    if (isValid) {
      await this.updateLastLogin(userName);
    }

    return isValid;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT 1 FROM users WHERE username = $1',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    return result.rows.length > 0;
  }

  async checkEmailExist(email: string): Promise<boolean> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT 1 FROM users WHERE email = $1',
          [email]
        );
        return result;
      } finally {
        client.release();
      }
    });

    return result.rows.length > 0;
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);

    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2',
          [hashedPassword, userName]
        );
      } finally {
        client.release();
      }
    });
  }

  async deleteUser(userName: string): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        // 由于外键约束，相关数据会自动删除
        await client.query('DELETE FROM users WHERE username = $1', [userName]);
      } finally {
        client.release();
      }
    });
  }

  async getAllUsers(): Promise<string[]> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT username FROM users WHERE is_active = true ORDER BY created_at'
        );
        return result;
      } finally {
        client.release();
      }
    });

    return result.rows.map(row => row.username);
  }

  // 用户信息相关
  async getUserInfo(userName: string): Promise<UserInfo | null> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT email, created_at, last_login FROM users WHERE username = $1',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      email: row.email,
      createdAt: new Date(row.created_at).getTime(),
      lastLoginAt: row.last_login ? new Date(row.last_login).getTime() : undefined,
    };
  }

  async setUserInfo(userName: string, userInfo: UserInfo): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2',
          [userInfo.email, userName]
        );
      } finally {
        client.release();
      }
    });
  }

  async updateLastLogin(userName: string): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = $1',
          [userName]
        );
      } finally {
        client.release();
      }
    });
  }

  // 管理员配置相关
  async getAdminConfig(): Promise<AdminConfig | null> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT config_data FROM admin_config ORDER BY id DESC LIMIT 1'
        );
        return result;
      } finally {
        client.release();
      }
    });

    if (result.rows.length === 0) return null;
    return result.rows[0].config_data;
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        // 删除旧配置，插入新配置
        await client.query('DELETE FROM admin_config');
        await client.query(
          'INSERT INTO admin_config (config_data) VALUES ($1)',
          [JSON.stringify(config)]
        );
      } finally {
        client.release();
      }
    });
  }

  // 收藏夹相关
  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const [source, itemId] = key.split('+');

    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT favorite_data FROM favorites WHERE username = $1 AND source = $2 AND item_id = $3',
          [userName, source, itemId]
        );
        return result;
      } finally {
        client.release();
      }
    });

    if (result.rows.length === 0) return null;
    return result.rows[0].favorite_data;
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT source, item_id, favorite_data FROM favorites WHERE username = $1',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    const favorites: Record<string, Favorite> = {};
    for (const row of result.rows) {
      const key = `${row.source}+${row.item_id}`;
      favorites[key] = row.favorite_data;
    }

    return favorites;
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    const [source, itemId] = key.split('+');

    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          `INSERT INTO favorites (username, source, item_id, favorite_data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (username, source, item_id)
           DO UPDATE SET favorite_data = $4, created_at = CURRENT_TIMESTAMP`,
          [userName, source, itemId, JSON.stringify(favorite)]
        );
      } finally {
        client.release();
      }
    });
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    const [source, itemId] = key.split('+');

    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'DELETE FROM favorites WHERE username = $1 AND source = $2 AND item_id = $3',
          [userName, source, itemId]
        );
      } finally {
        client.release();
      }
    });
  }

  // 播放记录相关
  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    const [source, itemId] = key.split('+');

    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT record_data FROM play_records WHERE username = $1 AND source = $2 AND item_id = $3',
          [userName, source, itemId]
        );
        return result;
      } finally {
        client.release();
      }
    });

    if (result.rows.length === 0) return null;
    return result.rows[0].record_data;
  }

  async getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT source, item_id, record_data FROM play_records WHERE username = $1',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    const records: Record<string, PlayRecord> = {};
    for (const row of result.rows) {
      const key = `${row.source}+${row.item_id}`;
      records[key] = row.record_data;
    }

    return records;
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    const [source, itemId] = key.split('+');

    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          `INSERT INTO play_records (username, source, item_id, record_data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (username, source, item_id)
           DO UPDATE SET record_data = $4, updated_at = CURRENT_TIMESTAMP`,
          [userName, source, itemId, JSON.stringify(record)]
        );
      } finally {
        client.release();
      }
    });
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    const [source, itemId] = key.split('+');

    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'DELETE FROM play_records WHERE username = $1 AND source = $2 AND item_id = $3',
          [userName, source, itemId]
        );
      } finally {
        client.release();
      }
    });
  }

  // 搜索历史相关
  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT keyword FROM search_history WHERE username = $1 ORDER BY created_at DESC LIMIT 20',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    return result.rows.map((row: any) => row.keyword);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        // 先删除已存在的相同关键词
        await client.query(
          'DELETE FROM search_history WHERE username = $1 AND keyword = $2',
          [userName, keyword]
        );

        // 插入新的搜索记录
        await client.query(
          'INSERT INTO search_history (username, keyword) VALUES ($1, $2)',
          [userName, keyword]
        );

        // 保持最多20条记录
        await client.query(
          `DELETE FROM search_history
           WHERE username = $1 AND id NOT IN (
             SELECT id FROM search_history
             WHERE username = $2
             ORDER BY created_at DESC
             LIMIT 20
           )`,
          [userName, userName]
        );
      } finally {
        client.release();
      }
    });
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        if (keyword) {
          // 删除特定关键词
          await client.query(
            'DELETE FROM search_history WHERE username = $1 AND keyword = $2',
            [userName, keyword]
          );
        } else {
          // 清空所有搜索历史
          await client.query(
            'DELETE FROM search_history WHERE username = $1',
            [userName]
          );
        }
      } finally {
        client.release();
      }
    });
  }

  // 跳过配置相关
  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT skip_data FROM skip_configs WHERE username = $1 AND source = $2 AND item_id = $3',
          [userName, source, id]
        );
        return result;
      } finally {
        client.release();
      }
    });

    if (result.rows.length === 0) return null;
    return result.rows[0].skip_data;
  }

  async getAllSkipConfigs(userName: string): Promise<Record<string, SkipConfig>> {
    const result = await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT source, item_id, skip_data FROM skip_configs WHERE username = $1',
          [userName]
        );
        return result;
      } finally {
        client.release();
      }
    });

    const configs: Record<string, SkipConfig> = {};
    for (const row of result.rows) {
      const key = `${row.source}+${row.item_id}`;
      configs[key] = row.skip_data;
    }

    return configs;
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          `INSERT INTO skip_configs (username, source, item_id, skip_data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (username, source, item_id)
           DO UPDATE SET skip_data = $4, updated_at = CURRENT_TIMESTAMP`,
          [userName, source, id, JSON.stringify(config)]
        );
      } finally {
        client.release();
      }
    });
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        await client.query(
          'DELETE FROM skip_configs WHERE username = $1 AND source = $2 AND item_id = $3',
          [userName, source, id]
        );
      } finally {
        client.release();
      }
    });
  }

  // 数据清理相关
  async clearAllData(): Promise<void> {
    await withRetry(async () => {
      const client = await this.pool.connect();
      try {
        // 开始事务
        await client.query('BEGIN');

        try {
          // 删除所有数据（由于外键约束，需要按顺序删除）
          await client.query('DELETE FROM search_history');
          await client.query('DELETE FROM skip_configs');
          await client.query('DELETE FROM play_records');
          await client.query('DELETE FROM favorites');
          await client.query('DELETE FROM admin_config');
          await client.query('DELETE FROM users');

          // 重置序列
          await client.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
          await client.query('ALTER SEQUENCE admin_config_id_seq RESTART WITH 1');
          await client.query('ALTER SEQUENCE favorites_id_seq RESTART WITH 1');
          await client.query('ALTER SEQUENCE play_records_id_seq RESTART WITH 1');
          await client.query('ALTER SEQUENCE search_history_id_seq RESTART WITH 1');
          await client.query('ALTER SEQUENCE skip_configs_id_seq RESTART WITH 1');

          // 提交事务
          await client.query('COMMIT');

          console.log('PostgreSQL 所有数据已清空');
        } catch (error) {
          // 回滚事务
          await client.query('ROLLBACK');
          throw error;
        }
      } finally {
        client.release();
      }
    });
  }
}
