/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { AdminConfig } from './admin.types';
import { HybridStorage } from './hybrid.db';
import { KvrocksStorage } from './kvrocks.db';
import { PostgresStorage } from './postgres.db';
import { RedisStorage } from './redis.db';
import { getStorage as getNewStorage } from './storage-config';
import { Favorite, IStorage, PlayRecord, SkipConfig, UserInfo } from './types';
import { UpstashRedisStorage } from './upstash.db';

// storage type 常量，支持新旧两套存储系统
const STORAGE_TYPE = (() => {
  // 优先使用新的 STORAGE_TYPE 环境变量
  const newStorageType = process.env.STORAGE_TYPE as
    | 'upstash'
    | 'postgres'
    | 'redis'
    | 'hybrid'
    | undefined;

  if (newStorageType) {
    return newStorageType;
  }

  // 回退到旧的 NEXT_PUBLIC_STORAGE_TYPE
  return (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';
})();

// 创建存储实例
async function createStorage(): Promise<IStorage> {
  switch (STORAGE_TYPE) {
    case 'upstash':
    case 'postgres':
    case 'hybrid':
      // 使用新的存储系统
      return await getNewStorage();
    case 'redis':
      return new RedisStorage();
    case 'kvrocks':
      return new KvrocksStorage();
    case 'localstorage':
    default:
      return null as unknown as IStorage;
  }
}

// 单例存储实例
let storageInstance: IStorage | null = null;

async function getStorage(): Promise<IStorage> {
  if (!storageInstance) {
    storageInstance = await createStorage();
  }
  return storageInstance;
}

// 工具函数：生成存储key
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

// 导出便捷方法
export class DbManager {
  private storage: IStorage | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // 延迟初始化，避免在构造函数中使用异步操作
  }

  private async ensureInitialized(): Promise<void> {
    if (this.storage) return;

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      this.storage = await getStorage();
      console.log(`数据库管理器初始化完成，存储类型: ${STORAGE_TYPE}`);
    } catch (error) {
      console.error('数据库管理器初始化失败:', error);
      throw error;
    }
  }

  // 播放记录相关方法
  async getPlayRecord(
    userName: string,
    source: string,
    id: string
  ): Promise<PlayRecord | null> {
    await this.ensureInitialized();
    const key = generateStorageKey(source, id);
    return this.storage!.getPlayRecord(userName, key);
  }

  async savePlayRecord(
    userName: string,
    source: string,
    id: string,
    record: PlayRecord
  ): Promise<void> {
    await this.ensureInitialized();
    const key = generateStorageKey(source, id);
    await this.storage!.setPlayRecord(userName, key, record);
  }

  async getAllPlayRecords(userName: string): Promise<{
    [key: string]: PlayRecord;
  }> {
    await this.ensureInitialized();
    return this.storage!.getAllPlayRecords(userName);
  }

  async deletePlayRecord(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await this.ensureInitialized();
    const key = generateStorageKey(source, id);
    await this.storage!.deletePlayRecord(userName, key);
  }

  // 收藏相关方法
  async getFavorite(
    userName: string,
    source: string,
    id: string
  ): Promise<Favorite | null> {
    await this.ensureInitialized();
    const key = generateStorageKey(source, id);
    return this.storage!.getFavorite(userName, key);
  }

  async saveFavorite(
    userName: string,
    source: string,
    id: string,
    favorite: Favorite
  ): Promise<void> {
    await this.ensureInitialized();
    const key = generateStorageKey(source, id);
    await this.storage!.setFavorite(userName, key, favorite);
  }

  async getAllFavorites(
    userName: string
  ): Promise<{ [key: string]: Favorite }> {
    await this.ensureInitialized();
    return this.storage!.getAllFavorites(userName);
  }

  async deleteFavorite(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await this.ensureInitialized();
    const key = generateStorageKey(source, id);
    await this.storage!.deleteFavorite(userName, key);
  }

  async isFavorited(
    userName: string,
    source: string,
    id: string
  ): Promise<boolean> {
    const favorite = await this.getFavorite(userName, source, id);
    return favorite !== null;
  }

  // ---------- 用户相关 ----------
  async registerUser(
    userName: string,
    password: string,
    email: string
  ): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.registerUser(userName, password, email);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.storage!.verifyUser(userName, password);
  }

  // 检查用户是否已存在
  async checkUserExist(userName: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.storage!.checkUserExist(userName);
  }

  // 检查邮箱是否已被使用
  async checkEmailExist(email: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.storage!.checkEmailExist(email);
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.changePassword(userName, newPassword);
  }

  async deleteUser(userName: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.deleteUser(userName);
  }

  // ---------- 用户信息相关 ----------
  async getUserInfo(userName: string): Promise<UserInfo | null> {
    await this.ensureInitialized();
    return this.storage!.getUserInfo(userName);
  }

  async setUserInfo(userName: string, userInfo: UserInfo): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.setUserInfo(userName, userInfo);
  }

  async updateLastLogin(userName: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.updateLastLogin(userName);
  }

  // ---------- 搜索历史 ----------
  async getSearchHistory(userName: string): Promise<string[]> {
    await this.ensureInitialized();
    return this.storage!.getSearchHistory(userName);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.addSearchHistory(userName, keyword);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage!.deleteSearchHistory(userName, keyword);
  }

  // 获取全部用户名
  async getAllUsers(): Promise<string[]> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).getAllUsers === 'function') {
      return (this.storage as any).getAllUsers();
    }
    return [];
  }

  // ---------- 管理员配置 ----------
  async getAdminConfig(): Promise<AdminConfig | null> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).getAdminConfig === 'function') {
      return (this.storage as any).getAdminConfig();
    }
    return null;
  }

  async saveAdminConfig(config: AdminConfig): Promise<void> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).setAdminConfig === 'function') {
      await (this.storage as any).setAdminConfig(config);
    }
  }

  // ---------- 跳过片头片尾配置 ----------
  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).getSkipConfig === 'function') {
      return (this.storage as any).getSkipConfig(userName, source, id);
    }
    return null;
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).setSkipConfig === 'function') {
      await (this.storage as any).setSkipConfig(userName, source, id, config);
    }
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).deleteSkipConfig === 'function') {
      await (this.storage as any).deleteSkipConfig(userName, source, id);
    }
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).getAllSkipConfigs === 'function') {
      return (this.storage as any).getAllSkipConfigs(userName);
    }
    return {};
  }

  // ---------- 数据清理 ----------
  async clearAllData(): Promise<void> {
    await this.ensureInitialized();
    if (typeof (this.storage as any).clearAllData === 'function') {
      await (this.storage as any).clearAllData();
    } else {
      throw new Error('存储类型不支持清空数据操作');
    }
  }
}

// 导出默认实例
export const db = new DbManager();
