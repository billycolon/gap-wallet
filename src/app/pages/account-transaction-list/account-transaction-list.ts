import { ProtocolService } from '@airgap/angular-core'
import {
  AirGapMarketWallet,
  IAirGapTransaction,
  ICoinDelegateProtocol,
  MainProtocolSymbols,
  SubProtocolSymbols,
  TezosKtProtocol
} from '@airgap/coinlib-core'
import { Action } from '@airgap/coinlib-core/actions/Action'
import { IAirGapTransactionResult, IProtocolTransactionCursor } from '@airgap/coinlib-core/interfaces/IAirGapTransaction'
import { TezosKtAddress } from '@airgap/coinlib-core/protocols/tezos/kt/TezosKtAddress'
import { HttpClient } from '@angular/common/http'
import { Component } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertController, LoadingController, NavController, PopoverController, ToastController } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { BigNumber } from 'bignumber.js'
import { Subscription, timer } from 'rxjs'
import { supportsDelegation } from 'src/app/helpers/delegation'
import { UIAccountExtendedDetails } from 'src/app/models/widgets/display/UIAccountExtendedDetails'
import { BrowserService } from 'src/app/services/browser/browser.service'
import { ExtensionsService } from 'src/app/services/extensions/extensions.service'

import { AccountEditPopoverComponent } from '../../components/account-edit-popover/account-edit-popover.component'
import { promiseTimeout } from '../../helpers/promise'
import { ActionGroup } from '../../models/ActionGroup'
import { AirGapTezosMigrateAction } from '../../models/actions/TezosMigrateAction'
import { AccountProvider } from '../../services/account/account.provider'
import { DataService, DataServiceKey } from '../../services/data/data.service'
import { OperationsProvider } from '../../services/operations/operations'
import { PushBackendProvider } from '../../services/push-backend/push-backend'
import { ErrorCategory, handleErrorSentry } from '../../services/sentry-error-handler/sentry-error-handler'
import { WalletStorageService } from '../../services/storage/storage'

import { ExchangeProvider } from './../../services/exchange/exchange'

export const refreshRate = 3000

@Component({
  selector: 'page-account-transaction-list',
  templateUrl: 'account-transaction-list.html',
  styleUrls: ['./account-transaction-list.scss']
})
export class AccountTransactionListPage {
  public mainProtocolSymbols: typeof MainProtocolSymbols = MainProtocolSymbols
  public subProtocolSymbols: typeof SubProtocolSymbols = SubProtocolSymbols

  private timer$ = timer(0, refreshRate)
  private subscription: Subscription = new Subscription()

  public isRefreshing: boolean = false
  public initialTransactionsLoaded: boolean = false
  public infiniteEnabled: boolean = false
  public showLinkToBlockExplorer: boolean = false

  public txOffset: number = 0
  public wallet: AirGapMarketWallet

  public transactions: IAirGapTransaction[] = []

  public protocolIdentifier: string

  public hasPendingTransactions: boolean = false
  public hasExchangeTransactions: boolean = false

  public pendingTransactions: IAirGapTransaction[] = []
  public formattedExchangeTransactions: IAirGapTransaction[] = []

  public accountExtendedDetails: UIAccountExtendedDetails

  // XTZ
  public isKtDelegated: boolean = false

  public actions: Action<any, any>[]

  public lottieConfig: { path: string } = {
    path: './assets/animations/loading.json'
  }
  private transactionResult: IAirGapTransactionResult
  private readonly TRANSACTION_LIMIT: number = 10
  private readonly actionGroup: ActionGroup

  private readonly walletChanged: Subscription

  private publicKey: string
  private protocolID: string
  private addressIndex

