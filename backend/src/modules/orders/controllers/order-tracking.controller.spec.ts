import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderTrackingService } from '../application/tracking/order-tracking.service';
import { CustomerOrderTrackingController } from './order-tracking.controller';

describe('CustomerOrderTrackingController', () => {
  it('falls back to polling when Redis tracking subscribe fails', async () => {
    jest.useFakeTimers();
    try {
      const response = Object.assign(new EventEmitter(), {
        destroyed: false,
        writableEnded: false,
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn().mockReturnValue(true),
        end: jest.fn(),
      });
      const tracking = {
        getCustomerSnapshot: jest
          .fn()
          .mockResolvedValueOnce({ status: 'ACTIVE', position: null })
          .mockResolvedValueOnce({ status: 'ACTIVE', position: { lat: 10 } }),
        subscribe: jest.fn().mockRejectedValue(new Error('Redis offline')),
      };
      const controller = new CustomerOrderTrackingController(
        tracking as unknown as OrderTrackingService,
      );

      await controller.events(
        { userId: 'customer-id' } as AuthenticatedUser,
        { id: 'order-id' },
        response as unknown as Response,
      );

      expect(response.flushHeaders).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(3_000);
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('"lat":10'),
      );
      response.emit('close');
    } finally {
      jest.useRealTimers();
    }
  });
});
