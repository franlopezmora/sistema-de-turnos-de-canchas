import { AccountService } from './AccountService';

export class AccountItemService {
  private readonly accountService = new AccountService();

  async create(clubId: number, accountId: string, input: {
    description: string;
    quantity: number;
    unitPrice: number;
    type?: 'BOOKING' | 'PRODUCT' | 'SERVICE' | 'ADJUSTMENT';
  }) {
    return this.accountService.addItem(clubId, accountId, input);
  }
}
