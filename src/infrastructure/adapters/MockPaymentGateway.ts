// infrastructure/adapters/MockPaymentGateway.ts
import { IPaymentGateway } from '../../domain/ports/IPaymentGateway';

export class MockPaymentGateway implements IPaymentGateway {
  private shouldSucceed: boolean = true;
  private shouldThrow: boolean = false;

  constructor(options?: { shouldSucceed?: boolean; shouldThrow?: boolean }) {
    if (options) {
      if (options.shouldSucceed !== undefined) this.shouldSucceed = options.shouldSucceed;
      if (options.shouldThrow !== undefined) this.shouldThrow = options.shouldThrow;
    }
  }

  // Simulates an external HTTP call to a payment processor like Stripe
  async charge(customerId: string, amount: number): Promise<boolean> {
    if (this.shouldThrow) {
      throw new Error("Payment gateway network connection error");
    }
    return this.shouldSucceed;
  }
}

// Export aliases matching architectural nomenclature
export const MockStripePaymentGateway = MockPaymentGateway;
export const StripePaymentAdapter = MockPaymentGateway;
