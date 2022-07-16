import {
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  format,
} from 'fecha'
import {
  api,
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
  logger,
  DefaultWriter,
  FileWriter,
} from 'fourdollar'
import {
  ceil,
  isEqual,
  sum,
} from 'lodash'
import Observable from 'zen-observable'




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
  } | null = {
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
    console.log(`bid.min_total: ${min}`)
    const balance = chance.bid_account.balance
    console.log(`bid_account.balance: ${balance}`)
    volume = Math.max(volume, min)
    const suit = Math.floor(Math.min(volume, balance) / min) * min
    console.log(`suit: ${suit}`)
    // ----
    console.log(`ask_account.balance: ${chance.ask_account.balance}`)
    console.log(`ask.min_total: ${chance.market.ask.min_total}`)
    return suit
  }

  protected async suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const chance = (await api.getOrdersChance({market})).data
    const balance = chance.ask_account.balance
    let suit = Math.min(volume, balance)
    if((balance - suit) < (chance.market.ask.min_total / price)) {
      suit = balance
    }
    if(suit < (chance.market.ask.min_total / price)) {
      suit = 0
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
        console.log(`vol: ${vol}`)
        const orderParams: Iu.OrderLimitParam = {
          market: this.market,
          side: 'bid',
          ord_type: 'limit',
          price: pp,
          volume: ceil(vol / pp, 8),
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
  async ask(price: number, err?: (err) => void): Promise<I.OrderDetailType> {
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



class OrderObservable extends Observable<I.OrderMessage> {
  constructor(sub, public readonly order: Promise<I.OrderType>) {
    super(sub)
  }
}





const writer = new DefaultWriter()
writer.link = new FileWriter('./log/order.log', '1d')

abstract class BBOrder {
  protected _recentOrder: I.OrderMessage = null
  protected _recentError: I.ErrorMessage = null
  protected _recentUser: I.Message<unknown> = null
  protected _orders: {[uuid: string]: I.OrderMessage} = {}
  protected static _chance: {[market: string]: Iu.OrderChanceType} = {}

  constructor(public readonly market: string) {
  }

  get name() {
    return this.market
  }

  get msg(): {
    order: I.OrderMessage
    error: I.ErrorMessage
    user: I.Message<unknown>
  } {
    return {
      order: this._recentOrder,
      error: this._recentError,
      user: this._recentUser,
    }
  }

  protected _searchOrderMsg(uuid: string): I.OrderMessage {
    return this._orders[uuid]
  }

  async updateOrderStatus(uuid?: string): Promise<I.OrderMessage> {
    let name: 'bid' | 'ask' | 'cancel_bid' | 'cancel_ask'
    if(!uuid) {
      const before = this.msg.order
      if(before === null) {
        return null
      }
      name = before.name
      uuid = before.description.uuid
    } else {
      const msg = this._searchOrderMsg(uuid)
      if(!msg) {
        const res = (await api.getOrderDetail({uuid})).data
        if(res.side === 'bid') {
          if(res.ord_type === 'limit' && res.state === 'cancel') {
            name = 'cancel_bid'
          } else {
            name = 'bid'
          }
        } else if(res.side === 'ask') {
          if(res.ord_type === 'limit' && res.state === 'cancel') {
            name = 'cancel_ask'
          } else {
            name = 'ask'
          }
        }
        return {
          where: this.name,
          name,
          timestamp: Date.now(),
          description: res,
        }
      }
      name = msg.name
    }
    this.log(name, (await api.getOrderDetail({uuid})).data)
      && await this._updateOrdersChance(this.market)
    return this._recentOrder
  }

  log(name: 'bid' | 'ask' | 'cancel_bid' | 'cancel_ask', description: I.OrderDetailType): I.OrderMessage
  log(name: 'error', description: unknown): I.ErrorMessage
  log(name: string, description: unknown): I.Message<unknown>
  @logger(writer)
  log(name: string, description: unknown): I.Message<unknown> | I.OrderMessage | I.ErrorMessage {
    switch(name) {
      case 'bid':
      case 'ask':
      case 'cancel_bid':
      case 'cancel_ask': {
        const s: I.OrderDetailType = description as I.OrderDetailType
        if(!s.trades) {
          Object.assign(s, {trades: []})
        }
        const before = this._recentOrder
        if(before == null || name !== before.name || !isEqual(s, before.description)) {
          this._recentOrder = {
            where: this.name,
            name,
            timestamp: Date.now(),
            description: s,
          }
          this._orders[s.uuid] = this._recentOrder
          return this._recentOrder
        }
        return null
      }
      case 'error': {
        this._recentError = {
          where: this.name,
          name,
          timestamp: Date.now(),
          description: description,
        }
        return this._recentError
      }
      default: {
        return {
          where: this.name,
          name,
          timestamp: Date.now(),
          description: description,
        }
      }
    }
  }

  protected async _updateOrdersChance(market: string) {
    BBOrder._chance[market] = (await api.getOrdersChance({market})).data
  }

  /**
   * 알맞은 매수 물량 (KRW), 0일수 있다
   * - 구현이 좀 이상할 수 있는데 balance가 충분하지 않은 상황에서 주문을 개속 넣을때
   *   api.getOrdersChance() 연속호출을 방지하기 위해서이다.
   * @param mt 'maker' | 'taker'
   * @param market 마켓 코드
   * @param volume 희망 물량 (KRW)
   * @returns 알맞은 매수 물량 (KRW), 0일수 있다
   */
  protected async _suitedBidVol(mt: 'maker' | 'taker', market: string, volume: number): Promise<number> {
    const timestamp = Date.now()
    if(!BBOrder._chance[market] || !this.msg.order || this.msg.order.timestamp + (1000 * 60 * 10) < timestamp) {
      await this._updateOrdersChance(market)
    } else {
      const chance = BBOrder._chance[market]
      const fee = (mt === 'maker')? chance.marker_bid_fee : chance.bid_fee
      if(chance.bid_account.balance >= volume + (volume * fee)) {
        await this._updateOrdersChance(market)
      }
    }
    const chance = BBOrder._chance[market]
    const min = chance.market.bid.min_total
    if(volume < min) {
      return 0
    }
    const fee = (mt === 'maker')? chance.marker_bid_fee : chance.bid_fee
    if(chance.bid_account.balance < volume + (volume * fee)) {
      return 0
    }
    return Math.floor(volume / min) * min
  }

  /**
   * 알맞은 매도 물량 (코인 물량), 0일수 있다
   * @param market 마켓 코드
   * @param price 가격
   * @param volume 희망물량 (코인)
   * @returns 알맞은 매도 물량 (코인 물량), 0일수 있다
   */
  protected async _suitedAskVol(market: string, price: number, volume: number): Promise<number> {
    const timestamp = Date.now()
    if(!BBOrder._chance[market] || !this.msg.order || this.msg.order.timestamp + (1000 * 60 * 10) < timestamp) {
      await this._updateOrdersChance(market)
    } else if(BBOrder._chance[market].ask_account.balance >= volume) {
      await this._updateOrdersChance(market)
    }
    const chance = BBOrder._chance[market]
    const min = chance.market.ask.min_total / price
    if(volume < min ) {
      return 0
    }
    const balance = chance.ask_account.balance
    if(balance < volume) {
      return 0
    }
    let suit = volume
    if((balance - suit) < min) {
      suit = balance
    }
    return suit
  }

  protected _processError(err: any, errCb: (err) => void): null {
    this.log('error', this._jsonError(err))
    if(errCb) {
      errCb(err)
    } else {
      throw err
    }
    return null
  }

  protected _jsonError(err: any) {
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
}



const timeout = (1000 * 60 * 30)


export class SimpleOrder extends BBOrder {
  static timeout = (1000 * 60 * 30)
  protected _balance: {
    ori: number
    dest: number
  }
  readonly where: string

  constructor(name: string, market: string, public readonly asset: number) {
    super(market)
    this.where = `${name}::${market}`
    this._balance = {
      ori: asset,
      dest: 0,
    }
  }

  get name() {
    return this.where
  }

  /**
   * 주문을 취소한다.
   * @param uuid 취소할 주문 id
   * @returns 
   */
  async cancel(uuid?: string): Promise<I.OrderType> {
    let msg: I.OrderMessage
    if(!uuid) {
      msg = this.msg.order
    } else {
      msg = this._searchOrderMsg(uuid)
    }
    if(msg === null) {
      return null
    }
    if(msg.name === 'cancel_bid' || msg.name === 'cancel_ask') {
      return null
    }
    if(!(msg.description.ord_type === 'limit' && msg.description.state === 'wait')) {
      return null
    }
    try {
      const status = (await api.cancel({
        uuid: msg.description.uuid
      })).data
      switch(msg.description.side) {
        case 'bid': {
          this.log('cancel_bid', status) && await this._updateOrdersChance(this.market)
          break
        }
        case 'ask': {
          this.log('cancel_ask', status) && await this._updateOrdersChance(this.market)
          break
        }
      }
      return status
    } catch(e) {
      return this._processError(e, null)
    }
  }

  /**
   * 지정가 매수: timeout 되면 cancel 된다. (단, timeout callback이 없을 때)
   * 앞선 매수 주문이 있을 시 무시된다. 앞선 지정가 매도 주문이 있을 시 주문을 취소한다.
   * @param price 매수 가격
   * @param timeout ms: timeout 시간, cb: timeout callback 함수
   * @param errCb 에러 콜백
   * @returns 
   */
  async makeBid(price?: number, timeout: {
      ms: number
      cb?: (msg: I.OrderMessage) => void
    } = {
      ms: SimpleOrder.timeout,
    },
    errCb?: (err) => void
  ): Promise<I.OrderType> {
    try {
      const msg = this.msg.order
      if(msg) {
        if(msg.name === 'bid') {
          // 앞선 매수가 있을 시 무시된다.
          if(msg.description.state === 'wait') {
            return null
          }
        }
        if(msg.name === 'ask') {
          // 앞선 지정가 매도가 있을 시 매도를 취소한다.
          if(msg.description.ord_type === 'limit' && msg.description.state === 'wait') {
            await this.cancel(msg.description.uuid)
          }
        }
      }
      if(price === undefined || price === null) {
        const orderbook = (await api.getOrderbook({
          markets: [this.market]
        })).data[0].orderbook_units[0]
        price = orderbook.bid_price
      }
      const pp = floorOrderbook(price)
      const vol = await this._suitedBidVol('maker', this.market, this.balanceOri)
      if(vol === 0) {
        return null
      }
      const orderParams: Iu.OrderLimitParam = {
        market: this.market,
        side: 'bid',
        ord_type: 'limit',
        price: pp,
        volume: ceil(vol / pp, 8),
      }
      const status = (await api.order(orderParams)).data
      this.log('bid', status) && await this._updateOrdersChance(this.market)
      setTimeout(async () => {
        let msg = this._searchOrderMsg(status.uuid)
        if(msg.description.state === 'wait') {
          msg = await this.updateOrderStatus(status.uuid)
        }
        if(timeout.cb) {
          await timeout.cb(msg)
        } else if(msg.name === 'bid' && msg.description.state === 'wait') {
          await this.cancel(status.uuid)
        }
      }, timeout.ms)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  makeBidObs(params: {price?: number, timeout?: number} = {}): OrderObservable {
    let {price, timeout} = params
    if(timeout === undefined) timeout = SimpleOrder.timeout
    const subs = []
    const observer = new OrderObservable(sub => {
      subs.push(sub)
    }, this.makeBid(price, {
      ms: timeout,
      cb: msg => {
        for(let s of subs) {
          s.next(msg)
        }
        for(let s of subs) {
          s.complete()
        }
      },
    }, err => {
      for(let s of subs) {
        s.error(err)
      }
    }))
    return observer
  }

  /**
   * 시장가 매수: 앞선 시장가 매수 주문이 있을 시 무시된다. 앞선 지정가 매수 주문이 있을 시 주문을 취소한다.
   * 앞선 지정가 매도 주문이 있을 시 주문을 취소한다.
   * @param errCb 에러 콜백
   * @returns 
   */
  async takeBid(errCb?: (err) => void): Promise<I.OrderType> {
    try {
      const msg = this.msg.order
      if(msg) {
        if(msg.name === 'bid') {
          // 앞선 시장가 매수가 있을 시 무시된다.
          // if(msg.description.ord_type === 'price') {
          //   return null
          // }
          // 앞선 지정가 매수가 있을 시 매수를 취소한다.
          if(msg.description.ord_type === 'limit' && msg.description.state === 'wait') {
            await this.cancel(msg.description.uuid)
          }
        }
        if(msg.name === 'ask') {
          // 앞선 지정가 매도가 있을 시 매도를 취소한다.
          if(msg.description.ord_type === 'limit' && msg.description.state === 'wait') {
            await this.cancel(msg.description.uuid)
          }
        }
      }
      const vol = await this._suitedBidVol('taker', this.market, this.balanceOri)
      if(vol === 0) {
        return null
      }
      const orderParams: Iu.OrderPriceParam = {
        market: this.market,
        side: 'bid',
        ord_type: 'price',
        price: vol,
      }
      const status = (await api.order(orderParams)).data
      this.log('bid', status) && await this._updateOrdersChance(this.market)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  /**
   * 지정가 매도: timeout 되면 cancel 된다. (단, timeout callback이 없을 때)
   * 앞선 매도 주문이 있을 시 무시된다. 앞선 지정가 매수 주문이 있을 시 주문을 취소한다.
   * @param price 매도 가격
   * @param timeout ms: timeout 시간, cb: timeout callback 함수
   * @param errCb 에러 콜백
   * @returns 
   */
  async makeAsk(price?: number, timeout: {
      ms: number
      cb?: (msg: I.OrderMessage) => void
    } = {
      ms: SimpleOrder.timeout,
    },
    errCb?: (err) => void
  ): Promise<I.OrderType> {
    try {
      const msg = this.msg.order
      if(msg) {
        if(msg.name === 'ask') {
          // 앞선 매도가 있을 시 무시된다.
          if(msg.description.state === 'wait') {
            return null
          }
        }
        if(msg.name === 'bid') {
          // 앞선 지정가 매수가 있을 시 매수를 취소한다.
          if(msg.description.ord_type === 'limit' && msg.description.state === 'wait') {
            await this.cancel(msg.description.uuid)
          }
        }
      }
      if(price === undefined) {
        const orderbook = (await api.getOrderbook({
          markets: [this.market]
        })).data[0].orderbook_units[0]
        price = orderbook.ask_price
      }
      const pp = floorOrderbook(price)
      const vol = await this._suitedAskVol(this.market, pp, this.balanceDest)
      if(vol === 0) {
        return null
      }
      const orderParams: Iu.OrderLimitParam = {
        market: this.market,
        side: 'ask',
        ord_type: 'limit',
        price: pp,
        volume: vol,
      }
      const status = (await api.order(orderParams)).data
      this.log('ask', status) && await this._updateOrdersChance(this.market)
      setTimeout(async () => {
        let msg = this._searchOrderMsg(status.uuid)
        if(msg.description.state === 'wait') {
          msg = await this.updateOrderStatus(status.uuid)
        }
        if(timeout.cb) {
          timeout.cb(msg)
        } else if(msg.name === 'ask' && msg.description.state === 'wait') {
          await this.cancel(msg.description.uuid)
        }
      }, timeout.ms)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  makeAskObs(params: {price?: number, timeout?: number}= {}): OrderObservable {
    let {price, timeout} = params
    if(timeout === undefined) timeout = SimpleOrder.timeout
    const subs = []
    const observer = new OrderObservable(sub => {
      subs.push(sub)
    }, this.makeAsk(price, {
      ms: timeout,
      cb: msg => {
        for(let s of subs) {
          s.next(msg)
        }
        for(let s of subs) {
          s.complete()
        }
      },
    }, err => {
      for(let s of subs) {
        s.error(err)
      }
    }))
    return observer
  }

  /**
   * 시장가 매도: 앞선 시장가 매도 주문이 있을 시 무시된다.
   * 앞선 지정가 매도 주문이 있을 시 주문을 취소한다.
   * 앞선 지정가 매수 주뭉이 있을 시 주문을 취소한다.
   * @param errCb 에러 콜백
   * @returns 
   */
  async takeAsk(errCb?: (err) => void): Promise<I.OrderType> {
    try {
      const msg = this.msg.order
      if(msg) {
        if(msg.name === 'ask') {
          // 앞선 시장가 매도가 있을 시 무시된다.
          // if(msg.description.ord_type === 'market') {
          //   return null
          // }
          // 앞선 지정가 매도가 있을 시 매도를 취소하다.
          if(msg.description.ord_type === 'limit' && msg.description.state === 'wait') {
            await this.cancel(msg.description.uuid)
          }
        }
        if(msg.name === 'bid') {
          // 앞선 지정가 매수가 있을 시 매수를 취소한다.
          if(msg.description.ord_type === 'limit' && msg.description.state === 'wait') {
            await this.cancel(msg.description.uuid)
          }
        }
      }
      const price = (await api.getOrderbook({
        markets: [this.market]
      })).data[0].orderbook_units[0].bid_price
      const vol = await this._suitedAskVol(this.market, price, this.balanceDest)
      if(vol === 0) {
        return null
      }
      const orderParams: Iu.OrderMarketParam = {
        market: this.market,
        side: 'ask',
        ord_type: 'market',
        volume: vol,
      }
      const status = (await api.order(orderParams)).data
      this.log('ask', status) && await this._updateOrdersChance(this.market)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  /**
   * 보유 잔액(KRW) 계산
   */
  get balanceOri(): number {
    const exeIds: {[uuid: string]: number} = this._eachBalanceOri()
    let total = 0
    for(let id in exeIds) {
      total += exeIds[id]
    }
    const balance = this._balance.ori + total
    this._balanceAccount(exeIds, this._eachBalanceDest())
    return balance
  }

  /**
   * 보유 가상화폐 잔액 계산
   */
  get balanceDest(): number {
    const exeIds: {[uuid: string]: number} = this._eachBalanceDest()
    let total = 0
    for(let id in exeIds) {
      total += exeIds[id]
    }
    const balance = this._balance.dest + total
    this._balanceAccount(this._eachBalanceOri(), exeIds)
    return balance
  }

  private _eachBalanceOri(): {[uuid: string]: number} {
    const exeIds: {[uuid: string]: number} = {}
    for(let uuid in this._orders) {
      const order = this._orders[uuid]
      const s = order.description
      let exec = sum(s.trades.map(t => t.funds))
      switch(order.name) {
        case 'bid': {
          exec += s.locked + s.paid_fee
          exeIds[s.uuid] = -exec
          break
        }
        case 'cancel_bid': {
          exec += s.paid_fee
          exeIds[s.uuid] = -exec
          break
        }
        case 'ask': {
          exec -= s.paid_fee
          exeIds[s.uuid] = exec
          break
        }
        case 'cancel_ask': {
          exec -= s.paid_fee
          exeIds[s.uuid] = exec
          break
        }
      }
    }
    return exeIds
  }

  private _eachBalanceDest(): {[uuid: string]: number} {
    const exeIds: {[uuid: string]: number} = {}
    for(let uuid in this._orders) {
      const order = this._orders[uuid]
      const s = order.description
      let exec = sum(s.trades.map(t => t.volume))
      switch(order.name) {
        case 'bid': {
          exeIds[s.uuid] = exec
          break
        }
        case 'cancel_bid': {
          exeIds[s.uuid] = exec
          break
        }
        case 'ask': {
          exec += s.locked
          exeIds[s.uuid] = -exec
          break
        }
        case 'cancel_ask': {
          exeIds[s.uuid] = -exec
          break
        }
      }
    }
    return exeIds
  }

  private _balanceAccount(oris: {[uuid: string]: number}, dests: {[uuid: string]: number}) {
    const oriIds = Object.keys(oris)
    const destIds = Object.keys(dests)
    if(oriIds.length !== destIds.length) {
      throw new Error('uuid의 갯수가 같아야 한다.')
    }
    const isEqual = oriIds.every(id => {
      return destIds.some(did => id === did)
    })
    if(isEqual === false) {
      throw new Error('서로의 uuid들의 교집합과 합집합은 같아야 한다.')
    }
    const uuids = oriIds
    for(let id of uuids) {
      const order = this._orders[id]
      const status = order.description
      switch(order.name) {
        case 'bid': {
          if(status.ord_type === 'limit' && status.state === 'done') {
            this._balance.ori += oris[id]
            this._balance.dest += dests[id]
            delete this._orders[id]
          }
          if(status.ord_type === 'price') {
            this._balance.ori += oris[id]
            this._balance.dest += dests[id]
            delete this._orders[id]
          }
          break
        }
        case 'ask': {
          if(status.ord_type === 'limit' && status.state === 'done') {
            this._balance.ori += oris[id]
            this._balance.dest += dests[id]
            delete this._orders[id]
          }
          if(status.ord_type === 'market') {
            this._balance.ori += oris[id]
            this._balance.dest += dests[id]
            delete this._orders[id]
          }
          break
        }
        case 'cancel_bid':
        case 'cancel_ask': {
          this._balance.ori += oris[id]
          this._balance.dest += dests[id]
          delete this._orders[id]
          break
        }
      }
    }
  }
}