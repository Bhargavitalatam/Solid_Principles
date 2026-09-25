// tests/unit/SubscriptionBillingService.test.ts
import { SubscriptionBillingService } from '../../src/domain/services/SubscriptionBillingService';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';
import { User } from '../../src/domain/models/User';
import { Subscription } from '../../src/domain/models/Subscription';

describe('SubscriptionBillingService', () => {
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: jest.Mocked<ITimeProvider>;
  let service: SubscriptionBillingService;

  const sampleUser: User = {
    id: 'user-123',
    stripeCustomerId: 'cus_12345',
  };

  const sampleExpiredSubscription: Subscription = {
    id: 'sub-456',
    userId: 'user-123',
    basePrice: 100.0,
    expiresAt: new Date('2023-01-01T00:00:00.000Z'),
  };

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
      getCurrentTime: jest.fn(),
    };

    service = new SubscriptionBillingService(
      mockSubRepo,
      mockUserRepo,
      mockPaymentGateway,
      mockTimeProvider
    );
  });

  describe('December Promotional Discount Logic', () => {
    it('should apply a 10% discount if the renewal happens in December', async () => {
      // Arrange: Current time is in December (month index 11)
      const decemberTime = new Date('2023-12-15T12:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(decemberTime);

      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
        ...sampleExpiredSubscription,
        basePrice: 100.0,
        expiresAt: new Date('2023-12-01T00:00:00.000Z'),
      });
      mockPaymentGateway.charge.mockResolvedValue(true);

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');
      // 10% off $100 = $90
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_12345', 90.0);

      // Check new expiration date: exactly 1 year added to current time
      const expectedExpiry = new Date('2024-12-15T12:00:00.000Z');
      expect(mockSubRepo.updateExpiration).toHaveBeenCalledWith('sub-456', expectedExpiry);
    });

    it('should charge standard price in non-December months', async () => {
      // Arrange: Current time is in June (month index 5)
      const juneTime = new Date('2023-06-15T12:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(juneTime);

      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
        ...sampleExpiredSubscription,
        basePrice: 100.0,
        expiresAt: new Date('2023-06-01T00:00:00.000Z'),
      });
      mockPaymentGateway.charge.mockResolvedValue(true);

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');
      // Standard charge: $100.00
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_12345', 100.0);

      // Check new expiration date: 1 year added
      const expectedExpiry = new Date('2024-06-15T12:00:00.000Z');
      expect(mockSubRepo.updateExpiration).toHaveBeenCalledWith('sub-456', expectedExpiry);
    });
  });

  describe('Expiration Rules', () => {
    it('should fail if the subscription is not yet expired', async () => {
      // Arrange: Subscription expires tomorrow relative to current time
      const now = new Date('2023-05-10T10:00:00.000Z');
      const futureExpiry = new Date('2023-05-11T10:00:00.000Z');

      mockTimeProvider.getCurrentTime.mockReturnValue(now);
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
        ...sampleExpiredSubscription,
        expiresAt: futureExpiry,
      });

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription is not yet expired');
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
      expect(mockSubRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should correctly handle expiration date when passed as ISO string', async () => {
      const now = new Date('2023-05-10T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(now);
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue({
        ...sampleExpiredSubscription,
        expiresAt: '2022-01-01T00:00:00.000Z' as any,
      });
      mockPaymentGateway.charge.mockResolvedValue(true);

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Renewal successful');
    });
  });

  describe('Payment Gateway Handling', () => {
    it('should fail gracefully if the payment gateway fails', async () => {
      // Arrange: Payment returns false
      const now = new Date('2023-05-10T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(now);
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockPaymentGateway.charge.mockResolvedValue(false);

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment failed');
      expect(mockSubRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should fail gracefully if the payment gateway throws an error', async () => {
      // Arrange: Payment gateway throws network or 3rd party API error
      const now = new Date('2023-05-10T10:00:00.000Z');
      mockTimeProvider.getCurrentTime.mockReturnValue(now);
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(sampleExpiredSubscription);
      mockPaymentGateway.charge.mockRejectedValue(new Error('Network timeout'));

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment gateway error');
      expect(mockSubRepo.updateExpiration).not.toHaveBeenCalled();
    });
  });

  describe('Entity Existence Validation', () => {
    it('should fail if user is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(null);

      const result = await service.processRenewal('unknown-user');

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
      expect(mockSubRepo.getSubscriptionByUserId).not.toHaveBeenCalled();
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });

    it('should fail if subscription is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(sampleUser);
      mockSubRepo.getSubscriptionByUserId.mockResolvedValue(null);

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });
  });
});
