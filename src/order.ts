import {
  upbit_types as Iu,
  RequestError,
} from 'cryptocurrency.api'
import {
  floorOrderbook,
  toTimeForR,
} from './utils'
import * as I from './types'
import {
  logger,
  DefaultWriter,
  FileWriter,
  Observable,
  types as If,
  MemoryWriter,
} from 'fourdollar'
import {
  ceil,
  isEqual,
  sum,
} from 'lodash'



class OrderObservable extends Observable<I.OrderMessage> {
  constructor(sub, public readonly order: Promise<I.OrderType>) {
    super(sub)
  }
}



const writer = new DefaultWriter()
const fw = new FileWriter('./log/order.log', '1M')
const mw = new MemoryWriter()
writer.link = fw
fw.link = mw
writer.link = mw
export const orderMemory = mw

export class BBOrder {
  protected _api: I.WrapAPI
  protected _recentOrder: I.OrderMessage
  protected _recentError: I.ErrorMessage
  protected _recentUser: I.Message<unknown>
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

  setApi(api: I.WrapAPI) {
    this._api = api
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
        const res = await this._api.getOrderDetail(uuid)
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
        const timestamp = Date.now()
        return {
          where: this.name,
          name,
          timestamp,
          time: toTimeForR(timestamp),
          description: res,
        }
      }
      name = msg.name
    }
    this.log(name, await this._api.getOrderDetail(uuid))
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
          const timestamp = Date.now()
          this._recentOrder = {
            where: this.name,
            name,
            timestamp,
            time: toTimeForR(timestamp),
            description: s,
          }
          this._orders[s.uuid] = this._recentOrder
          return this._recentOrder
        }
        return null
      }
      case 'error': {
        const timestamp = Date.now()
        this._recentError = {
          where: this.name,
          name,
          timestamp,
          time: toTimeForR(timestamp),
          description: description,
        }
        return this._recentError
      }
      default: {
        const timestamp = Date.now()
        return {
          where: this.name,
          name,
          timestamp,
          time: toTimeForR(timestamp),
          description: description,
        }
      }
    }
  }

  protected async _updateOrdersChance(market: string) {
    BBOrder._chance[market] = await this._api.getOrdersChance()
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
      const fee = (mt === 'maker')? chance.maker_bid_fee : chance.bid_fee
      if(chance.bid_account.balance >= volume + (volume * fee)) {
        await this._updateOrdersChance(market)
      }
    }
    const chance = BBOrder._chance[market]
    const min = chance.market.bid.min_total
    if(volume < min) {
      return 0
    }
    const fee = (mt === 'maker')? chance.maker_bid_fee : chance.bid_fee
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



export class SimpleOrder extends BBOrder {
  static readonly timeout = (1000 * 60 * 3)
  readonly where: string
  protected _balance: {
    ori: number
    dest: number
  }
  protected _apiSub: If.Subscription
  protected _losscutObs: {
    observer: Observable<number>
    subObss: If.SubscriptionObserver<number>[]
  } = {
    observer: new Observable(sub => {
      this._losscutObs.subObss.push(sub)
    }),
    subObss: [],
  }

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
   * 손절 (losscut) ---
   * price 밑으로 손절 예약한다.
   * losscut 조건이 충족되었을 시 모든 매매보다 우위에 있으므로 모든 매매예약을 취소하고 손절한다. 
   * @param price price(가격) 밑으로 떨어지면 손절한다.
   * @param timeout 손절 매도 타임아웃 시간.
   * @returns observer. 손절 조건이 충족되었을 시 이벤트 발생.
   */
  losscutPrice(price: number, timeout: number = SimpleOrder.timeout): Observable<number> {
    this._losscutObs.subObss = []
    this._losscutPrice(price, timeout)
    return this._losscutObs.observer
  }

  /**
   * 손절 (losscut) ---
   * 현재가의 pct(percentage)로 losscut을 예약한다.
   * 예: 현재가가 100이고 pct를 0.98(losscut(0.98))설정했을 경우 현재가가 98밑으로 떨어지면 손절한다.
   * losscut 조건이 충족되었을 모든 매매보다 우위에 있으므로 모든 매매예약을 취소하고 손절한다. 
   * @param percentage 현재가의 losscut percentage (0 < percentage < 1 이어야 한다.)
   * @param timeout 손절 매도 timeout.
   * @returns observer. 손절 조건이 충족되었을 시 이벤트 발생.
   */
  losscutPct(percentage: number, timeout: number = SimpleOrder.timeout): Observable<number> {
    try {
      if(!(percentage > 0 && percentage < 1)) {
        throw new Error('losscut percentage는 0보다 크고 1보다 작아야 한다.')
      }
    } catch(e) {
      this._processError(e, null)
    }
    this._losscutObs.subObss = []
    const sub = this._api.observer('BID').subscribe({
      next: bid => {
        sub.unsubscribe()
        const price = bid * percentage
        this._losscutPrice(price, timeout)
      }
    })
    return this._losscutObs.observer
  }

