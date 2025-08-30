/* eslint-disable no-console */

/**
 * 存储系统配置文件
 * 
 * 根据环境变量和配置选择合适的存储实现
 */

import { HybridStorage } from './hybrid.db';
import { PostgresConnectionConfig, PostgresStorage } from './postgres.db';
import { BaseRedisStorage, RedisConnectionConfig } from './redis-base.db';
import { IStorage } from './types';
import { UpstashRedisStorage } from './upstash.db';

// 存储类型枚举
export enum StorageType {
  UPSTASH = 'upstash',
  POSTGRES = 'postgres',
  REDIS = 'redis',
  HYBRID = 'hybrid'
}

// 创建具体的Redis存储实现
class RedisStorage extends BaseRedisStorage {
  constructor(config: RedisConnectionConfig) {
    super(config, Symbol.for('__LUNATV_REDIS_CLIENT__'));
  }
}

/**
 * 获取存储配置
 */
function getStorageConfigs() {
  // PostgreSQL 配置
  const postgresConfig: PostgresConnectionConfig = {
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
    ssl: process.env.NODE_ENV === 'production'
  };

  // Redis 配置
  const redisConfig: RedisConnectionConfig = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    clientName: 'LunaTV-Redis'
  };

  return { postgresConfig, redisConfig };
}

/**
 * 根据环境变量确定存储类型
 */
function determineStorageType(): StorageType {
  // 优先级：环境变量 > 可用性检查
  const storageType = process.env.STORAGE_TYPE as StorageType;

  if (storageType && Object.values(StorageType).includes(storageType)) {
    return storageType;
  }

  // 自动检测可用的存储类型
  if (process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN) {
    return StorageType.UPSTASH;
  }

  if (process.env.DATABASE_URL && process.env.REDIS_URL) {
    return StorageType.HYBRID;
  }

  if (process.env.DATABASE_URL) {
    return StorageType.POSTGRES;
  }

  if (process.env.REDIS_URL) {
    return StorageType.REDIS;
  }

  // 默认使用 Upstash（如果配置了）
  return StorageType.UPSTASH;
}

/**
 * 创建存储实例
 */
export async function createStorage(): Promise<IStorage> {
  const storageType = determineStorageType();
  const { postgresConfig, redisConfig } = getStorageConfigs();

  console.log(`正在初始化存储类型: ${storageType}`);

  let storage: IStorage;

  switch (storageType) {
    case StorageType.UPSTASH:
      if (!process.env.UPSTASH_URL || !process.env.UPSTASH_TOKEN) {
        throw new Error('Upstash 配置缺失：需要设置 UPSTASH_URL 和 UPSTASH_TOKEN 环境变量');
      }
      storage = new UpstashRedisStorage();
      break;

    case StorageType.POSTGRES:
      if (!postgresConfig.connectionString) {
        throw new Error('PostgreSQL 配置缺失：需要设置 DATABASE_URL 环境变量');
      }
      storage = new PostgresStorage(postgresConfig);
      await (storage as PostgresStorage).connect();
      break;

    case StorageType.REDIS:
      if (!redisConfig.url) {
        throw new Error('Redis 配置缺失：需要设置 REDIS_URL 环境变量');
      }
      storage = new RedisStorage(redisConfig);
      break;

    case StorageType.HYBRID: {
      if (!postgresConfig.connectionString || !redisConfig.url) {
        throw new Error('混合存储配置缺失：需要设置 DATABASE_URL 和 REDIS_URL 环境变量');
      }
      const hybridStorage = new HybridStorage(postgresConfig, redisConfig);
      await hybridStorage.connect();
      storage = hybridStorage;
      break;
    }

    default:
      throw new Error(`不支持的存储类型: ${storageType}`);
  }

  console.log(`存储系统初始化完成: ${storageType}`);
  return storage;
}

/**
 * 单例存储实例
 */
let storageInstance: IStorage | null = null;

/**
 * 获取存储实例（单例模式）
 */
