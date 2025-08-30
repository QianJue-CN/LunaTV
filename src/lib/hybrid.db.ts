/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { AdminConfig } from './admin.types';
import { PostgresConnectionConfig, PostgresStorage } from './postgres.db';
import { BaseRedisStorage, RedisConnectionConfig } from './redis-base.db';
import { Favorite, IStorage, PlayRecord, SkipConfig, UserInfo } from './types';

// 创建具体的Redis存储实现
class RedisStorage extends BaseRedisStorage {
  constructor(config: RedisConnectionConfig) {
    super(config, Symbol.for('__LUNATV_REDIS_CLIENT__'));
  }

  // 提供公共访问方法用于缓存操作
  async getCache(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async setCache(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async deleteCache(key: string): Promise<void> {
    await this.client.del(key);
  }

  async getKeys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async deleteKeys(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

/**
 * 混合存储类 - 结合 PostgreSQL 和 Redis
 * 
 * 数据分层策略：
 * - PostgreSQL: 持久化数据（用户信息、配置、收藏夹等）
 * - Redis: 缓存层 + 高频数据（播放记录、搜索历史、会话等）
 */
export class HybridStorage implements IStorage {
  private postgres: PostgresStorage;
  private redis: RedisStorage;
  private cacheEnabled = true;
  private cacheTTL = 3600; // 缓存1小时

  constructor(
    postgresConfig: PostgresConnectionConfig,
    redisConfig: RedisConnectionConfig
  ) {
    this.postgres = new PostgresStorage(postgresConfig);
    this.redis = new RedisStorage(redisConfig);
  }

  async connect(): Promise<void> {
    console.log('正在连接混合存储...');

    try {
      // 连接 PostgreSQL
      await this.postgres.connect();

      // Redis 连接是自动的，不需要显式连接
      console.log('混合存储连接成功');
    } catch (error) {
      console.error('混合存储连接失败:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.postgres.disconnect();
      // Redis 连接会自动管理
      console.log('混合存储连接已关闭');
    } catch (error) {
      console.error('混合存储断开连接失败:', error);
    }
  }

  // 缓存辅助方法
  private getCacheKey(prefix: string, ...keys: string[]): string {
    return `cache:${prefix}:${keys.join(':')}`;
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.cacheEnabled) return null;

    try {
      const cached = await this.redis.getCache(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('缓存读取失败:', error);
      return null;
    }
  }

  private async setToCache<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.cacheEnabled) return;

    try {
      await this.redis.setCache(key, JSON.stringify(value), ttl || this.cacheTTL);
    } catch (error) {
      console.warn('缓存写入失败:', error);
    }
  }

  private async deleteFromCache(key: string): Promise<void> {
    if (!this.cacheEnabled) return;

    try {
      await this.redis.deleteCache(key);
    } catch (error) {
      console.warn('缓存删除失败:', error);
    }
  }

  // ========== 用户相关方法 ==========
  // 用户数据存储在 PostgreSQL，登录状态缓存在 Redis

  async registerUser(userName: string, password: string, email: string): Promise<void> {
    await this.postgres.registerUser(userName, password, email);

    // 清除相关缓存
    await this.deleteFromCache(this.getCacheKey('user', userName));
    await this.deleteFromCache(this.getCacheKey('user_exists', userName));
    await this.deleteFromCache(this.getCacheKey('users', 'all'));
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const isValid = await this.postgres.verifyUser(userName, password);

    if (isValid) {
      // 缓存用户登录状态
      await this.setToCache(
        this.getCacheKey('login', userName),
        { loginTime: Date.now() },
        86400 // 24小时
      );
    }

    return isValid;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    // 先检查缓存
    const cacheKey = this.getCacheKey('user_exists', userName);
    const cached = await this.getFromCache<boolean>(cacheKey);
    if (cached !== null) return cached;

    // 从数据库查询
    const exists = await this.postgres.checkUserExist(userName);

    // 缓存结果
    await this.setToCache(cacheKey, exists, 1800); // 30分钟

    return exists;
  }

  async checkEmailExist(email: string): Promise<boolean> {
    // 邮箱检查直接查询数据库，不缓存
    return this.postgres.checkEmailExist(email);
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    await this.postgres.changePassword(userName, newPassword);

    // 清除登录缓存，强制重新登录
    await this.deleteFromCache(this.getCacheKey('login', userName));
  }

  async deleteUser(userName: string): Promise<void> {
    await this.postgres.deleteUser(userName);

    // 清除所有相关缓存
    const patterns = [
      this.getCacheKey('user', userName),
      this.getCacheKey('user_exists', userName),
      this.getCacheKey('login', userName),
      this.getCacheKey('users', 'all')
    ];

    await Promise.all(patterns.map(key => this.deleteFromCache(key)));

    // 同时清除 Redis 中的用户数据
    await this.redis.deleteUser(userName);
  }

  async getAllUsers(): Promise<string[]> {
    // 先检查缓存
    const cacheKey = this.getCacheKey('users', 'all');
    const cached = await this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    // 从数据库查询
    const users = await this.postgres.getAllUsers();

    // 缓存结果
    await this.setToCache(cacheKey, users, 1800); // 30分钟

    return users;
  }

  // ========== 用户信息相关 ==========
  // 用户基本信息存储在 PostgreSQL，缓存在 Redis

  async getUserInfo(userName: string): Promise<UserInfo | null> {
    // 先检查缓存
    const cacheKey = this.getCacheKey('userinfo', userName);
    const cached = await this.getFromCache<UserInfo>(cacheKey);
    if (cached) return cached;

    // 从数据库查询
    const userInfo = await this.postgres.getUserInfo(userName);

    // 缓存结果
    if (userInfo) {
      await this.setToCache(cacheKey, userInfo, 3600); // 1小时
    }

    return userInfo;
  }

  async setUserInfo(userName: string, userInfo: UserInfo): Promise<void> {
    await this.postgres.setUserInfo(userName, userInfo);

    // 更新缓存
    const cacheKey = this.getCacheKey('userinfo', userName);
    await this.setToCache(cacheKey, userInfo, 3600);
  }

  async updateLastLogin(userName: string): Promise<void> {
    await this.postgres.updateLastLogin(userName);

    // 清除用户信息缓存，下次访问时重新加载
    await this.deleteFromCache(this.getCacheKey('userinfo', userName));
  }

  // ========== 管理员配置相关 ==========
  // 配置数据存储在 PostgreSQL，缓存在 Redis

  async getAdminConfig(): Promise<AdminConfig | null> {
    // 先检查缓存
    const cacheKey = this.getCacheKey('admin', 'config');
    const cached = await this.getFromCache<AdminConfig>(cacheKey);
    if (cached) return cached;

    // 从数据库查询
    const config = await this.postgres.getAdminConfig();

    // 缓存结果
    if (config) {
      await this.setToCache(cacheKey, config, 1800); // 30分钟
    }

    return config;
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await this.postgres.setAdminConfig(config);

    // 更新缓存
    const cacheKey = this.getCacheKey('admin', 'config');
    await this.setToCache(cacheKey, config, 1800);
  }

  // ========== 数据清理相关 ==========
  async clearAllData(): Promise<void> {
    console.log('正在清空混合存储中的所有数据...');

    try {
      // 并行清空 PostgreSQL 和 Redis 中的所有数据
      await Promise.all([
        this.postgres.clearAllData(),
        this.redis.clearAllData()
      ]);

      console.log('混合存储中的所有数据已清空');
    } catch (error) {
      console.error('清空混合存储数据失败:', error);
      throw error;
    }
  }

  // ========== 高频数据相关 ==========
  // 这些数据直接使用 Redis 存储，提供更好的性能

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    return this.redis.getFavorite(userName, key);
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    return this.redis.getAllFavorites(userName);
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    return this.redis.setFavorite(userName, key, favorite);
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    return this.redis.deleteFavorite(userName, key);
  }

  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    return this.redis.getPlayRecord(userName, key);
  }

  async getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>> {
    return this.redis.getAllPlayRecords(userName);
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    return this.redis.setPlayRecord(userName, key, record);
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    return this.redis.deletePlayRecord(userName, key);
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    return this.redis.getSearchHistory(userName);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    return this.redis.addSearchHistory(userName, keyword);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    return this.redis.deleteSearchHistory(userName, keyword);
  }

  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    return this.redis.getSkipConfig(userName, source, id);
  }

