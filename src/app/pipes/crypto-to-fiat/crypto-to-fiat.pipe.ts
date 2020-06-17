import { Pipe, PipeTransform } from '@angular/core'
import { getProtocolByIdentifier } from 'airgap-coin-lib'
import { BigNumber } from 'bignumber.js'
import { defaultChainNetwork } from 'src/app/services/protocols/protocols'

@Pipe({
  name: 'cryptoToFiat'
})
export class CryptoToFiatPipe implements PipeTransform {
  public transform(value: BigNumber, args: { protocolIdentifier: string; currentMarketPrice: BigNumber }): any {
    if (
      !args ||
      !args.currentMarketPrice ||
      !BigNumber.isBigNumber(args.currentMarketPrice) ||
      isNaN(args.currentMarketPrice.toNumber()) ||
      !args.protocolIdentifier ||
      !value ||
      !BigNumber.isBigNumber(value) ||
      isNaN(value.toNumber())
    ) {
      /* console.warn(
        `CryptoToFiatPipe: necessary properties missing!\n` +
          `Market Price: ${args.currentMarketPrice}\n` +
          `Protocol: ${args.protocolIdentifier}\n` +
          `Value: ${value}`
      ) */
      return ''
    }

    let protocol

    try {
      protocol = getProtocolByIdentifier(args.protocolIdentifier, defaultChainNetwork)
    } catch (e) {
      return ''
    }

    const fiatValue = args.currentMarketPrice.multipliedBy(value.shiftedBy(-1 * protocol.decimals))

    return fiatValue.toFixed()
  }
}
