import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { ObservabilityMetrics } from '../../../infrastructure/observability/observability-metrics.service';
import { ProviderDiscoveryService } from '../../discovery/application/provider-discovery.service';
import {
  ConsultationActionDto,
  ConsultationMessageDto,
} from '../dto/ai-consultation.dto';
import { GeminiConsultationService } from '../infrastructure/gemini-consultation.service';
import { AiRecommendationsService } from './ai-recommendations.service';
import { AiRecommendationRefreshService } from './ai-recommendation-refresh.service';
import { AiMessageProcessingService } from './ai-message-processing.service';
import {
  containsUnsupportedClaim,
  explicitlyWantsProvider,
  isAffirmativeReply,
  isClearlyOutOfScope,
  isPriceInquiry,
  redactForGemini,
  safeConsultationAdvice,
} from './ai-privacy';

export type AiConsultationIntent =
  'CONSULTATION' | 'PROVIDER_SEARCH' | 'PRICE_INQUIRY' | 'OUT_OF_SCOPE';

export type AiConsultationNextAction =
  | 'CONTINUE_CONSULTATION'
  | 'OFFER_PROVIDER_SEARCH'
  | 'REQUEST_LOCATION'
  | 'REQUEST_BOOKING_TIME'
  | 'SHOW_PROVIDERS';

export type AiActionType =
  | 'VIEW_INSPIRATION'
  | 'VIEW_SERVICE'
  | 'FIND_PROVIDER'
  | 'CREATE_QUOTE'
  | 'SELECT_ADDRESS'
  | 'SELECT_BOOKING_TIME';

export interface AiAction {
  type: AiActionType;
  label: string;
  targetId?: string;
}

export interface AiConsultationResult {
  clientMessageId: string;
  reply: string;
  intent: AiConsultationIntent;
  suggestedServices: {
    id: string;
    name: string;
    slug: string;
    minPriceAmount: number;
    maxPriceAmount: number;
    currencyCode: string;
  }[];
  suggestedProviders: unknown[];
  suggestedPosts: Awaited<ReturnType<AiRecommendationsService['posts']>>;
  nextActions: AiAction[];
  followUpQuestion: string | null;
  conversionPrompt: string | null;
  nextAction: AiConsultationNextAction;
  degradedMode: boolean;
  citations: { title: string; url: string }[];
  suggestionsExpired?: boolean;
}

