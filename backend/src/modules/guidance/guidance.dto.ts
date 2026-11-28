import { IsIn, IsInt, Max, Min } from 'class-validator';

export const GUIDANCE_TOUR_IDS = [
  'customer_home',
  'customer_booking',
  'customer_confirm',
  'customer_tracking',
  'customer_review',
  'provider_start',
  'provider_workflow',
  'provider_order_accepted',
  'provider_order_scheduled',
  'provider_order_arrived',
  'provider_order_work',
  'provider_order_settlement',
  'provider_order_complete',
  'organization_start',
  'worker_start',
] as const;

export class GuidanceTourParamDto {
  @IsIn(GUIDANCE_TOUR_IDS)
  tourId: string;
}

export class SaveGuidanceDto {
  @IsInt()
  @Min(1)
  @Max(100)
  version: number;

  @IsInt()
  @Min(0)
  @Max(20)
  stepIndex: number;

  @IsIn(['STARTED', 'DISMISSED', 'COMPLETED'])
  status: string;
}
