import { Injectable } from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import type { CreateServiceDto } from '../dto/create-service.dto';
import type { ReorderServicesDto } from '../dto/reorder-services.dto';
import type { UpdateServiceStatusDto } from '../dto/update-service-status.dto';
import type { UpdateServiceDto } from '../dto/update-service.dto';
import { ChangeServiceStatusService } from './change-service-status.service';
import { CreateServiceService } from './create-service.service';
import { ReorderServicesService } from './reorder-services.service';
import { UpdateServiceService } from './update-service.service';

@Injectable()
export class ServicesCommandService {
  constructor(
    private readonly createService: CreateServiceService,
    private readonly updateService: UpdateServiceService,
    private readonly changeStatus: ChangeServiceStatusService,
    private readonly reorderServices: ReorderServicesService,
  ) {}

  create(dto: CreateServiceDto, actorId: string, request?: RequestMetadata) {
    return this.createService.execute(dto, actorId, request);
  }

  update(
    id: string,
    dto: UpdateServiceDto,
    actorId: string,
    request?: RequestMetadata,
  ) {
    return this.updateService.execute(id, dto, actorId, request);
  }

  updateStatus(
    id: string,
    dto: UpdateServiceStatusDto,
    actorId: string,
    request?: RequestMetadata,
  ) {
    return this.changeStatus.execute(id, dto, actorId, request);
  }

  reorder(
    categoryId: string,
    dto: ReorderServicesDto,
    actorId: string,
    request?: RequestMetadata,
  ) {
    return this.reorderServices.execute(categoryId, dto, actorId, request);
  }
}
