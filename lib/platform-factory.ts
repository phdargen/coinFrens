import { CoinPlatform, PlatformType } from './coin-platform-types';
import { ZoraPlatform } from './platforms/zora-platform';

export class PlatformFactory {
  private static platforms: Map<PlatformType, () => CoinPlatform> = new Map([
    ['zora', () => new ZoraPlatform()],
    // Future platforms can be added here:
    // ['other', () => new OtherPlatform()],
  ]);

  static createPlatform(type: PlatformType): CoinPlatform {
    const platformFactory = this.platforms.get(type);
    
    if (!platformFactory) {
      throw new Error(`Platform type '${type}' is not supported yet`);
    }
    
    return platformFactory();
  }

  static getSupportedPlatforms(): PlatformType[] {
    return Array.from(this.platforms.keys());
  }

  static addPlatform(type: PlatformType, factory: () => CoinPlatform): void {
    this.platforms.set(type, factory);
  }
} 