@Injectable()
export class AiConsultationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiConsultationService,
    private readonly discovery: ProviderDiscoveryService,
    private readonly recommendations: AiRecommendationsService,
    private readonly refresher: AiRecommendationRefreshService,
    private readonly processing: AiMessageProcessingService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
  ) {}

  async create(userId: string) {
    const conversation = await this.prisma.aiConversation.create({
      data: { userId },
      select: { id: true, createdAt: true },
    });
    return { success: true, data: conversation };
  }

  async list(userId: string) {
    const data = await this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, createdAt: true, updatedAt: true },
    });
    return { success: true, data };
  }

  async messages(userId: string, id: string) {
    await this.owned(userId, id);
    const data = await this.prisma.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        role: true,
        text: true,
        result: true,
        feedback: {
          select: { helpful: true, reason: true, updatedAt: true },
        },
        createdAt: true,
      },
    });
    data.reverse();
    const withResult = data.filter(
      (m) =>
        m.result && typeof m.result === 'object' && !Array.isArray(m.result),
    );
    const fresh = await this.refresher.refreshMany(
      withResult.map((m) => m.result as unknown as AiConsultationResult),
    );
    const byId = new Map(withResult.map((m, i) => [m.id, fresh[i]]));
    return {
      success: true,
      data: data.map((m) => ({ ...m, result: byId.get(m.id) ?? m.result })),
    };
  }

  async refreshRecommendations(
    userId: string,
    id: string,
    clientMessageId: string,
  ) {
    await this.owned(userId, id);
    const message = await this.prisma.aiMessage.findUnique({
      where: {
        conversationId_clientMessageId: { conversationId: id, clientMessageId },
      },
      select: { result: true },
    });
    if (!message) throw new NotFoundException('Không tìm thấy tin nhắn.');
    if (!message.result)
      throw new ConflictException('Tin nhắn đang được xử lý.');
    return {
      success: true,
      data: await this.refresher.refresh(
        message.result as unknown as AiConsultationResult,
      ),
    };
  }

  async remove(userId: string, id: string) {
    const deleted = await this.prisma.aiConversation.deleteMany({
      where: { id, userId },
    });
    if (!deleted.count)
      throw new NotFoundException('Không tìm thấy hội thoại.');
    return { success: true, data: { deleted: true } };
  }

  async recordAction(userId: string, id: string, dto: ConsultationActionDto) {
    await this.owned(userId, id);
    const message = await this.prisma.aiMessage.findUnique({
      where: {
        conversationId_clientMessageId: {
          conversationId: id,
          clientMessageId: dto.clientMessageId,
        },
      },
      select: { id: true, result: true },
    });
    const result = message?.result
      ? await this.refresher.refresh(
          message.result as unknown as AiConsultationResult,
        )
      : null;
    const actions =
      result &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      Array.isArray(result.nextActions)
        ? result.nextActions
        : [];
    const allowed = actions.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        item.type === dto.type &&
        (item.targetId ?? undefined) === dto.targetId,
    );
    if (!message || !allowed)
      throw new BadRequestException('Gợi ý không còn hợp lệ.');
    await this.prisma.aiActionEvent.create({
      data: {
        userId,
        messageId: message.id,
        actionType: dto.type,
        targetId: dto.targetId,
      },
    });
    this.metrics?.recordEvent('ai.cta', 'selected');
    return { success: true, data: { recorded: true } };
  }

  async send(
    userId: string,
    id: string,
    dto: ConsultationMessageDto,
  ): Promise<{ success: true; data: AiConsultationResult }> {
    await this.owned(userId, id);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Tin nhắn không được để trống.');
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw new BadRequestException('Cần đủ vĩ độ và kinh độ.');
    }
    if (dto.bookingType === BookingType.SCHEDULED && !dto.scheduledAt) {
      throw new BadRequestException('Cần thời gian cho lịch đặt trước.');
    }
    if (dto.scheduledAt && dto.bookingType !== BookingType.SCHEDULED) {
      throw new BadRequestException('scheduledAt chỉ dùng cho lịch đặt trước.');
    }

    const claim = await this.processing.claim(
      userId,
      id,
      dto.clientMessageId,
      text,
    );
    if (claim.kind === 'replay') return this.replay(claim.result);
    try {
      const previousResult = await this.prisma.aiMessage.findFirst({
        where: {
          conversationId: id,
          role: 'user',
          clientMessageId: { not: dto.clientMessageId },
          result: { not: Prisma.AnyNull },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { result: true },
      });
      const previousContext = this.readResultContext(previousResult?.result);

      const history = await this.prisma.aiMessage.findMany({
        where: { conversationId: id, text: { not: '' } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8,
        select: { role: true, text: true },
      });
      const explicitlyRequestedProvider = explicitlyWantsProvider(text);
      const continuesProviderFlow =
        (previousContext.nextAction === 'OFFER_PROVIDER_SEARCH' ||
          previousContext.nextAction === 'REQUEST_LOCATION' ||
          previousContext.nextAction === 'REQUEST_BOOKING_TIME') &&
        (isAffirmativeReply(text) || explicitlyRequestedProvider);
      const wantsProvider =
        explicitlyRequestedProvider || continuesProviderFlow;
      const needsModel =
        !wantsProvider && !isClearlyOutOfScope(text) && !isPriceInquiry(text);
      const answer = needsModel
        ? await this.gemini.analyze(
            history.reverse().map((item) => ({
              role: item.role,
              text: redactForGemini(item.text),
            })),
          )
        : null;
      const safeReply = answer?.reply
        ? safeConsultationAdvice(answer.reply)
        : '';
      const safeFollowUp =
        answer?.followUpQuestion &&
        !containsUnsupportedClaim(answer.followUpQuestion) &&
        redactForGemini(answer.followUpQuestion) === answer.followUpQuestion
          ? answer.followUpQuestion
          : null;
      const intent: AiConsultationIntent = isClearlyOutOfScope(text)
        ? 'OUT_OF_SCOPE'
        : wantsProvider
          ? 'PROVIDER_SEARCH'
          : answer?.intent === 'OUT_OF_SCOPE'
            ? 'OUT_OF_SCOPE'
            : isPriceInquiry(text) || answer?.intent === 'PRICE_INQUIRY'
              ? 'PRICE_INQUIRY'
              : 'CONSULTATION';
      const searchTerms = [
        ...(answer?.searchTerms ?? []),
        ...(continuesProviderFlow && isAffirmativeReply(text)
          ? previousContext.serviceNames
          : []),
      ];
      const shouldResolveServices =
        intent !== 'OUT_OF_SCOPE' &&
        (intent !== 'CONSULTATION' || searchTerms.length > 0);
      let services = shouldResolveServices
        ? await this.recommendations.services(searchTerms, text)
        : [];
      // Explicitly naming another service wins; short references can reuse the previous advice.
      if (
        wantsProvider &&
        !services.length &&
        previousContext.serviceNames.length
      ) {
        services = await this.recommendations.services(
          previousContext.serviceNames,
          '',
        );
      }
      const service = services[0];
      const posts = services.length
        ? await this.recommendations.posts(services.map((item) => item.id))
        : [];
      let providers: unknown[] = [];
      let needsLocation = false;
      let needsBookingTime = false;
      let addressId = dto.customerAddressId;
      if (wantsProvider && service) {
        if (!addressId && dto.latitude === undefined) {
          const defaultAddress = await this.prisma.customerAddress.findFirst({
            where: { userId, isDefault: true },
            select: { id: true },
          });
          addressId = defaultAddress?.id;
        }
        if (!addressId && dto.latitude === undefined) {
          needsLocation = true;
        } else if (!dto.bookingType) {
          needsBookingTime = true;
        } else {
          try {
            const found = await this.discovery.search(userId, {
              serviceId: service.id,
              customerAddressId: addressId,
              latitude: dto.latitude,
              longitude: dto.longitude,
              bookingType: dto.bookingType,
              scheduledAt: dto.scheduledAt,
              limit: 5,
            });
            providers = found.data;
          } catch {
            providers = [];
          }
        }
      }
      const reply =
        intent === 'OUT_OF_SCOPE'
          ? 'Mình là trợ lý chuyên tư vấn làm đẹp và dịch vụ tại nhà trên Lambe nên chưa thể tư vấn chủ đề này. Mình có thể giúp bạn về tóc, makeup, nail, massage hoặc chăm sóc da nhé.'
          : wantsProvider
            ? !service
              ? 'Mình chưa tìm được dịch vụ phù hợp trong Lambe. Bạn mô tả rõ hơn dịch vụ muốn làm nhé?'
              : needsLocation
                ? 'Mình cần địa chỉ phục vụ để tìm đúng chuyên viên gần bạn.'
                : needsBookingTime
                  ? 'Bạn muốn làm dịch vụ ngay hay đặt trước vào thời gian khác?'
                  : providers.length === 0
                    ? 'Hiện chưa có chuyên viên phù hợp với vị trí và thời gian này. Bạn có thể thử thời gian khác.'
                    : 'Mình đã tìm được một số chuyên viên phù hợp. Bạn có thể xem hồ sơ và chọn người mình thấy ưng ý.'
            : intent === 'PRICE_INQUIRY' && service
              ? `Dịch vụ ${service.name} trong Lambe có khung giá từ ${service.minPriceAmount.toLocaleString('vi-VN')} đến ${service.maxPriceAmount.toLocaleString('vi-VN')} đồng. Giá của từng thợ có thể khác nhau.`
              : intent === 'PRICE_INQUIRY'
                ? 'Mình chưa xác định được dịch vụ trong hệ thống để báo khung giá. Bạn cho mình biết tên dịch vụ muốn tìm nhé?'
                : safeReply
                  ? safeReply
                  : 'Mình có thể giúp bạn chọn kiểu tóc, makeup hoặc chăm sóc phù hợp. Bạn muốn mình tư vấn điều gì cụ thể hơn?';
      const conversionPrompt =
        intent === 'CONSULTATION' && safeReply && service && !safeFollowUp
          ? `Nếu bạn thấy ${service.name} phù hợp, mình có thể tìm chuyên viên gần bạn để tham khảo hồ sơ và mức giá thực tế.`
          : null;
      const result: AiConsultationResult = {
        clientMessageId: dto.clientMessageId,
        reply,
        intent,
        suggestedServices: services,
        suggestedProviders: providers,
        suggestedPosts: posts,
        nextActions: [
          ...posts.map((post) => ({
            type: 'VIEW_INSPIRATION' as const,
            label: 'Xem mẫu tham khảo',
            targetId: post.id,
          })),
          ...services.map((item) => ({
            type: 'VIEW_SERVICE' as const,
            label: 'Xem dịch vụ',
            targetId: item.id,
          })),
          ...(wantsProvider && service
            ? needsLocation
              ? [{ type: 'SELECT_ADDRESS' as const, label: 'Chọn địa chỉ' }]
              : needsBookingTime
                ? [
                    {
                      type: 'SELECT_BOOKING_TIME' as const,
                      label: 'Chọn thời gian',
                    },
                  ]
                : providers.length
                  ? [
                      {
                        type: 'FIND_PROVIDER' as const,
                        label: 'Xem chuyên viên',
                        targetId: service.id,
                      },
                      { type: 'CREATE_QUOTE' as const, label: 'Xem báo giá' },
                    ]
                  : [
                      {
                        type: 'SELECT_BOOKING_TIME' as const,
                        label: 'Thử thời gian khác',
                      },
                    ]
            : []),
        ],
        followUpQuestion:
          wantsProvider || intent === 'OUT_OF_SCOPE' ? null : safeFollowUp,
        conversionPrompt,
        nextAction:
          intent === 'OUT_OF_SCOPE'
            ? 'CONTINUE_CONSULTATION'
            : wantsProvider && service
              ? needsLocation
                ? 'REQUEST_LOCATION'
                : needsBookingTime
                  ? 'REQUEST_BOOKING_TIME'
                  : providers.length
                    ? 'SHOW_PROVIDERS'
                    : 'REQUEST_BOOKING_TIME'
              : conversionPrompt
                ? 'OFFER_PROVIDER_SEARCH'
                : 'CONTINUE_CONSULTATION',
        degradedMode:
          needsModel &&
          (!answer ||
            !safeReply ||
            safeReply !== answer.reply ||
            safeFollowUp !== (answer.followUpQuestion ?? null)),
        citations:
          intent !== 'OUT_OF_SCOPE' && safeReply
            ? (answer?.citations ?? []).filter(
                (item) =>
                  !containsUnsupportedClaim(item.title) &&
                  redactForGemini(item.title) === item.title,
              )
            : [],
      };
      await this.processing.complete(
        userId,
        id,
        dto.clientMessageId,
        claim,
        result,
      );
      this.metrics?.recordEvent('ai.intent', result.intent);
      if (result.nextActions.length)
        this.metrics?.recordEvent('ai.cta', 'offered');
      return { success: true, data: result };
    } catch (error) {
      await this.processing
        .release(id, dto.clientMessageId, claim.token)
        .catch(() => undefined);
      throw error;
    }
  }

  private async owned(userId: string, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Không tìm thấy hội thoại.');
  }

  private async replay(
    result: Prisma.JsonValue,
  ): Promise<{ success: true; data: AiConsultationResult }> {
    return {
      success: true,
      data: await this.refresher.refresh(
        result as unknown as AiConsultationResult,
      ),
    };
  }

  private readResultContext(result: Prisma.JsonValue | null | undefined) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return { nextAction: null, serviceNames: [] as string[] };
    }
    const value = result;
    const services = Array.isArray(value.suggestedServices)
      ? value.suggestedServices
      : [];
    return {
      nextAction:
        typeof value.nextAction === 'string' ? value.nextAction : null,
      serviceNames: services.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const name = item.name;
        return typeof name === 'string' && name.trim() ? [name] : [];
      }),
    };
  }
}
