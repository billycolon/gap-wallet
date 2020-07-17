import { animate, style, transition, trigger } from '@angular/animations'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AlertController, ModalController } from '@ionic/angular'
import { AirGapMarketWallet, getProtocolByIdentifier, ICoinProtocol } from 'airgap-coin-lib'
import { BigNumber } from 'bignumber.js'

import { ProtocolSelectPage } from '../../pages/protocol-select/protocol-select'
import { ErrorCategory, handleErrorSentry } from '../../services/sentry-error-handler/sentry-error-handler'
import { ProtocolSymbols } from 'airgap-coin-lib/dist/utils/ProtocolSymbols'

@Component({
  selector: 'swap',
  templateUrl: 'swap.html',
  styleUrls: ['./swap.scss'],
  animations: [
    trigger('expandWalletAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(-20%)', opacity: 0 }),
        animate('500ms', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ transform: 'translateY(0)', opacity: 1 }),
        animate('500ms', style({ transform: 'translateY(-20%)', opacity: 0 }))
      ])
    ])
  ]
})
export class SwapComponent {
  public expandWalletSelection: boolean = false

  @Input()
  public readonly swapSell: boolean = true

  @Input()
  public readonly selectedWallet: AirGapMarketWallet

  @Input()
  public readonly supportedWallets: AirGapMarketWallet[]

  @Input()
  public readonly selectedProtocol: ICoinProtocol

  @Input()
  public readonly supportedProtocols: ProtocolSymbols[] = []

  @Input()
  public readonly minExchangeAmount: BigNumber

  @Input()
  public exchangeAmount: BigNumber

  protected _amount: string

  @Output()
  private readonly protocolSetEmitter: EventEmitter<ICoinProtocol> = new EventEmitter()

  @Output()
  private readonly walletSetEmitter: EventEmitter<AirGapMarketWallet> = new EventEmitter()

  @Output()
  private readonly amountSetEmitter: EventEmitter<string> = new EventEmitter()

  constructor(public alertCtrl: AlertController, public modalController: ModalController) {}

  public amountSet(amount: string): void {
    this._amount = amount
    this.amountSetEmitter.emit(amount)
  }

  public walletSet(wallet: AirGapMarketWallet): void {
    this.walletSetEmitter.emit(wallet)
    this.expandWalletSelection = false
  }

  public async doRadio(): Promise<void> {
    const protocols: ICoinProtocol[] = []
    this.supportedProtocols.forEach(supportedProtocol => {
      try {
        protocols.push(getProtocolByIdentifier(supportedProtocol))
      } catch (error) {
        /* */
      }
    })

    const modal: HTMLIonModalElement = await this.modalController.create({
      component: ProtocolSelectPage,
      componentProps: {
        selectedProtocol: this.selectedProtocol.identifier,
        protocols
      }
    })

    modal
      .onDidDismiss()
      .then((protocolIdentifier: any) => {
        if (protocolIdentifier && protocolIdentifier.data) {
          this.protocolSetEmitter.emit(getProtocolByIdentifier(protocolIdentifier.data))
        }
      })
      .catch(handleErrorSentry(ErrorCategory.IONIC_MODAL))

    modal.present().catch(handleErrorSentry(ErrorCategory.IONIC_MODAL))
  }
}
