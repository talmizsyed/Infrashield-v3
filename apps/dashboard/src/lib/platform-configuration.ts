import {
  createPlatformConfigurationService,
  type PlatformConfigurationService,
} from '@infrashield/platform-configuration';

let service: PlatformConfigurationService | undefined;

export function getPlatformConfigurationService(): PlatformConfigurationService {
  if (!service) {
    service = createPlatformConfigurationService();
  }

  return service;
}
