import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  format,
} from 'fecha'
import {
  ceil,
  floorOrderbook,
  floor,
} from './utils'
import {
  ensureDirSync,
  WriteStream,
  createWriteStream,
} from 'fs-extra'
import {
  dirname,
} from 'path'
import {
  readFile,
} from 'fs/promises'
import * as I from './types'
import {
  stop,
} from 'fourdollar'
import {
  isEqual,
} from 'lodash'
import {
  BaseSocketBot
} from './base.bot'
import { v4 as uuidv4 } from 'uuid'


abstract class BaseOrder {
  private _history: I.HistoryType
  protected _canceling = false
  protected _isTerminated = false

  constructor(protected readonly api: UPbit) {
    this._history = {
      bid: [],
      ask: [],
      errorBid: [],
      errorAsk: [],
    }
  }

  get status(): Iu.OrderDetailType {
    return this.statusAsk || this.statusBid
  }

  get statusBid(): Iu.OrderDetailType {
    if(this._history.bid.length === 0) {
      return null
    }
    return this._history.bid[this._history.bid.length - 1]
  }

  get statusAsk(): Iu.OrderDetailType {
    if(this._history.ask.length === 0) {
      return null
    }
    return this._history.ask[this._history.ask.length - 1]
  }

  get error(): any {
    return this.errorAsk || this.errorBid
  }

  get errorBid(): any {
    if(this._history.errorBid.length === 0) {
      return null
    }
    return this._history.errorBid[this._history.errorBid.length -1]
  }

  get errorAsk(): any {
    if(this._history.errorAsk.length === 0) {
      return null
    }
    return this._history.errorAsk[this._history.errorAsk.length - 1]
  }
  
  get history(): I.HistoryType {
    return this._history
  }

  get isTerminated(): boolean {
    return this._isTerminated
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.updateStatusAsk() || await this.updateStatusBid()
  }

  async updateStatusBid(): Promise<Iu.OrderDetailType> {
    if(!this.statusBid) {
      return null
    }
    this.updateHistory((await this.api.getOrderDetail({uuid: this.statusBid.uuid})).data)
    return this.statusBid as Iu.OrderDetailType
  }

  async updateStatusAsk(): Promise<Iu.OrderDetailType> {
    if(!this.statusAsk) {
      return null
    }
    this.updateHistory((await this.api.getOrderDetail({uuid: this.statusAsk.uuid})).data)
    return this.statusAsk as Iu.OrderDetailType
  }

  async wait(args: {
    ms: number
    timeout: number
  } = {
    ms: 300,
    timeout: 20,
  }, cb?: (status: Iu.OrderDetailType) => void) {
    if(args === null) {
      args = {
        ms: 300,
        timeout: 20,
      }
    }
    const s1 = this.status
    for(let i = 0; i < args.timeout; i++) {
      await stop(args.ms)
      const s2 = await this.updateStatus()
      if(s2.state !== s1.state) {
        break
      }
    }
    if(cb) {
      cb(this.status)
    }
    return this.status
  }

  async cancel(): Promise<Iu.OrderType> {
    if(!this.status) {
      return null
    }
    if(this._canceling === true) {
      return this.status
    }
    this._canceling = true
    try {
      const res = (await this.api.cancel({
        uuid: this.status.uuid
      })).data
      this.updateHistory(res)
      return res
    } catch(e) {
      return this.processError(this.status.side, e, () => {})
    }
  }

  async cancelWaiting(ms: number = 300, timeout: number = 20): Promise<Iu.OrderType> {
    if(!this.status) {
      return null
    }
    if(this._canceling === true) {
      if(this.status.state === 'cancel') {
        return this.status
      }
      if(this.status.state === 'wait') {
        return this.wait({ms, timeout})
      }
    }
    this._canceling = true
    try {
      const res = (await this.api.cancel({
        uuid: this.status.uuid
      })).data
      this.updateHistory(res)
      return this.wait({ms, timeout})
    } catch(e) {
      return null
    }
  }

  terminate() {
    this._isTerminated = true
  }

  protected async suitedBidVol(market: string, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const min = chance.market.bid.min_total
    const balance = chance.bid_account.balance
    volume = Math.max(volume, min)
    const suit = Math.floor(Math.min(volume, balance) / min) * min
    return suit
  }

