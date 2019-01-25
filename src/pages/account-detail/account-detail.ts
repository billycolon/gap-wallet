import { Component } from '@angular/core'
import { NavController, NavParams } from 'ionic-angular'
import { AirGapMarketWallet } from 'airgap-coin-lib'
import { SubAccountProvider } from '../../providers/account/sub-account.provider'

@Component({
  selector: 'page-account-detail',
  templateUrl: 'account-detail.html'
})
export class AccountDetailPage {
  wallet: AirGapMarketWallet
  protocolIdentifier: string
  subWallets: AirGapMarketWallet[]

  constructor(public navCtrl: NavController, public navParams: NavParams, private subAccountProvider: SubAccountProvider) {
    this.wallet = this.navParams.get('wallet')
    this.protocolIdentifier = this.wallet.coinProtocol.identifier
    this.subAccountProvider.wallets.subscribe(subWallets => {
      this.subWallets = subWallets.filter(subWallet => subWallet.publicKey === this.wallet.publicKey)
    })
  }
}
