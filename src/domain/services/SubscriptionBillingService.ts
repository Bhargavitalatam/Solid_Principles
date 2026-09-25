// domain/services/SubscriptionBillingService.ts
import { ISubscriptionRepository } from '../ports/ISubscriptionRepository';
import { IUserRepository } from '../ports/IUserRepository';
import { IPaymentGateway } from '../ports/IPaymentGateway';
import { ITimeProvider } from '../ports/ITimeProvider';

export interface RenewalResult {
  success: boolean;
  message: string;
}

export class SubscriptionBillingService {
  // Dependencies are injected via the constructor.
  // Notice the absence of direct instantiations (no direct database, network, or system clock calls)
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly userRepo: IUserRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly timeProvider: ITimeProvider
  ) {}

  // Orchestrates the renewal process
  // Params: userId (string)
  // Returns: { success: boolean, message: string }
  async processRenewal(userId: string): Promise<RenewalResult> {
    // 1. Fetch user data using repository
    const user = await this.userRepo.getUserById(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    // 2. Fetch subscription data using repository
    const sub = await this.subscriptionRepo.getSubscriptionByUserId(userId);
    if (!sub) {
      return { success: false, message: "Subscription not found" };
    }

    // 3. Get current deterministic time from the injected time provider
    const now = this.timeProvider.getCurrentTime();

    // BUSINESS RULE 1: Cannot renew if not expired
    const subExpiry = sub.expiresAt instanceof Date ? sub.expiresAt : new Date(sub.expiresAt);
    if (subExpiry.getTime() > now.getTime()) {
      return { success: false, message: "Subscription is not yet expired" };
    }

    // BUSINESS RULE 2: December Promotional Discount (10% off)
    let chargeAmount = sub.basePrice;
    if (now.getMonth() === 11) {
      // 11 is December in 0-indexed JS dates
      chargeAmount = chargeAmount * 0.9;
    }

    // 4. Charge customer using the injected payment gateway
    const stripeCustomerId = user.stripeCustomerId;
    try {
      const chargeSuccess = await this.paymentGateway.charge(stripeCustomerId, chargeAmount);

      if (chargeSuccess) {
        // BUSINESS RULE 3: Add exactly 1 year to current time for next expiry
        const newExpiry = new Date(now.getTime());
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        // 5. Update DB using repository
        await this.subscriptionRepo.updateExpiration(sub.id, newExpiry);

        return { success: true, message: "Renewal successful" };
      } else {
        return { success: false, message: "Payment failed" };
      }
    } catch (error) {
      return { success: false, message: "Payment gateway error" };
    }
  }
}
