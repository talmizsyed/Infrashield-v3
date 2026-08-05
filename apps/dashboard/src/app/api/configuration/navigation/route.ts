import { NextResponse } from 'next/server';
import { getPlatformConfigurationService } from '../../../../lib/platform-configuration';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getPlatformConfigurationService().getNavigation());
}
