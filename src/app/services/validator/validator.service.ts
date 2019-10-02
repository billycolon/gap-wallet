import { CosmosProtocol } from 'airgap-coin-lib'
import { BigNumber } from 'bignumber.js'
import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'

export interface Uptime {
  address: string
  missed_blocks: number
  over_blocks: number
}

export interface CosmosValidatorInfo {
  rate: string
  status: string
  totalDelegationBalance: string
}

@Injectable({
  providedIn: 'root'
})
export class ValidatorService {
  private readonly cosmoStationBaseUrl = 'https://api.cosmostation.io/v1/'
  constructor(private readonly http: HttpClient) {}

  public async getValidatorInfos(address: string): Promise<CosmosValidatorInfo> {
    const statusCodes = { 0: 'jailed', 1: 'inactive', 2: 'active' }
    const protocol = new CosmosProtocol()
    try {
      const validator = await protocol.fetchValidator(address)
      return {
        rate: `${(parseFloat(validator.commission.rate) * 100).toString()}%`,
        status: statusCodes[validator.status],
        totalDelegationBalance: `${new BigNumber(validator.tokens).shiftedBy(-1 * protocol.decimals).toString()}` // TODO display in a nice format
      }
    } catch {
      return {
        rate: 'unknown',
        status: 'unknown',
        totalDelegationBalance: 'unknown'
      }
    }
  }
}