  constructor(
    public readonly alertCtrl: AlertController,
    public readonly navController: NavController,
    public readonly router: Router,
    public readonly translateService: TranslateService,
    public readonly operationsProvider: OperationsProvider,
    public readonly popoverCtrl: PopoverController,
    public readonly toastController: ToastController,
    public readonly loadingController: LoadingController,
    public readonly accountProvider: AccountProvider,
    public readonly http: HttpClient,
    public readonly dataService: DataService,
    public readonly protocolService: ProtocolService,
    private readonly route: ActivatedRoute,
    private readonly storageProvider: WalletStorageService,
    private readonly pushBackendProvider: PushBackendProvider,
    private readonly exchangeProvider: ExchangeProvider,
    private readonly extensionsService: ExtensionsService,
    private readonly browserService: BrowserService
  ) {
    this.publicKey = this.route.snapshot.params.publicKey
    this.protocolID = this.route.snapshot.params.protocolID
    this.addressIndex = this.route.snapshot.params.addressIndex

    if (this.addressIndex === 'undefined') {
      this.addressIndex = undefined
    } else {
      this.addressIndex = Number(this.addressIndex)
    }

    this.wallet = this.accountProvider.walletByPublicKeyAndProtocolAndAddressIndex(this.publicKey, this.protocolID, this.addressIndex)

    this.updateExtendedDetails()
    this.walletChanged = accountProvider.walletChangedObservable.subscribe(() => {
      this.loadInitialTransactions(true)
      this.updateExtendedDetails()
    })

    this.subscription = this.timer$.subscribe(async () => {
      if (this.formattedExchangeTransactions.length > 0) {
        this.formattedExchangeTransactions = await this.exchangeProvider.getExchangeTransactionsByProtocol(
          this.wallet.protocol.identifier,
          this.wallet.addresses[0]
        )
        this.hasExchangeTransactions = this.formattedExchangeTransactions.length > 0
      }
    })

    this.protocolIdentifier = this.wallet.protocol.identifier

    if (this.protocolIdentifier === SubProtocolSymbols.XTZ_KT) {
      this.isDelegated().catch(handleErrorSentry(ErrorCategory.COINLIB))
    }
    if (this.protocolIdentifier === MainProtocolSymbols.XTZ) {
      this.getKtAddresses().catch(handleErrorSentry(ErrorCategory.COINLIB))
      this.isDelegated().catch(handleErrorSentry(ErrorCategory.COINLIB))
    }

    this.actionGroup = new ActionGroup(this)
    this.actionGroup.getActions().then(actions => {
      this.actions = actions
    })
  }

  public showNoTransactionScreen(): boolean {
    return this.transactions.length === 0
  }

  public ionViewWillEnter(): void {
    this.doRefresh()
  }

