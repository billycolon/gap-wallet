import { Pipe, PipeTransform } from '@angular/core'
import { getProtocolByIdentifier } from 'airgap-coin-lib'
import { ProtocolSymbols } from 'airgap-coin-lib/dist/utils/ProtocolSymbols'
import { BigNumber } from 'bignumber.js'

@Pipe({
  name: 'cryptoToFiat'
})
export class CryptoToFiatPipe implements PipeTransform {
  public transform(value: BigNumber, args: { protocolIdentifier: ProtocolSymbols; currentMarketPrice: BigNumber }): any {
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
      protocol = getProtocolByIdentifier(args.protocolIdentifier)
    } catch (e) {
      return ''
    }

    const fiatValue = args.currentMarketPrice.multipliedBy(value.shiftedBy(-1 * protocol.decimals))

    return fiatValue.toFixed()
  }
}
