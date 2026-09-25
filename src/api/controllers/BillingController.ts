// api/controllers/BillingController.ts
import { Request, Response } from 'express';
import { SubscriptionBillingService } from '../../domain/services/SubscriptionBillingService';
import { PostgresSubscriptionRepository } from '../../infrastructure/adapters/PostgresSubscriptionRepository';
import { PostgresUserRepository } from '../../infrastructure/adapters/PostgresUserRepository';
import { MockPaymentGateway } from '../../infrastructure/adapters/MockPaymentGateway';
import { SystemTimeProvider } from '../../infrastructure/adapters/SystemTimeProvider';
import {
  ISubscriptionRepository,
  IUserRepository,
  IPaymentGateway,
  ITimeProvider,
} from '../../domain/ports';

export class BillingController {
  constructor(
    private subscriptionRepo?: ISubscriptionRepository,
    private userRepo?: IUserRepository,
    private paymentGateway?: IPaymentGateway,
    private timeProvider?: ITimeProvider
  ) {}

  renewSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;

      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          success: false,
          message: 'userId is required and must be a string',
        });
        return;
      }

      // Wire concrete adapters (Inversion of Control container / composition root)
      const subRepo = this.subscriptionRepo ?? new PostgresSubscriptionRepository();
      const userRepo = this.userRepo ?? new PostgresUserRepository();
      const paymentGateway = this.paymentGateway ?? new MockPaymentGateway();
      const timeProvider = this.timeProvider ?? new SystemTimeProvider();

      // Inject adapters into domain service
      const billingService = new SubscriptionBillingService(
        subRepo,
        userRepo,
        paymentGateway,
        timeProvider
      );

      const result = await billingService.processRenewal(userId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || 'Internal server error during subscription renewal',
      });
    }
  };
}
