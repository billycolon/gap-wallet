import { ExchangeSelectPage } from './../exchange-select/exchange-select.page'
import { ModalController } from '@ionic/angular'
import { Component } from '@angular/core'
import { Router } from '@angular/router'
import { AirGapMarketWallet, getProtocolByIdentifier, ICoinProtocol } from 'airgap-coin-lib'
import { BigNumber } from 'bignumber.js'

import { AccountProvider } from '../../services/account/account.provider'
import { DataService, DataServiceKey } from '../../services/data/data.service'
import { ExchangeProvider, ExchangeEnum, ExchangeTransaction } from '../../services/exchange/exchange'
import { ErrorCategory, handleErrorSentry } from '../../services/sentry-error-handler/sentry-error-handler'
import { SettingsKey, StorageProvider } from '../../services/storage/storage'

enum ExchangePageState {
  LOADING,
  ONBOARDING,
  NOT_ENOUGH_CURRENCIES,
  EXCHANGE
}

const FROM = 'from'
const TO = 'to'

@Component({
  selector: 'page-exchange',
  templateUrl: 'exchange.html',
  styleUrls: ['./exchange.scss']
})
export class ExchangePage {
  public selectedFromProtocol: ICoinProtocol
  public selectedToProtocol: ICoinProtocol
  public supportedProtocolsFrom: string[] = []
  public supportedProtocolsTo: string[] = []
  public fromWallet: AirGapMarketWallet
  public supportedFromWallets: AirGapMarketWallet[]
  public toWallet: AirGapMarketWallet
  public supportedToWallets: AirGapMarketWallet[]
  public amount: BigNumber = new BigNumber(0)
  public minExchangeAmount: BigNumber = new BigNumber(0)
  public exchangeAmount: BigNumber
  public activeExchange: string
  public customExchange: boolean

  public exchangePageStates = ExchangePageState
  public exchangePageState: ExchangePageState = ExchangePageState.LOADING

  constructor(
    private readonly router: Router,
    private readonly exchangeProvider: ExchangeProvider,
    private readonly storageProvider: StorageProvider,
    private readonly accountProvider: AccountProvider,
    private readonly dataService: DataService,

    private readonly modalController: ModalController
  ) {
    this.exchangeProvider.getActiveExchange().subscribe(exchange => {
      this.activeExchange = exchange
    })
  }

  public async ionViewWillEnter() {
    if (this.exchangePageState === ExchangePageState.LOADING || this.exchangePageState === ExchangePageState.NOT_ENOUGH_CURRENCIES) {
      this.initExchangePage()
    } else {
      const supportedProtocolsFrom = await this.exchangeProvider.getAvailableFromCurrencies()
      this.supportedProtocolsFrom = await this.filterValidProtocols(supportedProtocolsFrom)
      await this.loadWalletsForSelectedProtocol(FROM)
      const supportedProtocolsTo = await this.exchangeProvider.getAvailableToCurrenciesForCurrency(this.selectedFromProtocol.identifier)
      this.supportedProtocolsTo = await this.filterValidProtocols(supportedProtocolsTo, false)
      await this.loadWalletsForSelectedProtocol(TO)
      this.protocolSet('from', getProtocolByIdentifier(this.supportedProtocolsFrom[0]))
    }
  }

  public async filterValidProtocols(protocols: string[], filterZeroBalance: boolean = true): Promise<string[]> {
    const walletList = this.accountProvider.getWalletList()
    return protocols.filter(supportedProtocol =>
      walletList.some(
        wallet =>
          wallet.protocolIdentifier === supportedProtocol &&
          (!filterZeroBalance || (filterZeroBalance && wallet.currentBalance.isGreaterThan(0)))
      )
    )
  }

  public async initExchangePage(): Promise<void> {
    const supportedProtocolsFrom = await this.exchangeProvider.getAvailableFromCurrencies()
    this.supportedProtocolsFrom = await this.filterValidProtocols(supportedProtocolsFrom)

    if (this.supportedProtocolsFrom.length === 0) {
      this.exchangePageState = ExchangePageState.NOT_ENOUGH_CURRENCIES

      return
    }

    await this.protocolSet(FROM, getProtocolByIdentifier(this.supportedProtocolsFrom[0]))

    if (this.supportedProtocolsTo.length === 0) {
      this.exchangePageState = ExchangePageState.NOT_ENOUGH_CURRENCIES

      return
    }

    const hasShownOnboarding = await this.storageProvider.get(SettingsKey.EXCHANGE_INTEGRATION)

    if (!hasShownOnboarding) {
      this.exchangePageState = ExchangePageState.ONBOARDING

      return
    }

    this.exchangePageState = ExchangePageState.EXCHANGE
  }