  protected _losscutPrice(price: number, timeout: number = SimpleOrder.timeout): boolean  {
    try {
      this._apiSub?.unsubscribe()
      const sub = this._api.observer('BID').subscribe({
        next: async bid => {
          try {
            if(bid < price) {
              if(this.msg.order) {
                const order = this.msg.order
                if(order.name === 'ask' 
                && order.description.ord_type === 'limit'
                && order.description.state === 'wait'
                && order.description.price >= price) {
                  await this.cancel(order.description.uuid)
                  return
                }
                const status = await this.makeAsk({price: bid, timeout: {ms: timeout}})
                if(status) {
                  for(let s of this._losscutObs.subObss) {
                    await s.next(bid)
                  }
                  for(let s of this._losscutObs.subObss) {
                    s.complete()
                  }
                  this.log('losscut', {
                    losscut: price,
                    current: bid,
                  })
                }
              }
            }
          } catch(e) {
            for(let s of this._losscutObs.subObss) {
              s.error(e)
            }
            for(let s of this._losscutObs.subObss) {
              s.complete()
            }
          }
        }
      })
      this._apiSub = sub
      return true
    } catch(e) {
      this._processError(e, null)
      return false
    }
  }

  /**
   * 손절 예약을 취소한다.
   */
  cancelLosscut(): void {
    this._apiSub?.unsubscribe()
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
    if(!msg) {
      return null
    }
    if(msg.name === 'cancel_bid' || msg.name === 'cancel_ask') {
      return null
    }
    if(!(msg.description.ord_type === 'limit' && msg.description.state === 'wait')) {
      return null
    }
    try {
      const status = await this._api.cancel(msg.description.uuid)
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
      if(e.code) {
        const reqErr: RequestError = e
        // 매매가 done인걸 미쳐 인식하지 못했을 때 (updateOrderStatus() 하지 않았을 때)
        if(reqErr.code === 'order_not_found') {
          return null
        }
      }
      return this._processError(e, null)
    }
  }

