import { MainProtocolSymbols } from 'airgap-coin-lib/dist/utils/ProtocolSymbols'
import { ProtocolService } from '@airgap/angular-core'
import { Component } from '@angular/core'
import { Router } from '@angular/router'
import { ICoinProtocol } from 'airgap-coin-lib'

import { AccountProvider } from '../../services/account/account.provider'
import { DataService, DataServiceKey } from '../../services/data/data.service'
import { ErrorCategory, handleErrorSentry } from '../../services/sentry-error-handler/sentry-error-handler'

export enum FeaturedSubProtocolSymbols {
  XTZ_KT = 'xtz-kt',
  XTZ_BTC = 'xtz-btc',
  XTZ_USD = 'xtz-usd',
  XTZ_STKR = 'xtz-stkr',
  XCHF = 'eth-erc20-xchf'
}

@Component({
  selector: 'page-account-add',
  templateUrl: 'account-add.html',
  styleUrls: ['./account-add.scss']
})
export class AccountAddPage {
  public searchTerm: string = ''
  public supportedAccountProtocols: ICoinProtocol[] = []
  public featuredSubAccountProtocols: ICoinProtocol[] = []
  public otherSubAccountProtocols: ICoinProtocol[] = []
  public filteredAccountProtocols: ICoinProtocol[] = []
  public filteredFeaturedSubAccountProtocols: ICoinProtocol[] = []
  public filteredOtherSubAccountProtocols: ICoinProtocol[] = []

  constructor(
    private readonly accountProvider: AccountProvider,
    private readonly protocolService: ProtocolService,
    private readonly router: Router,
    private readonly dataService: DataService
  ) {}

  public async ionViewWillEnter() {
    this.supportedAccountProtocols = await this.protocolService.getActiveProtocols()
    const supportedSubAccountProtocols = Array.prototype.concat.apply(
      [],
      await Promise.all(Object.values(MainProtocolSymbols).map(protocol => this.protocolService.getSubProtocols(protocol)))
    )

    this.featuredSubAccountProtocols = supportedSubAccountProtocols.filter(protocol =>
      Object.values(FeaturedSubProtocolSymbols).includes(protocol.identifier.toLowerCase() as FeaturedSubProtocolSymbols)
    )
    this.otherSubAccountProtocols = supportedSubAccountProtocols.filter(
      protocol => !Object.values(FeaturedSubProtocolSymbols).includes(protocol.identifier.toLowerCase() as FeaturedSubProtocolSymbols)
    )
    this.filterProtocols()
  }

  public searchTermChanged() {
    this.filterProtocols()
  }

  public filterProtocols() {
    const lowerCaseSearchTerm = this.searchTerm.toLowerCase()

    this.filteredAccountProtocols = this.supportedAccountProtocols.filter(
      protocol => protocol.name.toLowerCase().includes(lowerCaseSearchTerm) || protocol.symbol.toLowerCase().includes(lowerCaseSearchTerm)
    )
    this.filteredFeaturedSubAccountProtocols = this.featuredSubAccountProtocols.filter(
      protocol => protocol.name.toLowerCase().includes(lowerCaseSearchTerm) || protocol.symbol.toLowerCase().includes(lowerCaseSearchTerm)
    )
    this.filteredOtherSubAccountProtocols = this.otherSubAccountProtocols.filter(
      protocol => protocol.name.toLowerCase().includes(lowerCaseSearchTerm) || protocol.symbol.toLowerCase().includes(lowerCaseSearchTerm)
    )
  }

  public addAccount(protocol: ICoinProtocol) {
    const info = {
      mainProtocolIdentifier: protocol.identifier
    }
    this.dataService.setData(DataServiceKey.PROTOCOL, info)
    this.router.navigateByUrl('/account-import-onboarding/' + DataServiceKey.PROTOCOL).catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  public addSubAccount(subProtocol: ICoinProtocol) {
    const mainProtocolIdentifier = subProtocol.identifier.split('-')[0]
    if (
      this.accountProvider
        .getWalletList()
        .filter(
          wallet =>
            wallet.protocol.identifier === mainProtocolIdentifier &&
            wallet.protocol.options.network.identifier === subProtocol.options.network.identifier
        ).length > 0
    ) {
      const info = {
        subProtocolIdentifier: subProtocol.identifier,
        networkIdentifier: subProtocol.options.network.identifier
      }

      this.dataService.setData(DataServiceKey.PROTOCOL, info)
      this.router.navigateByUrl('/sub-account-import/' + DataServiceKey.PROTOCOL).catch(err => console.error(err))
    } else {
      const info = {
        mainProtocolIdentifier: mainProtocolIdentifier,
        subProtocolIdentifier: subProtocol.identifier,
        networkIdentifier: subProtocol.options.network.identifier
      }

      this.dataService.setData(DataServiceKey.PROTOCOL, info)
      this.router.navigateByUrl('/account-import-onboarding/' + DataServiceKey.PROTOCOL).catch(handleErrorSentry(ErrorCategory.NAVIGATION))
    }
  }
}
