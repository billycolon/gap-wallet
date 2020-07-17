import { Pipe, PipeTransform } from '@angular/core'
import { getProtocolByIdentifier, ICoinProtocol } from 'airgap-coin-lib'
import { ProtocolSymbols } from 'airgap-coin-lib/dist/utils/ProtocolSymbols'
import { BigNumber } from 'bignumber.js'

@Pipe({
  name: 'amountConverter'
})
export class AmountConverterPipe implements PipeTransform {
  public transform(value: BigNumber | string | number, args: { protocolIdentifier: ProtocolSymbols; maxDigits: number }): string {
    let protocol

    try {
      protocol = getProtocolByIdentifier(args.protocolIdentifier)
    } catch (e) {
      return ''
    }

    const amount = this.transformValueOnly(value, { protocol: protocol, maxDigits: args.maxDigits })
    if (amount === undefined) {
      return ''
    }
    const result = `${amount} ${protocol.symbol}`
    return result
  }

  public transformValueOnly(value: BigNumber | string | number, args: { protocol: ICoinProtocol; maxDigits: number }): string {
    if (BigNumber.isBigNumber(value)) {
      value = value.toNumber()
    }

    if (!args.protocol || (!value && value !== 0) || isNaN(Number(value)) || (args.maxDigits && isNaN(Number(args.maxDigits)))) {
      return undefined
    }

    const BN = BigNumber.clone({
      FORMAT: {
        decimalSeparator: `.`,
        groupSeparator: `'`,
        groupSize: 3
      }
    })
    const amount = new BN(value).shiftedBy(-1 * args.protocol.decimals).decimalPlaces(args.protocol.decimals, BigNumber.ROUND_FLOOR)

    return this.formatBigNumber(amount, args.maxDigits)
  }

  public formatBigNumber(value: BigNumber, maxDigits?: number): string {
    if (!maxDigits) {
      return value.toFormat()
    }

    if (value.toFixed().length <= maxDigits) {
      return value.toFormat()
    }

    const integerValueLength = value.integerValue().toString().length
    if (integerValueLength >= maxDigits) {
      // We can omit floating point
      return this.makeFullNumberSmaller(value, maxDigits)
    }

    // Need regex to remove all unneccesary trailing zeros
    return value.toFormat(maxDigits - integerValueLength).replace(/\.?0+$/, '')
  }

  public makeFullNumberSmaller(value: BigNumber, maxDigits: number): string {
    if (value.toFixed().length <= maxDigits) {
      return value.toFormat()
    }

    let result = value.integerValue()

    if (result.toString().length <= maxDigits) {
      return result.toFormat()
    }

    if (result.toString().length <= 3) {
      return result.toFormat()
    }

    // number is too long, take 3 digits away and try again
    result = result.dividedToIntegerBy(1000)

    if (result.toFixed().length <= maxDigits) {
      return result.toFormat() + 'K'
    }

    if (result.toFixed().length <= 3) {
      return result.toFormat() + 'K'
    }

    // number is too long, take 3 digits away and try again
    result = result.dividedToIntegerBy(1000)

    return result.toFormat() + 'M'
  }
}