  protected async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const chance = (await this.api.getOrdersChance({market})).data
    const balance = chance.ask_account.balance
    let suit = Math.min(volume, balance)
    if((balance - suit) < (chance.market.ask.min_total / price)) {
      suit = balance
    }
    return suit
  }

  protected processError(side: 'bid'|'ask', err: any, errCb: (err) => void) {
    if(side === 'bid') {
      this._history.errorBid.push(this.jsonError(err))
    } else {
      this._history.errorAsk.push(this.jsonError(err))
    }
    if(errCb) {
      errCb(err)
    } else {
      throw err
    }
    return null
  }
  
  protected jsonError(err: any) {
    const stringify = JSON.stringify(err)
    const json = JSON.parse(stringify)
    if(err.name) {
      json.name = err.name
    }
    if(err.message) {
      json.message = err.message
    }
    return json
  }

  protected updateHistory(status: Iu.OrderType | Iu.OrderDetailType) {
    const s = status as Iu.OrderDetailType
    if(!s.trades) {
      Object.assign(s, {trades: []})
    }
    if(s.side === 'bid') {
      if(!this.statusBid) {
        this._history.bid.push(s)
      }
      if(!isEqual(this.statusBid, s)) {
        this._history.bid.push(s)
      }
    } else if(s.side === 'ask') {
      if(!this.statusAsk) {
        this._history.ask.push(s)
      }
      if(!isEqual(this.statusAsk, s)) {
        this._history.ask.push(s)
      }
    }
  }

  abstract bid(...args: any[]): Promise<Iu.OrderType>
  abstract ask(...args: any[]): Promise<Iu.OrderType>
}



export class Order extends BaseOrder {
  constructor(api: UPbit) {
    super(api)
  }

  /**
   * 지정가 매수
   * params: {market: 마켓 코드, price: 주문할 가격, volume: 주문량이 아니라 주문할 금액이다. 예를 들어 'KRW-BTC'이고 '10000'이라면 '10000KRW' 금액으로 주문한다.} params
   * @param
   * @returns
   */
  async bid(params: {
    market: string
    price: number
    volume: number
  }, err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
      try {
        const price = floorOrderbook(params.price)
        const volume = await this.suitedBidVol(params.market, params.volume)
        const orderParams: Iu.OrderLimitParam = {
          market: params.market,
          side: 'bid',
          ord_type: 'limit',
          price,
          volume: ceil(volume / price, 8),
        }
        this.updateHistory((await this.api.order(orderParams)).data)
        this._canceling = false
        return this.statusBid
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  async ask(params: {
    price: number
  }, err?: (err) => void) {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const price = floorOrderbook(params.price)
        const volume = await this.suitedAskVol(status.market, price, this.statusBid.executed_volume)
        const orderParams: Iu.OrderLimitParam = {
          market: status.market,
          side: 'ask',
          ord_type: 'limit',
          price: price,
          volume,
        }
        this.updateHistory((await this.api.order(orderParams)).data)
        this._canceling = false
        return this.statusAsk
      } catch(e) {
        return this.processError('ask', e, err)
      }
    } else {
      return status
    }
  }
}



export class OrderMarket extends BaseOrder {
  constructor(api: UPbit) {
    super(api)
  }

  /**
   * 시장가 매수
   * params: {market: 마켓코드, price: 이 가격에 매수가 아니라 이 양만큼 매수 한다. 10000이라면 10000KRW 이다. }
   * @param params 
   * @returns 
   */
  async bid(params: {
    market: string
    price: number
  }, err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.state === 'cancel')) {
      try {
        const price = await this.suitedBidVol(params.market, params.price)
        const orderParams: Iu.OrderPriceParam = {
          market: params.market,
          side: 'bid',
          ord_type: 'price',
          price,
        }
        this.updateHistory((await this.api.order(orderParams)).data)
        this._canceling = false
        return this.statusBid
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  async ask(err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const price = (await this.api.getOrderbook({markets: [status.market]})).data[0].orderbook_units[0].bid_price
        const volume = await this.suitedAskVol(status.market, price, this.statusBid.executed_volume)
        const params: Iu.OrderMarketParam = {
          market: status.market,
          side: 'ask',
          ord_type: 'market',
          volume,
        }
        this.updateHistory((await this.api.order(params)).data)
        this._canceling = false
        return this.statusAsk
      } catch(e) {
        return this.processError('ask', e, err)
      }
    } else {
      return status
    }
  }
}



export class OrderHistory<C> {
  private _stream: WriteStream

  constructor(public readonly path: string) {
    const dir = dirname(path)
    ensureDirSync(dir)
    this._stream = createWriteStream(path, {
      flags: 'a',
    })
  }

  append(history: I.HistoryType, comment?: C): Promise<I.HistoryFileType<C>>  {
    const t = new Date()
    const contents = Object.assign(Object.assign({}, history), {
      time_stamp: t.getTime(),
      time: format(t, 'isoDateTime'),
      comment,
    }) as I.HistoryFileType<C>
    const stringify = '\n\n' + JSON.stringify(contents, null, 2)
    return new Promise((resolve, reject) => {
      this._stream.write(stringify, err => {
        if(err) {
          reject(err)
          return
        }
        resolve(contents)
      })
    })
  }

  async read(): Promise<I.HistoryFileType<C>[]> {
    const stringify = (await readFile(this.path)).toString()
    const splited = stringify.split('\n\n')
    splited.splice(0, 1)
    return splited.map(h => JSON.parse(h))
  }
}