  async getAllSkipConfigs(userName: string): Promise<Record<string, SkipConfig>> {
    return this.redis.getAllSkipConfigs(userName);
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    return this.redis.setSkipConfig(userName, source, id, config);
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    return this.redis.deleteSkipConfig(userName, source, id);
  }

  // ========== 缓存管理方法 ==========

  /**
   * 启用/禁用缓存
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    console.log(`缓存已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 设置缓存TTL
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
    console.log(`缓存TTL设置为 ${ttl} 秒`);
  }

  /**
   * 清除用户相关的所有缓存
   */
  async clearUserCache(userName: string): Promise<void> {
    const patterns = [
      this.getCacheKey('user', userName),
      this.getCacheKey('user_exists', userName),
      this.getCacheKey('userinfo', userName),
      this.getCacheKey('login', userName)
    ];

    await Promise.all(patterns.map(key => this.deleteFromCache(key)));
    console.log(`用户 ${userName} 的缓存已清除`);
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      // 获取所有缓存键
      const keys = await this.redis.getKeys('cache:*');
      await this.redis.deleteKeys(keys);
      console.log(`已清除 ${keys.length} 个缓存项`);
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    userCacheKeys: number;
    configCacheKeys: number;
  }> {
    try {
      const allKeys = await this.redis.getKeys('cache:*');
      const userKeys = await this.redis.getKeys('cache:user*');
      const configKeys = await this.redis.getKeys('cache:admin*');

      return {
        totalKeys: allKeys.length,
        userCacheKeys: userKeys.length,
        configCacheKeys: configKeys.length,
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return { totalKeys: 0, userCacheKeys: 0, configCacheKeys: 0 };
    }
  }
}