  /**
   * 지정가 매수: timeout 되면 cancel 된다.
   * 앞선 매수 주문이 있을 시 무시된다. 앞선 지정가 매도 주문이 있을 시 주문을 취소한다.
   * @param price 매수 가격
   * @returns
   */
  makeBid(price?: number): Promise<I.OrderType>
  /**
   * 지정가 매수: timeout 되면 cancel 된다. (단, timeout callback이 없을 때)
   * 앞선 매수 주문이 있을 시 무시된다. 앞선 지정가 매도 주문이 있을 시 주문을 취소한다.
   * @param params price: 매수 가격, timeout.ms: timeout 시간, timeout.cb: timeout callback 함수, errCb: 에러 콜백
   * @returns
   */
  makeBid(params: {
    price?: number
    timeout?: {
      ms?: number
      cb?: (msg: I.OrderMessage) => void
    }
    errCb?: (err) => void
  }): Promise<I.OrderType>
  async makeBid(arg: any): Promise<I.OrderType> {
    let price: number
    let ms: number
    let cb: (msg: I.OrderMessage) => void
    let errCb: (err) => void
    if(typeof(arg) === 'number') {
      price = arg
    } else if(arg?.price) {
      price = arg.price
    } else {
      try {
        price = this._api.getPrice('BID')
      } catch(e) {
        this.log('error', e)
        return null
      }
    }
    ms = arg?.timeout?.ms || SimpleOrder.timeout
    cb = arg?.timeout?.cb
    errCb = arg?.errCb
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
      const status = await this._api.order(orderParams)
      this.cancelLosscut()
      this.log('bid', status) && await this._updateOrdersChance(this.market)
      setTimeout(async () => {
        let msg = this._searchOrderMsg(status.uuid)
        if(msg.description.state === 'wait') {
          msg = await this.updateOrderStatus(status.uuid)
        }
        if(cb) {
          await cb(msg)
        } else if(msg.name === 'bid' && msg.description.state === 'wait') {
          await this.cancel(status.uuid)
        }
      }, ms)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  /**
   * 지정가 매수 Observer
   * @param price 매수 가격
   * @returns Observable
   */
  makeBidObs(price?: number): OrderObservable
  /**
   * 지정가 매수 Observer
   * @param params price 매수 가격, timeout: 타임아웃 시간
   * @returns Observable
   */
  makeBidObs(params: {price?: number, timeout?: number}): OrderObservable
  makeBidObs(arg: any): OrderObservable {
    let price: number
    let timeout: number
    if(typeof(arg) === 'number') {
      price = arg
    } else if(arg !== undefined) {
      price = arg.price
      timeout = arg.timeout
    }
    timeout = timeout? timeout : SimpleOrder.timeout
    const subs = []
    const observer = new OrderObservable(sub => {
      subs.push(sub)
    }, this.makeBid({
      price,
      timeout: {
        ms: timeout,
        cb: msg => {
          for(let s of subs) {
            s.next(msg)
          }
          for(let s of subs) {
            s.complete()
          }
        },
      },
      errCb: err => {
        for(let s of subs) {
          s.error(err)
        }
        for(let s of subs) {
          s.complete()
        }
      },
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
      const status = await this._api.order(orderParams)
      this.cancelLosscut()
      this.log('bid', status) && await this._updateOrdersChance(this.market)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  /**
   * 지정가 매도: timeout 되면 cancel 된다.
   * 앞선 매도 주문이 있을 시 무시된다. 앞선 지정가 매수 주문이 있을 시 주문을 취소한다.
   * @param price 매도 가격
   */
  makeAsk(price?: number): Promise<I.OrderType>
  /**
   * 지정가 매도: timeout 되면 cancel 된다. (단, timeout callback이 없을 때)
   * 앞선 매도 주문이 있을 시 무시된다. 앞선 지정가 매수 주문이 있을 시 주문을 취소한다.
   * @param params price: 매도 가격, timeout.ms: 타임아웃 시간, cb: timeout callback 함수, errCb: 에러 콜백
   */
  makeAsk(params: {
    price?: number
    timeout?: {
      ms?: number
      cb?: (msg: I.OrderMessage) => void
    }
    errCb?: (err) => void
  }): Promise<I.OrderType>
  async makeAsk(arg: any): Promise<I.OrderType> {
    let price: number
    let ms: number
    let cb: (msg: I.OrderMessage) => void
    let errCb: (err) => void
    if(typeof(arg) === 'number') {
      price = arg
    } else if(arg?.price) {
      price = arg.price
    } else {
      try {
        price = this._api.getPrice('ASK')
      } catch(e) {
        this.log('error', e)
        return null
      }
    }
    ms = arg?.timeout?.ms || SimpleOrder.timeout
    cb = arg?.timeout?.cb
    errCb = arg?.errCb
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
      const status = await this._api.order(orderParams)
      this.log('ask', status) && await this._updateOrdersChance(this.market)
      setTimeout(async () => {
        let msg = this._searchOrderMsg(status.uuid)
        if(msg.description.state === 'wait') {
          msg = await this.updateOrderStatus(status.uuid)
        }
        if(cb) {
          cb(msg)
        } else if(msg.name === 'ask' && msg.description.state === 'wait') {
          await this.cancel(msg.description.uuid)
        }
      }, ms)
      return status
    } catch(e) {
      return this._processError(e, errCb)
    }
  }

  /**
   * 지정가 매도 Observer
   * @param price 매도 가격
   */
  makeAskObs(price?: number): OrderObservable
  /**
   * 지정가 매도 Observer
   * @param params price: 매도 가격, timeout: 타임아웃 시간
   */
  makeAskObs(params: {price?: number, timeout?: number}): OrderObservable
  makeAskObs(arg: any): OrderObservable {
    let price: number
    let timeout: number
    if(typeof(arg) === 'number') {
      price = arg
    } else if(arg !== undefined) {
      price = arg.price
      timeout = arg.timeout
    }
    timeout = timeout? timeout : SimpleOrder.timeout
    const subs = []
    const observer = new OrderObservable(sub => {
      subs.push(sub)
    }, this.makeAsk({
      price,
      timeout: {
        ms: timeout,
        cb: msg => {
          for(let s of subs) {
            s.next(msg)
          }
          for(let s of subs) {
            s.complete()
          }
        },
      },
      errCb: err => {
        for(let s of subs) {
          s.error(err)
        }
        for(let s of subs) {
          s.complete()
        }
      },
    }))
    return observer
  }

  /**
   * 시장가 매도
   * 앞선 시장가 매도 주문이 있을 시 무시된다.
   * 앞선 지정가 매도 주문이 있을 시 주문을 취소한다.
   * 앞선 지정가 매수 주문이 있을 시 주문을 취소한다.
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
      let price: number
      try {
        price = this._api.getPrice('BID')
      } catch(e) {
        this.log('error', e)
        return null
      }
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
      const status = await this._api.order(orderParams)
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