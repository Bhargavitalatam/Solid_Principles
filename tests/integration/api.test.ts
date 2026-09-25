// tests/integration/api.test.ts
import request from 'supertest';
import { createApp } from '../../src/api/app';
import { BillingController } from '../../src/api/controllers/BillingController';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';

describe('API Integration - /api/renew', () => {
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: jest.Mocked<ITimeProvider>;
  let app: any;

  beforeEach(() => {
    mockSubRepo = {
      getSubscriptionByUserId: jest.fn(),
      updateExpiration: jest.fn().mockResolvedValue(undefined),
    };
    mockUserRepo = {
      getUserById: jest.fn(),
    };
    mockPaymentGateway = {
      charge: jest.fn().mockResolvedValue(true),
    };
    mockTimeProvider = {
      getCurrentTime: jest.fn().mockReturnValue(new Date('2024-05-01T00:00:00.000Z')),
    };

    const controller = new BillingController(
      mockSubRepo,
      mockUserRepo,
      mockPaymentGateway,
      mockTimeProvider
    );
    app = createApp(controller);
  });

  it('should return 400 if userId is missing', async () => {
    const res = await request(app)
      .post('/api/renew')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 200 and renew successfully for valid expired subscription', async () => {
    mockUserRepo.getUserById.mockResolvedValue({
      id: 'user-expired-101',
      stripeCustomerId: 'cus_expired_stripe_101',
    });
    mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
      id: 'sub-expired-101',
      userId: 'user-expired-101',
      basePrice: 99.99,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-expired-101' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Renewal successful',
    });
    expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_expired_stripe_101', 99.99);
    expect(mockSubRepo.updateExpiration).toHaveBeenCalled();
  });

  it('should return 400 when subscription is not yet expired', async () => {
    mockUserRepo.getUserById.mockResolvedValue({
      id: 'user-active-202',
      stripeCustomerId: 'cus_active_stripe_202',
    });
    mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
      id: 'sub-active-202',
      userId: 'user-active-202',
      basePrice: 149.99,
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-active-202' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Subscription is not yet expired',
    });
  });

  it('should return 400 when user is not found', async () => {
    mockUserRepo.getUserById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-non-existent-999' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'User not found',
    });
  });
});
