import { ICoinDelegateProtocol } from 'airgap-coin-lib'
import { UIWidget } from '../models/widgets/UIWidget'
import BigNumber from 'bignumber.js'
import { DelegateeDetails, DelegatorDetails } from 'airgap-coin-lib/dist/protocols/ICoinDelegateProtocol'

export interface AirGapDelegateeUsageDetails {
  usage: BigNumber
  current: BigNumber
  total: BigNumber
}

export interface AirGapMainDelegatorAction {
  type?: any
  isAvailable: boolean
  description: string
  paramName?: string
  extraArgs?: UIWidget[]
}

export interface AirGapExtraDelegatorAction {
  type: any
  label: string
  confirmLabel: string
  description: string
  args?: UIWidget[]
}

export interface AirGapDelegateeDetails extends DelegateeDetails {
  status: string
  usageDetails: AirGapDelegateeUsageDetails
  extraDetails?: UIWidget[]
}

export interface AirGapDelegatorDetails extends DelegatorDetails {
  delegateAction: AirGapMainDelegatorAction
  undelegateAction: AirGapMainDelegatorAction
  extraActions?: AirGapExtraDelegatorAction[]
  extraDetails?: UIWidget[]
}

export interface IAirGapCoinDelegateProtocol extends ICoinDelegateProtocol {
  delegateeLabel: string
  getExtraDelegateeDetails(address: string): Promise<Partial<AirGapDelegateeDetails>>
  getExtraDelegatorDetailsFromAddress(address: string): Promise<Partial<AirGapDelegatorDetails>>
}