export class OrderMarketMock extends BaseOrder {
  constructor(private readonly bot: BaseSocketBot) {
    super(null)
  }

  async updateStatus(): Promise<Iu.OrderDetailType> {
    return await this.updateStatusAsk() || await this.updateStatusBid()
  }

  async updateStatusBid(): Promise<Iu.OrderDetailType> {
    return this.statusBid
  }

  async updateStatusAsk(): Promise<Iu.OrderDetailType> {
    return this.statusAsk
  }

  cancel() {
    return this.updateStatus()
  }
  
  wait = null
  cancelWaiting = null

  /**
   * 시장가 매수
   * params: {market: 마켓코드, price: 이 가격에 매수가 아니라 이 양만큼 매수 한다. 10000이라면 10000KRW 이다. }
   * @param params 
   * @returns 
   */
  async bid(params: {
    market: string
    price: number
  }, err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.state === 'cancel')) {
      try {
        const tr = this.bot.latest(I.ReqType.Trade)
        const price = params.price
        const volume = price / tr.trade_price
        const uuid = uuidv4()
        const status1: Iu.OrderType = {
          uuid,
          side: 'bid',
          ord_type: 'price',
          price: price,
          state: 'wait',
          market: params.market,
          created_at: format(new Date(tr.timestamp), 'isoDateTime'),
          volume: null,
          remaining_volume: null,
          reserved_fee: floor(params.price * 0.0005, 8),
          remaining_fee: floor(params.price * 0.0005, 8),
          paid_fee: 0,
          locked: floor(params.price + (params.price * 0.0005), 8),
          executed_volume: 0,
          trades_count: 0,
        }
        const status2: Iu.OrderDetailType = {
          uuid,
          side: 'bid',
          ord_type: 'price',
          price: price,
          state: 'cancel',
          market: params.market,
          created_at: format(new Date(tr.timestamp), 'isoDateTime'),
          volume: null,
          remaining_volume: null,
          reserved_fee: floor(price * 0.0005, 8),
          remaining_fee: 0,
          paid_fee: floor(price * 0.0005, 8),
          locked: 0,
          executed_volume: floor(volume, 8),
          trades_count: 1,
          trades: [
            {
              market: params.market,
              uuid: uuidv4(),
              price: tr.trade_price,
              volume: floor(volume, 8),
              funds: floor(tr.trade_price * volume, 4),
              created_at: format(new Date(tr.timestamp), 'isoDateTime'),
              side: 'bid',
            },
          ],
        }
        this.updateHistory(status1)
        this.updateHistory(status2)
        return status1
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  async ask(err?: (err) => void): Promise<Iu.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const tr = this.bot.latest(I.ReqType.Trade)
        const volume = status.executed_volume
        const uuid = uuidv4()
        const status1: Iu.OrderType = {
          uuid,
          side: 'ask',
          ord_type: 'market',
          price: null,
          state: 'wait',
          market: status.market,
          created_at: format(new Date(tr.timestamp), 'isoDateTime'),
          volume: floor(volume, 8),
          remaining_volume: floor(volume, 8),
          reserved_fee: 0,
          remaining_fee: 0,
          paid_fee: 0,
          locked: floor(volume, 8),
          executed_volume: 0,
          trades_count: 0,
        }
        const status2: Iu.OrderDetailType = {
          uuid,
          side: 'ask',
          ord_type: 'market',
          price: null,
          state: 'done',
          market: status.market,
          created_at: format(new Date(tr.timestamp), 'isoDateTime'),
          volume: floor(volume, 8),
          remaining_volume: 0,
          reserved_fee: 0,
          remaining_fee: 0,
          paid_fee: floor(tr.trade_price * volume * 0.0005, 8),
          locked: 0,
          executed_volume: floor(volume, 8),
          trades_count: 1,
          trades: [
            {
              market: status.market,
              uuid: uuidv4(),
              price: tr.trade_price,
              volume: floor(volume, 8),
              funds: floor(tr.trade_price * volume, 4),
              created_at: format(new Date(tr.timestamp), 'isoDateTime'),
              side: 'ask',
            },
          ],
        }
        this.updateHistory(status1)
        this.updateHistory(status2)
        return status1
      } catch(e) {
        return this.processError('ask', e, err)
      }
    } else {
      return status
    }
  }

  // private async suitedBidVol(market: string, volume: number): Promise<number> {
  //   const chance = (await this.api.getOrdersChance({market})).data
  //   const min = chance.market.bid.min_total
  //   if(volume < min) {
  //     throw new OrderError(`주문금액이 최소주문금액 보다 적다. (volume: ${volume}, min: ${min})`)
  //   }
  //   const suit = Math.floor(volume / min) * min
  //   return suit
  // }

  // private async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
  //   const chance = (await this.api.getOrdersChance({market})).data
  //   const min = chance.market.ask.min_total
  //   const minVol = floor(min / price, 8)
  //   const suit = Math.max(volume, minVol)
  //   return suit
  // }
}