export async function getStorage(): Promise<IStorage> {
  if (!storageInstance) {
    storageInstance = await createStorage();
  }
  return storageInstance;
}

/**
 * 关闭存储连接
 */
export async function closeStorage(): Promise<void> {
  if (storageInstance) {
    // 检查是否有 disconnect 方法
    if ('disconnect' in storageInstance && typeof storageInstance.disconnect === 'function') {
      await storageInstance.disconnect();
    }
    storageInstance = null;
    console.log('存储连接已关闭');
  }
}

/**
 * 存储健康检查
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  storageType: StorageType;
  details: Record<string, unknown>;
}> {
  const storageType = determineStorageType();
  const details: Record<string, unknown> = {
    storageType,
    timestamp: new Date().toISOString()
  };

  try {
    const storage = await getStorage();

    // 尝试执行一个简单的操作来测试连接
    const testUser = `health_check_${Date.now()}`;

    // 检查用户是否存在（这个操作对所有存储类型都是安全的）
    const userExists = await storage.checkUserExist(testUser);
    details.testOperation = 'checkUserExist';
    details.testResult = userExists;

    return {
      status: 'healthy',
      storageType,
      details
    };
  } catch (error) {
    details.error = error instanceof Error ? error.message : String(error);

    return {
      status: 'unhealthy',
      storageType,
      details
    };
  }
}

/**
 * 获取存储统计信息
 */
export async function getStorageStats(): Promise<Record<string, unknown>> {
  const storageType = determineStorageType();
  const storage = await getStorage();

  const stats: Record<string, unknown> = {
    storageType,
    timestamp: new Date().toISOString()
  };

  try {
    // 获取用户总数
    const allUsers = await storage.getAllUsers();
    stats.totalUsers = allUsers.length;

    // 如果是混合存储，获取缓存统计
    if (storageType === StorageType.HYBRID && storage instanceof HybridStorage) {
      const cacheStats = await storage.getCacheStats();
      stats.cache = cacheStats;
    }

    // 获取管理员配置状态
    const adminConfig = await storage.getAdminConfig();
    stats.hasAdminConfig = !!adminConfig;

  } catch (error) {
    stats.error = error instanceof Error ? error.message : String(error);
  }

  return stats;
}

/**
 * 环境变量检查
 */
export function checkEnvironmentVariables(): {
  isValid: boolean;
  missing: string[];
  recommendations: string[];
} {
  const missing: string[] = [];
  const recommendations: string[] = [];

  // 检查必需的环境变量
  const requiredVars = {
    UPSTASH: ['UPSTASH_URL', 'UPSTASH_TOKEN'],
    POSTGRES: ['DATABASE_URL'],
    REDIS: ['REDIS_URL'],
    HYBRID: ['DATABASE_URL', 'REDIS_URL']
  };

  const storageType = process.env.STORAGE_TYPE as StorageType;

  if (storageType && requiredVars[storageType.toUpperCase() as keyof typeof requiredVars]) {
    const vars = requiredVars[storageType.toUpperCase() as keyof typeof requiredVars];
    for (const varName of vars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  } else {
    // 如果没有指定存储类型，检查所有可能的配置
    let hasValidConfig = false;

    // 检查 Upstash
    if (process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN) {
      hasValidConfig = true;
    }

    // 检查混合存储
    if (process.env.DATABASE_URL && process.env.REDIS_URL) {
      hasValidConfig = true;
    }

    // 检查单独的存储
    if (process.env.DATABASE_URL || process.env.REDIS_URL) {
      hasValidConfig = true;
    }

    if (!hasValidConfig) {
      recommendations.push('请设置以下环境变量之一的组合：');
      recommendations.push('- Upstash: UPSTASH_URL, UPSTASH_TOKEN');
      recommendations.push('- 混合存储: DATABASE_URL, REDIS_URL');
      recommendations.push('- PostgreSQL: DATABASE_URL');
      recommendations.push('- Redis: REDIS_URL');
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    recommendations
  };
}
