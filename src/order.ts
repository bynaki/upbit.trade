import {
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  format,
} from 'fecha'
import {
  ceil,
  floorOrderbook,
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
  api
} from './utils'


abstract class BaseOrder {
  private _history: I.HistoryType
  protected _canceling = false
  protected _isTerminated = false

  constructor(public readonly market: string) {
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

  get statusBid(): I.OrderDetailType {
    if(this._history.bid.length === 0) {
      return null
    }
    return this._history.bid[this._history.bid.length - 1]
  }

  get statusAsk(): I.OrderDetailType {
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

  async updateStatus(): Promise<I.OrderDetailType> {
    return await this.updateStatusAsk() || await this.updateStatusBid()
  }

  async updateStatusBid(): Promise<I.OrderDetailType> {
    if(!this.statusBid) {
      return null
    }
    this.updateHistory((await api.getOrderDetail({uuid: this.statusBid.uuid})).data)
    return this.statusBid
  }

  async updateStatusAsk(): Promise<I.OrderDetailType> {
    if(!this.statusAsk) {
      return null
    }
    this.updateHistory((await api.getOrderDetail({uuid: this.statusAsk.uuid})).data)
    return this.statusAsk
  }

  async wait(args: {
    ms: number
    timeout: number
  } = {
    ms: 300,
    timeout: 20,
  }, cb?: (status: I.OrderDetailType) => void) {
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

  async cancel(): Promise<I.OrderType> {
    if(!this.status) {
      return null
    }
    if(this._canceling === true) {
      return this.status
    }
    this._canceling = true
    try {
      const res = (await api.cancel({
        uuid: this.status.uuid
      })).data
      this.updateHistory(res)
      return res
    } catch(e) {
      return this.processError(this.status.side, e, () => {})
    }
  }

  async cancelWaiting(ms: number = 300, timeout: number = 20): Promise<I.OrderType> {
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
      const res = (await api.cancel({
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
    const chance = (await api.getOrdersChance({market})).data
    const min = chance.market.bid.min_total
    const balance = chance.bid_account.balance
    volume = Math.max(volume, min)
    const suit = Math.floor(Math.min(volume, balance) / min) * min
    return suit
  }

  protected async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const chance = (await api.getOrdersChance({market})).data
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

  protected updateHistory(status: I.OrderType | I.OrderDetailType) {
    const s = status as I.OrderDetailType
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
}



export abstract class AbstractOrder extends BaseOrder {
  abstract bid(price: number, volume: number, err?: (err) => void): Promise<I.OrderType>
  abstract ask(price: number, err?: (err) => void)
}

export abstract class AbstractOrderMarket extends BaseOrder {
  abstract bid(price: number, err?: (err) => void): Promise<I.OrderType>
  abstract ask(err?: (err) => void): Promise<I.OrderType>
}



/**
 * 지정가 주문
 */
export class Order extends AbstractOrder {
  /**
   * 생성자
   * @param market 마켓 코드
   */
  constructor(market: string) {
    super(market)
  }

  /**
   * 지정가 매수
   * @param price 주문할 가격.
   * @param volume 주문량이 아니라 주문할 금액이다. 예를 들어 'KRW-BTC'이고 '10000'이라면 '10000KRW' 금액으로 주문한다.
   * @param err error 콜백
   * @returns 
   */
  async bid(price: number, volume: number, err?: (err) => void): Promise<I.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.ord_type === 'limit' && status.state === 'cancel')) {
      try {
        const pp = floorOrderbook(price)
        const vol = await this.suitedBidVol(this.market, volume)
        const orderParams: Iu.OrderLimitParam = {
          market: this.market,
          side: 'bid',
          ord_type: 'limit',
          price: pp,
          volume: ceil(vol / price, 8),
        }
        this.updateHistory((await api.order(orderParams)).data)
        this._canceling = false
        return this.statusBid
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  /**
   * 지정가 매도
   * @param price 매도 가격
   * @param err error 콜백
   * @returns 
   */
  async ask(price: number, err?: (err) => void) {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const pp = floorOrderbook(price)
        const volume = await this.suitedAskVol(status.market, pp, this.statusBid.executed_volume)
        const orderParams: Iu.OrderLimitParam = {
          market: status.market,
          side: 'ask',
          ord_type: 'limit',
          price: pp,
          volume,
        }
        this.updateHistory((await api.order(orderParams)).data)
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


/**
 * 시장가 주문
 */
export class OrderMarket extends AbstractOrderMarket {
  /** 
   * 생성자
   * @param market 마켓코드
   */
  constructor(market: string) {
    super(market)
  }

  /**
   * 시장가 매수
   * @param price 이 가격에 매수가 아니라 이 양만큼 매수 한다. 10000이라면 10000KRW 이다.
   * @param err error 콜백
   * @returns 
   */
  async bid(price: number, err?: (err) => void): Promise<I.OrderType> {
    const status = await this.updateStatus()
    if(!status || (status.side === 'bid' && status.state === 'cancel')) {
      try {
        const pp = await this.suitedBidVol(this.market, price)
        const orderParams: Iu.OrderPriceParam = {
          market: this.market,
          side: 'bid',
          ord_type: 'price',
          price: pp,
        }
        this.updateHistory((await api.order(orderParams)).data)
        this._canceling = false
        return this.statusBid
      } catch(e) {
        return this.processError('bid', e, err)
      }
    } else {
      return status
    }
  }

  /**
   * 시장가 매도
   * @param err error 콜백
   * @returns 
   */
  async ask(err?: (err) => void): Promise<I.OrderType> {
    const status = await this.updateStatus()
    if(!status) {
      return null
    }
    if((status.side === 'bid' && status.state === 'done')
    || (status.side === 'bid' && status.ord_type === 'price' && status.state === 'cancel')
    || (status.side === 'ask' && status.state === 'cancel')) {
      try {
        const price = (await api.getOrderbook({markets: [status.market]})).data[0].orderbook_units[0].bid_price
        const volume = await this.suitedAskVol(status.market, price, this.statusBid.executed_volume)
        const params: Iu.OrderMarketParam = {
          market: status.market,
          side: 'ask',
          ord_type: 'market',
          volume,
        }
        this.updateHistory((await api.order(params)).data)
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



export class OrderHistory<B> {
  private _stream: WriteStream

  constructor(public readonly path: string) {
    const dir = dirname(path)
    ensureDirSync(dir)
    this._stream = createWriteStream(path, {
      flags: 'a',
    })
  }

  append(history: I.HistoryType, brief?: B): Promise<I.HistoryFileType<B>>  {
    const t = new Date()
    const contents = Object.assign(Object.assign({}, history), {
      time_stamp: t.getTime(),
      time: format(t, 'isoDateTime'),
      brief,
    }) as I.HistoryFileType<B>
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

  async read(): Promise<I.HistoryFileType<B>[]> {
    const stringify = (await readFile(this.path)).toString()
    const splited = stringify.split('\n\n')
    splited.splice(0, 1)
    return splited.map(h => JSON.parse(h))
  }
}