  public openPreparePage() {
    let info
    if (this.protocolIdentifier === SubProtocolSymbols.XTZ_KT) {
      const action = new AirGapTezosMigrateAction({
        wallet: this.wallet,
        alertCtrl: this.alertCtrl,
        translateService: this.translateService,
        protocolService: this.protocolService,
        dataService: this.dataService,
        router: this.router
      })
      action.start()
      return
    } else if (this.protocolIdentifier === SubProtocolSymbols.XTZ_BTC) {
      info = {
        wallet: this.wallet,
        address: '',
        disableFees: true
      }
    } else {
      info = {
        wallet: this.wallet,
        address: ''
      }
    }
    this.router
      .navigateByUrl(
        `/transaction-prepare/${DataServiceKey.DETAIL}/${this.publicKey}/${this.protocolID}/${this.addressIndex}/${info.address !==
          ''}/${0}/${'not_forced'}`
      )
      .catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  public openReceivePage(): void {
    this.router
      .navigateByUrl(`/account-address/${DataServiceKey.DETAIL}/${this.publicKey}/${this.protocolID}/${this.addressIndex}`)
      .catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  public openTransactionDetailPage(transaction: IAirGapTransaction): void {
    this.dataService.setData(DataServiceKey.DETAIL, transaction)
    this.router
      .navigateByUrl(`/transaction-detail/${DataServiceKey.DETAIL}/${transaction.hash}`)
      .catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  public async openBlockexplorer(): Promise<void> {
    const blockexplorer = await this.wallet.protocol.getBlockExplorerLinkForAddress(this.wallet.addresses[0])

    this.browserService.openUrl(blockexplorer)
  }

  public doRefresh(event: any = null): void {
    if (supportsDelegation(this.wallet.protocol)) {
      this.operationsProvider.refreshAllDelegationStatuses([this.wallet])
    }

    this.isRefreshing = true

    if (event) {
      event.target.complete()
    }

    this.loadInitialTransactions().catch(handleErrorSentry())
  }

  public async doInfinite(event: { target: { complete: () => void | PromiseLike<void> } }): Promise<void> {
    if (!this.infiniteEnabled) {
      return event.target.complete()
    }

    const newTransactions: IAirGapTransaction[] = await this.getTransactions(
      this.transactionResult ? this.transactionResult.cursor : undefined,
      this.TRANSACTION_LIMIT
    )

    this.transactions = this.mergeTransactions(this.transactions, newTransactions)

    await this.storageProvider.setCache<IAirGapTransaction[]>(this.accountProvider.getAccountIdentifier(this.wallet), this.transactions)

    if (newTransactions.length < this.TRANSACTION_LIMIT) {
      this.infiniteEnabled = false
    }

    event.target.complete()
  }

  public async loadInitialTransactions(forceRefresh: boolean = false): Promise<void> {
    if (this.transactions.length === 0) {
      this.transactions =
        (await this.storageProvider.getCache<IAirGapTransaction[]>(this.accountProvider.getAccountIdentifier(this.wallet))) || []
    }

    const transactionPromise: Promise<IAirGapTransaction[]> = this.getTransactions()

    const transactions: IAirGapTransaction[] = await promiseTimeout(10000, transactionPromise).catch(error => {
      console.error(error)
      // either the txs are taking too long to load or there is actually a network error
      this.showLinkToBlockExplorer = true
      return []
    })

    this.transactions = this.mergeTransactions(forceRefresh ? [] : this.transactions, transactions)

    this.isRefreshing = false
    this.initialTransactionsLoaded = true

    const addr: string = this.wallet.receivingPublicAddress

    try {
      this.pendingTransactions = (await this.pushBackendProvider.getPendingTxs(addr, this.protocolIdentifier)) as IAirGapTransaction[]
    } catch (err) {}

    this.formattedExchangeTransactions = await this.exchangeProvider.getExchangeTransactionsByProtocol(
      this.wallet.protocol.identifier,
      this.wallet.addresses[0]
    )
    this.hasExchangeTransactions = this.formattedExchangeTransactions.length > 0

    // remove duplicates from pendingTransactions
    const txHashes: string[] = this.transactions.map(value => value.hash)
    this.pendingTransactions = this.pendingTransactions.filter(value => {
      return txHashes.indexOf(value.hash) === -1
    })

    if (this.pendingTransactions.length > 0) {
      this.pendingTransactions = this.pendingTransactions.map(pendingTx => {
        pendingTx.fee = new BigNumber(pendingTx.fee).toString(10)
        pendingTx.amount = new BigNumber(pendingTx.amount).toString(10)

        return pendingTx
      })
      this.hasPendingTransactions = true
    } else {
      this.hasPendingTransactions = false
    }

    if (!forceRefresh) {
      this.accountProvider.triggerWalletChanged()
    }

    await this.storageProvider.setCache<IAirGapTransaction[]>(this.accountProvider.getAccountIdentifier(this.wallet), this.transactions)
    this.txOffset = this.transactions.length

    this.infiniteEnabled = true
  }

  public async getTransactions(cursor?: IProtocolTransactionCursor, limit: number = 10): Promise<IAirGapTransaction[]> {
    const [transactionResult]: [IAirGapTransactionResult, void] = await Promise.all([
      this.transactionResult ? this.wallet.fetchTransactions(limit, cursor) : this.wallet.fetchTransactions(limit),
      this.wallet.synchronize().catch(error => {
        console.error(error)
      })
    ])

    this.transactionResult = transactionResult
    return transactionResult.transactions
  }

  public mergeTransactions(oldTransactions: IAirGapTransaction[], newTransactions: IAirGapTransaction[]): IAirGapTransaction[] {
    if (!oldTransactions) {
      return newTransactions
    }

    const transactionMap: Map<string, IAirGapTransaction> = new Map<string, IAirGapTransaction>(
      oldTransactions.map(
        (tx: IAirGapTransaction): [string, IAirGapTransaction] => {
          const key = this.mergeKeyForTransaction(tx)
          return [key, tx]
        }
      )
    )

    const transactionCountBefore: number = transactionMap.size
    newTransactions.forEach(tx => {
      const key = this.mergeKeyForTransaction(tx)
      transactionMap.set(key, tx)
    })

    if (transactionCountBefore === transactionMap.size) {
      // We did not add any elements, so the list does not have to be changed
      return oldTransactions
    }

    return Array.from(transactionMap.values()).sort((a, b) =>
      a.timestamp !== undefined && b.timestamp !== undefined
        ? b.timestamp - a.timestamp
        : new BigNumber(b.blockHeight).minus(new BigNumber(a.blockHeight)).toNumber()
    )
  }

  private mergeKeyForTransaction(transaction: IAirGapTransaction): string {
    return `${transaction.hash ? transaction.hash : ''}${transaction.from.reduce((a, b) => a + b, '')}${transaction.to.reduce(
      (a, b) => a + b,
      ''
    )}${transaction.amount}${transaction.fee}${transaction.timestamp ? transaction.timestamp : ''}`
  }

  public async presentEditPopover(event: any): Promise<void> {
    const popover = await this.popoverCtrl.create({
      component: AccountEditPopoverComponent,
      componentProps: {
        wallet: this.wallet,
        importAccountAction:
          this.wallet.protocol.identifier === MainProtocolSymbols.XTZ ? this.actionGroup.getImportAccountsAction() : undefined,
        onDelete: (): void => {
          this.navController.pop()
        }
      },
      event,
      translucent: true
    })

    return popover.present().catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  // Tezos
  public async isDelegated(): Promise<void> {
    const isDelegated = await this.operationsProvider.checkDelegated(
      this.wallet.protocol as ICoinDelegateProtocol,
      this.wallet.receivingPublicAddress
    )
    this.isKtDelegated = isDelegated
    // const action = isDelegated ? this.getStatusAction() : this.getDelegateAction()
    // this.replaceAction(ActionType.DELEGATE, action)
  }

  public async getKtAddresses(): Promise<string[]> {
    const protocol: TezosKtProtocol = new TezosKtProtocol()
    const ktAddresses: TezosKtAddress[] = await protocol.getAddressesFromPublicKey(this.wallet.publicKey)
    // const action = ktAddresses.length > 0 ? this.getStatusAction(ktAddresses) : this.getDelegateAction()
    // this.replaceAction(ActionType.DELEGATE, action)

    return ktAddresses.map((address: TezosKtAddress) => address.getValue())
  }

  public async openDelegationDetails(): Promise<void> {
    const delegateAction = this.actions.find(action => action.identifier === 'delegate-action')
    if (delegateAction) {
      await delegateAction.start()
    }
  }

  public async showToast(message: string): Promise<void> {
    const toast: HTMLIonToastElement = await this.toastController.create({
      duration: 3000,
      message,
      buttons: [
        {
          text: 'Ok',
          role: 'cancel'
        }
      ],
      position: 'bottom'
    })
    toast.present().catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  private updateExtendedDetails() {
    if (supportsDelegation(this.wallet.protocol) && this.wallet.receivingPublicAddress !== undefined) {
      this.extensionsService.loadDelegationExtensions().then(async () => {
        this.accountExtendedDetails = await this.operationsProvider.getAccountExtendedDetails(this.wallet)
      })
    }
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe()
    this.walletChanged.unsubscribe()
  }
}
