import * as I from './types'
import {
  Logger,
  FileWriter,
} from 'fourdollar'



export abstract class BaseSocketBot extends Logger {
  protected _queue: {
    'trade': I.ResType[]
    'orderbook': I.ResType[]
    'ticker': I.ResType[]
  } = {
    'trade': [],
    'orderbook': [],
    'ticker': [],
  }

  constructor(public readonly code: string) {
    super(code)
  }

  async trigger<T extends I.ResType>(data: T) {
    if(this._queue[data.type].length === 0) {
      this._queue[data.type].push(data)
      let d: I.ResType
      while(this._queue[data.type].length !== 0) {
        //console.log(this._queue[data.type].length)
        d = this._queue[data.type][0]
        await this._trigger(d)
        this._queue[data.type].shift()
      }
    } else {
      this._queue[data.type].push(data)
    }
  }

  private async _trigger<T extends I.ResType>(data: T) {
    switch(data.type) {
      case I.ReqType.Trade:
        await this.onTrade(data as any)
        break
      case I.ReqType.Orderbook:
        await this.onOrderbook(data as any)
        break
      case I.ReqType.Ticker:
        await this.onTicker(data as any)
        break
      default:
        throw new Error(`'${data.type}' is unknown type.`)
    }
  }

  get name() {
    return `${this.constructor.name}:${this.code}`
  }

  abstract init(): Promise<void>
  abstract onClose(): Promise<void>
  abstract onTrade(data: I.TradeType): Promise<void>
  abstract onOrderbook(data: I.OrderbookType): Promise<void>
  abstract onTicker(data: I.TickerType): Promise<void>
}


// BaseSocketBot.writer.link = new FileWriter('./log/bot.log', '1d')
// BaseSocketBot.format = ':name: < :time:\n:msg:'