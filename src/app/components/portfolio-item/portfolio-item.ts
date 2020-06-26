import { Component, Input } from '@angular/core'
import { AirGapMarketWallet, ICoinDelegateProtocol } from 'airgap-coin-lib'
import { NetworkType } from 'airgap-coin-lib/dist/utils/ProtocolNetwork'
import BigNumber from 'bignumber.js'
import { Observable, Subscription } from 'rxjs'
import { supportsDelegation } from 'src/app/helpers/delegation'
import { AmountConverterPipe } from 'src/app/pipes/amount-converter/amount-converter.pipe'

import { AccountProvider } from '../../services/account/account.provider'
import { OperationsProvider } from '../../services/operations/operations'
import { WebExtensionProvider } from '../../services/web-extension/web-extension'

@Component({
  selector: 'portfolio-item',
  templateUrl: 'portfolio-item.html',
  styleUrls: ['./portfolio-item.scss']
})
export class PortfolioItemComponent {
  public readonly networkType: typeof NetworkType = NetworkType

  public isActive: boolean = false

  @Input()
  public wallet: AirGapMarketWallet

  @Input()
  public showBalances: boolean = true

  @Input()
  public isExpendable: boolean = false

  @Input()
  public isExtended: boolean = false

  @Input()
  public hideFiatAmounts: boolean = false

  @Input()
  public hideDelegationBadge: boolean = false

  @Input()
  public isToken: boolean = false

  @Input()
  public isDelegated: Observable<boolean>

  @Input()
  public maxDigits: number

  public balance: string
  public numberOfDecimalsInBalance: number = 0
  public readonly smallFontDecimalThreshold = 16
  private readonly defaultMaxDigits = 15

  private walletChanged: Subscription

  constructor(
    private readonly operationsProvider: OperationsProvider,
    public webExtensionProvider: WebExtensionProvider,
    public accountProvider: AccountProvider
  ) {}

  public ngOnInit(): void {
    if (this.webExtensionProvider.isWebExtension()) {
      this.accountProvider.activeAccountSubject.subscribe(activeAccount => {
        if (this.wallet && activeAccount) {
          this.isActive = this.accountProvider.isSameWallet(this.wallet, activeAccount)
        }
      })
    }
    this.updateBalance()
    this.updateDelegationStatus()
    this.walletChanged = this.accountProvider.walletChangedObservable.subscribe(async () => {
      this.updateBalance()
      this.updateDelegationStatus()
    })
  }

  private async updateDelegationStatus() {
    if (this.wallet !== undefined && this.wallet.receivingPublicAddress !== undefined) {
      if (!supportsDelegation(this.wallet.protocol)) {
        this.isDelegated = null
      } else {
        this.isDelegated = await this.operationsProvider.getDelegationStatusObservableOfAddress(
          this.wallet.protocol as ICoinDelegateProtocol,
          this.wallet.receivingPublicAddress
        )
      }
    }
  }

  private updateBalance() {
    if (this.wallet !== undefined && this.wallet.currentBalance !== undefined) {
      const converter = new AmountConverterPipe()
      const currentBalance: BigNumber = this.wallet.currentBalance
      const balanceFormatted = converter.transformValueOnly(currentBalance, {
        protocol: this.wallet.protocol,
        maxDigits: this.digits()
      })
      this.balance = `${balanceFormatted} ${this.wallet.protocol.symbol}`
      const balanceSplit = balanceFormatted.split('.')
      if (balanceSplit.length == 2) {
        const decimals = balanceSplit.pop()
        this.numberOfDecimalsInBalance = decimals.length
      }
    }
  }

  public digits(): number {
    if (this.maxDigits === undefined) {
      return Math.min(this.wallet.protocol.decimals + 1, this.defaultMaxDigits)
    } else {
      return this.maxDigits == 0 ? this.wallet.protocol.decimals + 1 : this.maxDigits
    }
  }

  public ngOnDestroy(): void {
    this.walletChanged.unsubscribe()
  }
}
