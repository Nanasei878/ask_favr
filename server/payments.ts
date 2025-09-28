// Payment system with escrow functionality - prepared for Stripe/MangoPay integration

interface EscrowPayment {
  id: string;
  favorId: number;
  requesterId: string;
  helperId: string;
  amount: number;
  serviceFee: number;
  totalAmount: number;
  status: 'pending' | 'held' | 'released' | 'refunded' | 'cancelled';
  createdAt: Date;
  releasedAt?: Date;
  autoReleaseAt: Date;
}

interface UserWallet {
  userId: string;
  balance: number;
  pendingEarnings: number;
  kycStatus: 'pending' | 'verified' | 'rejected';
  paymentMethods: PaymentMethod[];
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'wallet';
  last4?: string;
  isDefault: boolean;
}

export class PaymentService {
  private escrowPayments: Map<string, EscrowPayment> = new Map();
  private userWallets: Map<string, UserWallet> = new Map();
  private readonly SERVICE_FEE_PERCENTAGE = 0.10; // 10% service fee
  private readonly AUTO_RELEASE_HOURS = 24;

  // Initialize escrow payment when favor is accepted
  async createEscrowPayment(favorId: number, requesterId: string, helperId: string, amount: number): Promise<EscrowPayment> {
    const serviceFee = amount * this.SERVICE_FEE_PERCENTAGE;
    const totalAmount = amount + serviceFee;
    
    const escrowPayment: EscrowPayment = {
      id: `escrow_${Date.now()}_${favorId}`,
      favorId,
      requesterId,
      helperId,
      amount,
      serviceFee,
      totalAmount,
      status: 'pending',
      createdAt: new Date(),
      autoReleaseAt: new Date(Date.now() + this.AUTO_RELEASE_HOURS * 60 * 60 * 1000)
    };

    this.escrowPayments.set(escrowPayment.id, escrowPayment);
    
    // In production: Create Stripe Payment Intent or MangoPay payin
    console.log(`Escrow payment created: ${escrowPayment.id} for favor ${favorId}`);
    
    return escrowPayment;
  }

  // Hold payment in escrow (when requester pays)
  async holdPayment(escrowId: string): Promise<boolean> {
    const payment = this.escrowPayments.get(escrowId);
    if (!payment || payment.status !== 'pending') {
      return false;
    }

    // In production: Charge the requester's payment method
    payment.status = 'held';
    this.escrowPayments.set(escrowId, payment);
    
    console.log(`Payment held in escrow: ${escrowId}`);
    return true;
  }

  // Release payment to helper (when favor is completed)
  async releasePayment(escrowId: string, releasedBy: 'requester' | 'auto' = 'requester'): Promise<boolean> {
    const payment = this.escrowPayments.get(escrowId);
    if (!payment || payment.status !== 'held') {
      return false;
    }

    // In production: Transfer funds to helper's wallet/account
    payment.status = 'released';
    payment.releasedAt = new Date();
    this.escrowPayments.set(escrowId, payment);

    // Add earnings to helper's wallet
    await this.addToWallet(payment.helperId, payment.amount);
    
    console.log(`Payment released: ${escrowId} (${releasedBy})`);
    return true;
  }

  // Refund payment to requester (if favor is cancelled)
  async refundPayment(escrowId: string): Promise<boolean> {
    const payment = this.escrowPayments.get(escrowId);
    if (!payment || payment.status !== 'held') {
      return false;
    }

    // In production: Refund to requester's original payment method
    payment.status = 'refunded';
    this.escrowPayments.set(escrowId, payment);
    
    console.log(`Payment refunded: ${escrowId}`);
    return true;
  }

  // Add funds to user wallet
  async addToWallet(userId: string, amount: number): Promise<void> {
    const wallet = this.userWallets.get(userId) || {
      userId,
      balance: 0,
      pendingEarnings: 0,
      kycStatus: 'pending',
      paymentMethods: []
    };

    wallet.balance += amount;
    this.userWallets.set(userId, wallet);
  }

  // Check for auto-release eligible payments
  async processAutoReleases(): Promise<void> {
    const now = new Date();
    
    for (const [id, payment] of this.escrowPayments) {
      if (payment.status === 'held' && payment.autoReleaseAt <= now) {
        await this.releasePayment(id, 'auto');
      }
    }
  }

  // Get payment details
  getEscrowPayment(escrowId: string): EscrowPayment | undefined {
    return this.escrowPayments.get(escrowId);
  }

  // Get user wallet
  getUserWallet(userId: string): UserWallet | undefined {
    return this.userWallets.get(userId);
  }

  // Calculate fees for display
  calculateFees(amount: number): { serviceFee: number; totalAmount: number; helperReceives: number } {
    const serviceFee = amount * this.SERVICE_FEE_PERCENTAGE;
    return {
      serviceFee,
      totalAmount: amount + serviceFee,
      helperReceives: amount
    };
  }

  // Prepare for Stripe Connect integration
  async createStripeConnectAccount(userId: string): Promise<string> {
    // In production: Create Stripe Connect account for the user
    console.log(`Creating Stripe Connect account for user ${userId}`);
    return `acct_${userId}_${Date.now()}`;
  }

  // Prepare for MangoPay integration
  async createMangoPayWallet(userId: string): Promise<string> {
    // In production: Create MangoPay wallet for the user
    console.log(`Creating MangoPay wallet for user ${userId}`);
    return `wallet_${userId}_${Date.now()}`;
  }
}

export const paymentService = new PaymentService();

// Auto-release scheduler (run every hour)
setInterval(() => {
  paymentService.processAutoReleases();
}, 60 * 60 * 1000);