  public async protocolSet(fromOrTo: string, protocol: ICoinProtocol): Promise<void> {
    if (fromOrTo === FROM) {
      this.selectedFromProtocol = protocol
    } else {
      this.selectedToProtocol = protocol
      this.customExchange = protocol.identifier === 'xtz-btc' ? true : false
    }

    if (fromOrTo === FROM) {
      const supportedProtocolsTo = await this.exchangeProvider.getAvailableToCurrenciesForCurrency(this.selectedFromProtocol.identifier)
      this.supportedProtocolsTo = await this.filterValidProtocols(supportedProtocolsTo, false)

      if (this.selectedFromProtocol && this.selectedFromProtocol.identifier === 'btc') {
        this.supportedProtocolsTo.push('xtz-btc')
      }

      if (
        !this.selectedToProtocol ||
        this.selectedFromProtocol.identifier === this.selectedToProtocol.identifier ||
        !this.supportedProtocolsTo.includes(this.selectedToProtocol.identifier)
      ) {
        if (this.supportedProtocolsTo.length > 0) {
          this.protocolSet(TO, getProtocolByIdentifier(this.supportedProtocolsTo[0]))
        } else {
          this.exchangePageState = ExchangePageState.NOT_ENOUGH_CURRENCIES

          return
        }
      }
    }

    await this.loadWalletsForSelectedProtocol(fromOrTo)

    return this.loadDataFromExchange()
  }

  public async loadWalletsForSelectedProtocol(fromOrTo: string) {
    if (fromOrTo === FROM) {
      this.supportedFromWallets = this.accountProvider
        .getWalletList()
        .filter(wallet => wallet.protocolIdentifier === this.selectedFromProtocol.identifier && wallet.currentBalance.isGreaterThan(0))

      // Only set wallet if it's another protocol or not available
      if (this.shouldReplaceActiveWallet(this.fromWallet, this.supportedFromWallets)) {
        this.fromWallet = this.supportedFromWallets[0]
      }
    } else {
      this.supportedToWallets = this.accountProvider
        .getWalletList()
        .filter(wallet => wallet.protocolIdentifier === this.selectedToProtocol.identifier)
      this.toWallet = this.supportedToWallets[0]
      // Only set wallet if it's another protocol or not available
      if (this.shouldReplaceActiveWallet(this.toWallet, this.supportedToWallets)) {
        this.toWallet = this.supportedToWallets[0]
      }
    }
  }

  private shouldReplaceActiveWallet(wallet: AirGapMarketWallet, walletArray: AirGapMarketWallet[]): boolean {
    return (
      !wallet ||
      wallet.protocolIdentifier !== walletArray[0].protocolIdentifier ||
      walletArray.every(supportedWallet => !this.accountProvider.isSameWallet(supportedWallet, wallet))
    )
  }

  public async walletSet(fromOrTo: string, wallet: AirGapMarketWallet) {
    if (fromOrTo === FROM) {
      this.fromWallet = wallet
    } else {
      this.toWallet = wallet
    }

    this.loadDataFromExchange()
  }

  public async amountSet(amount: string) {
    this.amount = new BigNumber(amount)

    this.loadDataFromExchange()
  }

  public async loadDataFromExchange() {
    if (this.fromWallet && this.toWallet) {
      this.minExchangeAmount = new BigNumber(
        await this.exchangeProvider.getMinAmountForCurrency(this.fromWallet.protocolIdentifier, this.toWallet.protocolIdentifier)
      )
    }
    if (this.fromWallet && this.toWallet && this.amount.isGreaterThan(0)) {
      this.exchangeAmount = new BigNumber(
        await this.exchangeProvider.getExchangeAmount(
          this.fromWallet.protocolIdentifier,
          this.toWallet.protocolIdentifier,
          this.amount.toString()
        )
      )
    } else {
      this.exchangeAmount = new BigNumber(0)
    }
  }

