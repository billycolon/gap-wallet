import {
  GetDevicesMessageReply,
  LedgerElectronBridge,
  LedgerProcessMessageType,
  OpenMessageReply,
  SendMessageReply,
  ExchangeMessageReply
} from './bridge/LedgerElectronBridge'
import { LedgerConnection, LedgerConnectionType, LedgerTransport } from './LedgerTransport'

import Transport from '@ledgerhq/hw-transport'

class TransportElectron implements Transport {
  constructor(private readonly id: string, private readonly bridge: LedgerElectronBridge) {}

  public async send(cla: number, ins: number, p1: number, p2: number, data?: Buffer, _statusList?: readonly number[]): Promise<Buffer> {
    const { response }: SendMessageReply = await this.bridge.sendToLedger(
      LedgerProcessMessageType.SEND,
      {
        transportId: this.id,
        cla,
        ins,
        p1,
        p2,
        hexData: data ? data.toString('hex') : undefined
      },
      `${this.id}_${cla}_${ins}_${new Date().getTime().toString()}`
    )

    return Buffer.isBuffer(response) ? response : Buffer.from(response, 'hex')
  }

  public async close(): Promise<void> {
    await this.bridge.sendToLedger(
      LedgerProcessMessageType.CLOSE,
      {
        transportId: this.id
      },
      this.id
    )
  }

  public decorateAppAPIMethods(self: any, methods: string[], scrambleKey: string): void {
    this.bridge.sendToLedger(
      LedgerProcessMessageType.DECORATE_APP,
      {
        transportId: this.id,
        self,
        methods,
        scrambleKey
      },
      `${this.id}_decorateAppAPIMethods_${new Date().getTime().toString()}`
    )
  }

  public setScrambleKey(key: string): void {
    this.bridge.sendToLedger(
      LedgerProcessMessageType.SET_SCRAMBLE_KEY,
      {
        transportId: this.id,
        key
      },
      `${this.id}_setScrambleKey_${new Date().getTime().toString()}`
    )
  }

  public async exchange(apdu: Buffer): Promise<Buffer> {
    const { response }: ExchangeMessageReply = await this.bridge.sendToLedger(
      LedgerProcessMessageType.EXCHANGE,
      {
        transportId: this.id,
        apdu: apdu.toString('hex')
      },
      `${this.id}_exchange_${new Date().getTime().toString()}`
    )

    return Buffer.isBuffer(response) ? response : Buffer.from(response, 'hex')
  }

  public setExchangeTimeout(exchangeTimeout: number): void {
    this.bridge.sendToLedger(
      LedgerProcessMessageType.SET_EXCHANGE_TIMEOUT,
      {
        transportId: this.id,
        timeout: exchangeTimeout
      },
      `${this.id}_setExchangeTimeout_${new Date().getTime().toString()}`
    )
  }

  public on(_eventName: string, _cb: any): void {
    // not needed
    throw new Error('Method not implemented.')
  }

  public off(_eventName: string, _cb: any): void {
    // not needed
    throw new Error('Method not implemented.')
  }

  public setDebugMode(_debug: boolean | ((log: string) => void)): void {
    // not needed
    throw new Error('Method not implemented.')
  }
}

export class LedgerTransportElectron implements LedgerTransport {
  private static get bridge(): LedgerElectronBridge {
    return LedgerElectronBridge.getInstance()
  }

  public static async getConnectedDevices(connectionType: LedgerConnectionType): Promise<LedgerConnection[]> {
    const { devices }: GetDevicesMessageReply = await LedgerTransportElectron.bridge.sendToLedger(
      LedgerProcessMessageType.GET_DEVICES,
      {
        connectionType
      },
      connectionType
    )

    return devices
  }

  public static async open(connectionType?: LedgerConnectionType, descriptor?: string): Promise<LedgerTransportElectron> {
    const { transportId }: OpenMessageReply = await LedgerTransportElectron.bridge.sendToLedger(
      LedgerProcessMessageType.OPEN,
      {
        connectionType,
        descriptor
      },
      `${connectionType}_${descriptor}`
    )

    const transport = new TransportElectron(transportId, LedgerTransportElectron.bridge)
    return new LedgerTransportElectron(connectionType, transport)
  }

  private constructor(readonly connectionType: LedgerConnectionType, readonly hwTransport: TransportElectron) {}
}
