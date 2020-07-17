import { Injectable } from '@angular/core'
import { ICoinDelegateProtocol, KusamaProtocol, PolkadotProtocol, TezosProtocol, CosmosProtocol } from 'airgap-coin-lib'

import { AmountConverterPipe } from 'src/app/pipes/amount-converter/amount-converter.pipe'
import { DecimalPipe } from '@angular/common'
import { FormBuilder } from '@angular/forms'
import { RemoteConfigProvider } from '../remote-config/remote-config'

import { ProtocolDelegationExtensions } from 'src/app/extensions/delegation/ProtocolDelegationExtensions'
import { SubstrateDelegationExtensions } from 'src/app/extensions/delegation/SubstrateDelegationExtensions'
import { TezosDelegationExtensions } from 'src/app/extensions/delegation/TezosDelegationExtensions'
import { CosmosDelegationExtensions } from 'src/app/extensions/delegation/CosmosDelegationExtensions'
import { ShortenStringPipe } from 'src/app/pipes/shorten-string/shorten-string.pipe'
import { TranslateService } from '@ngx-translate/core'

@Injectable({
  providedIn: 'root'
})
export class ExtensionsService {
  private extensions: [new () => ICoinDelegateProtocol, () => Promise<ProtocolDelegationExtensions<any>>][] = [
    [
      KusamaProtocol,
      async () =>
        SubstrateDelegationExtensions.create(
          this.formBuilder,
          this.decimalPipe,
          this.amountConverterPipe,
          this.shortenStringPipe,
          this.translateService
        )
    ],
    [
      PolkadotProtocol,
      async () =>
        SubstrateDelegationExtensions.create(
          this.formBuilder,
          this.decimalPipe,
          this.amountConverterPipe,
          this.shortenStringPipe,
          this.translateService
        )
    ],
    [
      TezosProtocol,
      async () =>
        TezosDelegationExtensions.create(
          this.remoteConfigProvider,
          this.decimalPipe,
          this.amountConverterPipe,
          this.shortenStringPipe,
          this.translateService,
          this.formBuilder
        )
    ],
    [
      CosmosProtocol,
      async () =>
        CosmosDelegationExtensions.create(
          this.remoteConfigProvider,
          this.formBuilder,
          this.decimalPipe,
          this.amountConverterPipe,
          this.shortenStringPipe,
          this.translateService
        )
    ]
  ]

  public constructor(
    private readonly formBuilder: FormBuilder,
    private readonly decimalPipe: DecimalPipe,
    private readonly amountConverterPipe: AmountConverterPipe,
    private readonly shortenStringPipe: ShortenStringPipe,
    private readonly translateService: TranslateService,
    private readonly remoteConfigProvider: RemoteConfigProvider
  ) {}

  public async loadDelegationExtensions(): Promise<void> {
    await Promise.all(
      this.extensions.map(async ([protocol, extensionFactory]) => await ProtocolDelegationExtensions.load(protocol, extensionFactory))
    )
  }
}