  public async startExchange() {
    if (this.toWallet.protocolIdentifier === 'xtz-btc') {
      this.router.navigateByUrl('/custom-exchange').catch(handleErrorSentry(ErrorCategory.STORAGE))
    } else {
      try {
        const result = await this.exchangeProvider.createTransaction(
          this.fromWallet.protocolIdentifier,
          this.toWallet.protocolIdentifier,
          this.toWallet.receivingPublicAddress,
          this.amount.toString()
        )

        const amountExpectedTo = await this.exchangeProvider.getExchangeAmount(
          this.fromWallet.protocolIdentifier,
          this.toWallet.protocolIdentifier,
          this.amount.toString()
        )
        const info = {
          fromWallet: this.fromWallet,
          fromCurrency: this.fromWallet.protocolIdentifier,
          toWallet: this.toWallet,
          toCurrency: this.exchangeProvider.convertAirGapIdentifierToExchangeIdentifier([this.toWallet.protocolIdentifier])[0],
          exchangeResult: result,
          amountExpectedFrom: this.amount.toString(),
          amountExpectedTo: amountExpectedTo
        }

        this.dataService.setData(DataServiceKey.EXCHANGE, info)
        this.router.navigateByUrl('/exchange-confirm/' + DataServiceKey.EXCHANGE).catch(handleErrorSentry(ErrorCategory.STORAGE))

        const txId = result.id
        let txStatus: string
        const txStatusResponse = await this.exchangeProvider.getStatus(txId)
        switch (this.activeExchange) {
          case ExchangeEnum.CHANGELLY:
            txStatus = txStatusResponse
            break
          case ExchangeEnum.CHANGENOW:
            txStatus = txStatusResponse.status
            break
        }

        const exchangeTxInfo = {
          receivingAddress: this.toWallet.addresses[0],
          sendingAddress: this.fromWallet.addresses[0],
          fromCurrency: this.fromWallet.protocolIdentifier,
          toCurrency: this.toWallet.protocolIdentifier,
          amountExpectedFrom: this.amount,
          amountExpectedTo: amountExpectedTo.toString(),
          status: txStatus,
          exchange: this.activeExchange,
          id: txId,
          timestamp: new BigNumber(Date.now()).div(1000).toNumber()
        } as ExchangeTransaction

        this.exchangeProvider.pushExchangeTransaction(exchangeTxInfo)
      } catch (error) {
        console.error(error)
      }
    }
  }

  public async doRadio(): Promise<void> {
    const modal: HTMLIonModalElement = await this.modalController.create({
      component: ExchangeSelectPage,
      componentProps: {
        activeExchange: this.activeExchange
      }
    })

    modal.present().catch(err => console.error(err))

    modal
      .onDidDismiss()
      .then(async () => {
        let fromCurrencies = await this.exchangeProvider.getAvailableFromCurrencies()
        fromCurrencies = this.exchangeProvider.convertExchangeIdentifierToAirGapIdentifier(fromCurrencies)
        if (!fromCurrencies.includes(this.selectedFromProtocol.identifier)) {
          this.selectedFromProtocol = getProtocolByIdentifier(this.supportedProtocolsFrom[0])
          await this.loadWalletsForSelectedProtocol('from')
        }
        let toCurrencies = await this.exchangeProvider.getAvailableToCurrenciesForCurrency(this.selectedFromProtocol.identifier)
        toCurrencies = this.exchangeProvider.convertExchangeIdentifierToAirGapIdentifier(toCurrencies)
        if (!toCurrencies.includes(this.selectedToProtocol.identifier)) {
          const supportedProtocolsTo = await this.exchangeProvider.getAvailableToCurrenciesForCurrency(this.selectedFromProtocol.identifier)
          const filteredSupportedProtocolsTo = await this.filterValidProtocols(supportedProtocolsTo, false)
          this.selectedToProtocol = getProtocolByIdentifier(filteredSupportedProtocolsTo.slice(-1).pop())
          await this.loadWalletsForSelectedProtocol('to')
        }
        this.loadDataFromExchange()
      })
      .catch(handleErrorSentry(ErrorCategory.IONIC_MODAL))
  }

  public dismissExchangeOnboarding() {
    this.initExchangePage()
    this.storageProvider.set(SettingsKey.EXCHANGE_INTEGRATION, true).catch(handleErrorSentry(ErrorCategory.STORAGE))
  }

  public goToAddCoinPage() {
    this.router.navigateByUrl('/account-add')
  }
}
