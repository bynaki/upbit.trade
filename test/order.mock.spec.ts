import test from 'ava'
import {
  BaseBot,
  SimpleOrder,
  subscribe,
  UPbitSocket,
  types as I,
  UPbitTradeMock,
  UPbitCandleMock,
} from '../src'
import {
  stop,
  logger,
  MemoryWriter,
  Observable,
} from 'fourdollar'
import {
  join,
} from 'path'
import {
  format,
} from 'fecha'
import {
  floor,
  sum,
} from 'lodash'



const writer = new MemoryWriter()


class TestTradeBot extends BaseBot {
  order: SimpleOrder

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  @subscribe.start
  async start(socket: UPbitSocket) {
    this.log('started')
    this.order = this.newSimpleOrder('test', 10000)
  }

  @subscribe.finish
  async finish() {
    this.log('finished')
  }

  @subscribe.trade
  async trade(tr: I.TradeType) {
    await stop(100)
    // console.log(format(new Date(tr.trade_timestamp), 'isoDateTime'))
  }
}


/**
 * UPbitTradeMock > SimpleOrder > 지정가 매매
 */
if(true) {
  let order: SimpleOrder
  let bot: TestTradeBot
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.before(async t => {
    setTimeout(async () => {
      const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'trade_order', {
        daysAgo: 1,
        to: '00:00:00',
      })
      bot = new TestTradeBot('KRW-BTC')
      mock.addBot(bot)
      await mock.open()
    })
    await stop(5000)
    order = bot.order
    price = bot.latest(I.ReqType.Trade).trade_price
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: before stating', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, 10000)
    t.is(order.balanceDest, 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeBid(): bid maker', async t => {
    const res = await order.makeBid(bot.latest(I.ReqType.Trade).trade_price * 0.9)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
    t.is(res.ord_type, 'limit')
    t.true(res.locked > 10000 && res.locked < 10010)
    const msg = order.msg.order
    t.is(msg.name, 'bid')
    t.is(msg.description, res as I.OrderDetailType)
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: when be starting to bid', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri - order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeBid(): 미체결 매수가 있을 시 또 매수 주문을 할 수 없다.', async t => {
    const res = await order.makeBid(price * 0.9)
    t.true(res === null)
  })

  test.serial('UPbitTradeMock > SimpleOrder#cancel(): cancel the bid', async t => {
    const pre = order.msg.order
    const res = await order.cancel()
    t.is(res.uuid, pre.description.uuid)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
    const curr = order.msg.order
    t.is(curr.name, 'cancel_bid')
    t.is(curr.description.side, 'bid')
    t.is(curr.description.state, 'wait')
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: when be starting to cancel the bid', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri + order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#cancel(): wait cancel bid', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: when the bid is cancelled', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder: 미체결 매수가 있을 시 매도 주문하면 매수 주문을 취소하고 매도한다.', async t => {
    const res1 = await order.makeBid(price * 0.9)
    t.is(res1.side, 'bid')
    t.is(res1.state, 'wait')
    t.is(order.balanceOri, balanceOri - order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    const res2 = await order.makeAsk(price * 1.1)
    t.true(res2 === null)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_bid')
    t.is(msg1.description.side, 'bid')
    t.is(msg1.description.state, 'wait')
    t.is(order.balanceOri, balanceOri + msg1.description.locked)
    t.is(order.balanceDest, balanceDest)
    await stop(1000)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_bid')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri + msg2.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeBid(): timeout bid maker', async t => {
    t.timeout(4000)
    const res = await order.makeBid(price * 0.9, {ms: 1000})
    await stop(3000)
    const msg = await order.updateOrderStatus(res.uuid)
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeBid(): timeout callback', t => {
    t.plan(4)
    const before = Date.now()
    return new Observable(observer => {
      order.makeBid(price * 0.9, {ms: 1000, cb: async msg => {
        const to = Date.now()
        t.true((to - before) > 1000 && (to - before) < 2000)
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
        observer.complete()
      }})
    })
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeBidObs(): timeout observable', t => {
    t.plan(5)
    const before = Date.now()
    const observer = order.makeBidObs({price: price * 0.9, timeout: 1000})
    observer.subscribe({
      async next(msg) {
        const to = Date.now()
        t.true((to - before) > 1000 && (to - before) < 2000)
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return observer
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeBidObs(): waiting cancel', async t => {
    await stop(1000)
    t.pass()
  })

  test.serial('UPbitTradeMock > SimpleOrder: initialize balance 1', t => {
    balanceOri = 10000
    balanceDest = 0
    t.pass()
  })

  let bidPrice: number
  test.serial('UPbitTradeMock > bidPrice', async t => {
    while(true) {
      if(bot.latest(I.ReqType.Trade).ask_bid === 'BID') {
        bidPrice = bot.latest(I.ReqType.Trade).trade_price
        console.log(`bidPrice: ${bidPrice}`)
        break
      }
      await stop(100)
    }
    t.pass()
  })

  let executed_volume: number
  test.serial('UPbitTradeMock > SimpleOrder#makeBidObs(): done', t => {
    const obs = order.makeBidObs({price: bidPrice, timeout: 10000})
    t.plan(4)
    obs.subscribe({
      next(msg) {
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'done')
        executed_volume = order.msg.order.description.executed_volume
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      }
    })
    return obs
  })

  test.serial('UPbitTradeMock > SimpleOrder#balance: when the bid is done', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri - (sum(s.trades.map(t => t.funds)) + s.locked + s.paid_fee), 3))
    t.is(floor(order.balanceDest, 7), floor(balanceDest + s.executed_volume, 7))
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#cancel(): can not cancel the bid when already done', async t => {
    const res = await order.cancel()
    t.true(res === null)
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeAsk(): high price', async t => {
    const res = await order.makeAsk(price * 1.1)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
    t.is(res.ord_type, 'limit')
    t.is(res.locked, executed_volume)
    const msg = order.msg.order
    t.is(msg.name, 'ask')
    t.is(msg.description, res as I.OrderDetailType)
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: when be starting to ask', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest - order.msg.order.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#makAsk(): 미체결 매도가 있을 시 또 매도 주문을 할 수 없다.', async t => {
    const res = await order.makeAsk(price * 1.1)
    console.log(res)
    t.true(res === null)
  })

  test.serial('UPbitTradeMock > SimpleOrder#cancel(): cancel ask', async t => {
    const pre = order.msg.order
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, pre.description.uuid)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
    const curr = order.msg.order
    t.is(curr.name, 'cancel_ask')
    t.is(curr.description.side, 'ask')
    t.is(curr.description.state, 'wait')
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: when be starting to cancel the ask', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + order.msg.order.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder: wait cancel ask', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_ask')
    t.is(msg.description.side, 'ask')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitTradeMock > SimpleOrder: balance: when the ask is cancelled', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder: 미체결 매도가 있을 시 매수 주문하면 매도 주문을 취소하고 매수한다.', async t => {
    const res1 = await order.makeAsk(price * 1.1)
    t.is(res1.side, 'ask')
    t.is(res1.state, 'wait')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest - res1.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    const res2 = await order.makeBid(price * 0.9)
    t.true(res2 === null)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg1.description.locked)
    await stop(1000)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg2.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeAsk(): timeout', async t => {
    t.timeout(4000)
    const res = await order.makeAsk(price * 1.1, {ms: 1000})
    await stop(3000)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    const msg2 = await order.updateOrderStatus(res.uuid)
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.side, 'ask')
    t.is(msg2.description.state, 'cancel')
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeAsk(): timeout callback ask', t => {
    const t1 = Date.now()
    return new Observable(observer => {
      order.makeAsk(price * 1.1, {ms: 1000, cb: async msg => {
        const t2 = Date.now()
        t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${t1 - t2}`)
        observer.complete()
      }})
    })
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeAskObs(): timeout observable ask', t => {
    t.plan(5)
    const t1 = Date.now()
    const obs = order.makeAskObs({price: price * 1.1, timeout: 1000})
    obs.subscribe({
      next(msg) {
        const t2 = Date.now()
        t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'wait')
        order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${t1 - t2}`)
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return obs
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeAskObs(): waiting cancel', async t => {
    await stop(1000)
    t.pass()
  })

  test.serial('UPbitTradeMock > SimpleOrder: waiting: for it is cancelled', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_ask')
    t.is(msg.description.side, 'ask')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitTradeMock > SimpleOrder: initialize balance 2', t => {
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    console.log(`balanceOri: ${balanceOri}`)
    console.log(`balanceDest: ${balanceDest}`)
    t.pass()
  })

  let askPrice: number
  test.serial('ask price', async t => {
    while(true) {
      if(bot.latest(I.ReqType.Trade).ask_bid === 'ASK') {
        askPrice = bot.latest(I.ReqType.Trade).trade_price
        console.log(`askPrice: ${askPrice}`)
        break
      }
      await stop(100)
    }
    t.pass()
  })

  test.serial('UPbitTradeMock > SimpleOrder#makeAskObs(): done', t => {
    t.plan(4)
    const obs = order.makeAskObs({price: askPrice, timeout: 10000})
    obs.subscribe({
      next(msg) {
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'done')
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return obs
  })

  test.serial('UPbitTradeMock > SimpleOrder#balance: when the ask is done', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri + sum(s.trades.map(t => t.funds)) - s.paid_fee, 3))
    t.is(floor(order.balanceDest, 7), 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#cancel(): can not cancel when the ask is done', async t => {
    const res = await order.cancel()
    t.true(res === null)
  })
}



/**
 * UPbitTradeMock > SimpleOrder > 시장가 매매
 */
if(true) {
  let order: SimpleOrder
  let bot: TestTradeBot
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.before(async () => {
    setTimeout(async () => {
      const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'trade_order', {
        daysAgo: 1,
        to: '00:00:00',
      })
      bot = new TestTradeBot('KRW-BTC')
      mock.addBot(bot)
      await mock.open()
    })
    await stop(5000)
    order = bot.order
    price = bot.latest(I.ReqType.Trade).trade_price
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeBid(): 앞선 지정가 매수가 있을 시 매수를 취소하고 시장가로 매수 한다.', async t => {
    const makeBidId = (await order.makeBid(price * 0.9)).uuid
    const res = await order.takeBid()
    t.is(res.side, 'bid')
    t.is(res.ord_type, 'price')
    t.is(res.state, 'wait')
    const makeBidMsg = await order.updateOrderStatus(makeBidId)
    t.is(makeBidMsg.name, 'cancel_bid')
    t.is(makeBidMsg.description.uuid, makeBidId)
    await stop(5000)
    const takeBid = await order.updateOrderStatus(res.uuid)
    t.is(takeBid.name, 'bid')
    t.is(takeBid.description.ord_type, 'price')
    t.is(takeBid.description.state, 'cancel')
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeBid(): balance when bided', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri - (sum(s.trades.map(t => t.funds)) + s.locked + s.paid_fee), 3))
    t.is(floor(order.balanceDest, 7), floor(balanceDest + s.executed_volume, 7))
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeBid(): 돈이 없으면 null', async t => {
    const res = await order.takeBid()
    t.true(res === null)
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeBid(): 앞선 지정가 매도가 있을 시 매도를 취소한다.', async t => {
    const makeAskId = (await order.makeAsk(price * 1.1)).uuid
    const res = await order.takeBid()
    t.true(res === null)
    const makeAskMsg = await order.updateOrderStatus(makeAskId)
    t.is(makeAskMsg.name, 'cancel_ask')
    t.is(makeAskMsg.description.uuid, makeAskId)
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeAsk(): 앞선 지정가 매도가 있을 시 매도를 취소하고 시장가로 매도한다.', async t => {
    const makeAskId = (await order.makeAsk(price * 1.1)).uuid
    const res = await order.takeAsk()
    t.is(res.side, 'ask')
    t.is(res.ord_type, 'market')
    t.is(res.state, 'wait')
    const makeAsk = await order.updateOrderStatus(makeAskId)
    t.is(makeAsk.name, 'cancel_ask')
    t.is(makeAsk.description.uuid, makeAskId)
    await stop(2000)
    const takeAsk = await order.updateOrderStatus(res.uuid)
    t.is(takeAsk.name, 'ask')
    t.is(takeAsk.description.ord_type, 'market')
    t.is(takeAsk.description.state, 'done')
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeAsk(): balance when asked', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri + sum(s.trades.map(t => t.funds)) - s.paid_fee, 3))
    t.is(floor(order.balanceDest, 7), 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeAsk(): 돈없으면 null', async t => {
    const res = await order.takeAsk()
    t.true(res === null)
  })

  test.serial('UPbitTradeMock > SimpleOrder#takeAsk(): 앞선 지정가 매수가 있을 시 매수를 취소한다.', async t => {
    const makeBidId = (await order.makeBid(price * 0.9)).uuid
    const res = await order.takeAsk()
    t.true(res === null)
    const makeBidMsg = await order.updateOrderStatus(makeBidId)
    t.is(makeBidMsg.name, 'cancel_bid')
    t.is(makeBidMsg.description.uuid, makeBidId)
  })
}



class TestCandleBot extends BaseBot {
  order: SimpleOrder
  latestOHLC: I.OHLCType

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }
  
  @subscribe.start
  async start(socket: UPbitSocket) {
    this.log('started')
    this.order = this.newSimpleOrder('test-candle', 10000)
  }

  @subscribe.finish
  finish() {
    this.log('finished')
  }

  @subscribe.candle(1, 20)
  async m1(ohlcs: I.OHLCType[]) {
    this.latestOHLC = ohlcs[0]
    await stop(100)
  }
}

/**
 * UPbitCandleMock > SimpleOrder > 지정가 매매
 */
if(true) {
  let order: SimpleOrder
  let bot: TestCandleBot
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.before(async () => {
    setTimeout(async () => {
      const from = '2022-09-01T00:00:00+00:00'
      const to = '2022-09-02T00:00:00+00:00'
      const mock = new UPbitCandleMock(join(__dirname, 'test-mock.db'), 'candle_order', {
        from,
        to,
      })
      bot = new TestCandleBot('KRW-BTC')
      mock.addBot(bot)
      await mock.open()
    })
    await stop(2000)
    order = bot.order
    price = bot.latestOHLC.close
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: before stating', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, 10000)
    t.is(order.balanceDest, 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeBid(): bid maker', async t => {
    const res = await order.makeBid(price * 0.9)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
    t.is(res.ord_type, 'limit')
    t.true(res.locked > 10000 && res.locked < 10010)
    const msg = order.msg.order
    t.is(msg.name, 'bid')
    t.is(msg.description, res as I.OrderDetailType)
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: when be starting to bid', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri - order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeBid(): 미체결 매수가 있을 시 또 매수 주문을 할 수 없다.', async t => {
    const res = await order.makeBid(price * 0.9)
    t.true(res === null)
  })

  test.serial('UPbitCandleMock > SimpleOrder#cancel(): cancel the bid', async t => {
    const pre = order.msg.order
    const res = await order.cancel()
    t.is(res.uuid, pre.description.uuid)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
    const curr = order.msg.order
    t.is(curr.name, 'cancel_bid')
    t.is(curr.description.side, 'bid')
    t.is(curr.description.state, 'wait')
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: when be starting to cancel the bid', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri + order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#cancel(): wait cancel bid', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: when the bid is cancelled', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder: 미체결 매수가 있을 시 매도 주문하면 매수 주문을 취소하고 매도한다.', async t => {
    const res1 = await order.makeBid(price * 0.9)
    t.is(res1.side, 'bid')
    t.is(res1.state, 'wait')
    t.is(order.balanceOri, balanceOri - order.msg.order.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    const res2 = await order.makeAsk(price * 1.1)
    t.true(res2 === null)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_bid')
    t.is(msg1.description.side, 'bid')
    t.is(msg1.description.state, 'wait')
    t.is(order.balanceOri, balanceOri + msg1.description.locked)
    t.is(order.balanceDest, balanceDest)
    await stop(1000)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_bid')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri + msg2.description.locked)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeBid(): timeout bid maker', async t => {
    t.timeout(4000)
    const res = await order.makeBid(price * 0.9, {ms: 1000})
    await stop(3000)
    const msg = await order.updateOrderStatus(res.uuid)
    t.is(msg.name, 'cancel_bid')
    t.is(msg.description.side, 'bid')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeBid(): timeout callback', t => {
    t.plan(4)
    const before = Date.now()
    return new Observable(observer => {
      order.makeBid(price * 0.9, {ms: 1000, cb: async msg => {
        const to = Date.now()
        t.true((to - before) > 1000 && (to - before) < 2000)
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
        observer.complete()
      }})
    })
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeBidObs(): timeout observable', t => {
    t.plan(5)
    const before = Date.now()
    const observer = order.makeBidObs({price: price * 0.9, timeout: 1000})
    observer.subscribe({
      async next(msg) {
        const to = Date.now()
        t.true((to - before) > 1000 && (to - before) < 2000)
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${to - before}`)
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return observer
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeBidObs(): waiting cancel', async t => {
    await stop(1000)
    t.pass()
  })

  test.serial('UPbitCandleMock > SimpleOrder: initialize balance 1', t => {
    balanceOri = 10000
    balanceDest = 0
    t.pass()
  })

  let bidPrice: number
  test.serial('bidPrice', async t => {
    bidPrice = bot.latestOHLC.close
    t.pass()
  })

  let executed_volume: number
  test.serial('UPbitCandleMock > SimpleOrder#makeBidObs(): done', t => {
    const obs = order.makeBidObs({price: bidPrice, timeout: 10000})
    t.plan(4)
    obs.subscribe({
      next(msg) {
        t.is(msg.name, 'bid')
        t.is(msg.description.side, 'bid')
        t.is(msg.description.state, 'done')
        executed_volume = order.msg.order.description.executed_volume
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      }
    })
    return obs
  })

  test.serial('UPbitCandleMock > SimpleOrder#balance: when the bid is done', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri - (sum(s.trades.map(t => t.funds)) + s.locked + s.paid_fee), 3))
    t.is(floor(order.balanceDest, 7), floor(balanceDest + s.executed_volume, 7))
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#cancel(): can not cancel the bid when already done', async t => {
    const res = await order.cancel()
    t.true(res === null)
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeAsk(): high price', async t => {
    const res = await order.makeAsk(price * 1.1)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
    t.is(res.ord_type, 'limit')
    t.is(res.locked, executed_volume)
    const msg = order.msg.order
    t.is(msg.name, 'ask')
    t.is(msg.description, res as I.OrderDetailType)
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: when be starting to ask', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest - order.msg.order.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#makAsk(): 미체결 매도가 있을 시 또 매도 주문을 할 수 없다.', async t => {
    const res = await order.makeAsk(price * 1.1)
    console.log(res)
    t.true(res === null)
  })

  test.serial('UPbitCandleMock > SimpleOrder#cancel(): cancel ask', async t => {
    const pre = order.msg.order
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, pre.description.uuid)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
    const curr = order.msg.order
    t.is(curr.name, 'cancel_ask')
    t.is(curr.description.side, 'ask')
    t.is(curr.description.state, 'wait')
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: when be starting to cancel the ask', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + order.msg.order.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder: wait cancel ask', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_ask')
    t.is(msg.description.side, 'ask')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitCandleMock > SimpleOrder: balance: when the ask is cancelled', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder: 미체결 매도가 있을 시 매수 주문하면 매도 주문을 취소하고 매수한다.', async t => {
    const res1 = await order.makeAsk(price * 1.1)
    t.is(res1.side, 'ask')
    t.is(res1.state, 'wait')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest - res1.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    const res2 = await order.makeBid(price * 0.9)
    t.true(res2 === null)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg1.description.locked)
    await stop(1000)
    const msg2 = await order.updateOrderStatus()
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.state, 'cancel')
    t.is(order.balanceOri, balanceOri)
    t.is(order.balanceDest, balanceDest + msg2.description.locked)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeAsk(): timeout', async t => {
    t.timeout(4000)
    const res = await order.makeAsk(price * 1.1, {ms: 1000})
    await stop(3000)
    const msg1 = order.msg.order
    t.is(msg1.name, 'cancel_ask')
    t.is(msg1.description.side, 'ask')
    t.is(msg1.description.state, 'wait')
    const msg2 = await order.updateOrderStatus(res.uuid)
    t.is(msg2.name, 'cancel_ask')
    t.is(msg2.description.side, 'ask')
    t.is(msg2.description.state, 'cancel')
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeAsk(): timeout callback ask', t => {
    const t1 = Date.now()
    return new Observable(observer => {
      order.makeAsk(price * 1.1, {ms: 1000, cb: async msg => {
        const t2 = Date.now()
        t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'wait')
        await order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${t1 - t2}`)
        observer.complete()
      }})
    })
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeAskObs(): timeout observable ask', t => {
    t.plan(5)
    const t1 = Date.now()
    const obs = order.makeAskObs({price: price * 1.1, timeout: 1000})
    obs.subscribe({
      next(msg) {
        const t2 = Date.now()
        t.true((t2 - t1) >= 1000 && (t2 - t1) < 2000)
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'wait')
        order.cancel(msg.description.uuid)
        console.log(`timeout...! in ${t1 - t2}`)
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return obs
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeAskObs(): waiting cancel', async t => {
    await stop(1000)
    t.pass()
  })

  test.serial('UPbitCandleMock > SimpleOrder: waiting: for it is cancelled', async t => {
    await stop(1000)
    const msg = await order.updateOrderStatus()
    t.is(msg.name, 'cancel_ask')
    t.is(msg.description.side, 'ask')
    t.is(msg.description.state, 'cancel')
  })

  test.serial('UPbitCandleMock > SimpleOrder: initialize balance 2', t => {
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
    console.log(`balanceOri: ${balanceOri}`)
    console.log(`balanceDest: ${balanceDest}`)
    t.pass()
  })

  let askPrice: number
  test.serial('UPbitCandleMock > ask price', async t => {
    askPrice = bot.latestOHLC.close
    t.pass()
  })

  test.serial('UPbitCandleMock > SimpleOrder#makeAskObs(): done', t => {
    t.plan(4)
    const obs = order.makeAskObs({price: askPrice, timeout: 10000})
    obs.subscribe({
      next(msg) {
        t.is(msg.name, 'ask')
        t.is(msg.description.side, 'ask')
        t.is(msg.description.state, 'done')
      },
      complete() {
        t.pass()
      },
      error(err) {
        t.fail()
      },
    })
    return obs
  })

  test.serial('UPbitCandleMock > SimpleOrder#balance: when the ask is done', t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri + sum(s.trades.map(t => t.funds)) - s.paid_fee, 3))
    t.is(floor(order.balanceDest, 7), 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#cancel(): can not cancel when the ask is done', async t => {
    const res = await order.cancel()
    t.true(res === null)
  })
}


/**
 * UPbitCandleMock > SimpleOrder > 시장가 매매
 */
if(true) {
  let order: SimpleOrder
  let bot: TestCandleBot
  let price: number
  let balanceOri: number
  let balanceDest: number

  test.before(async () => {
    setTimeout(async () => {
      const from = '2022-09-01T00:00:00+00:00'
      const to = '2022-09-02T00:00:00+00:00'
      const mock = new UPbitCandleMock(join(__dirname, 'test-mock.db'), 'candle_order', {
        from,
        to,
      })
      bot = new TestCandleBot('KRW-BTC')
      mock.addBot(bot)
      await mock.open()
    })
    await stop(2000)
    order = bot.order
    price = bot.latestOHLC.close
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeBid(): 앞선 지정가 매수가 있을 시 매수를 취소하고 시장가로 매수 한다.', async t => {
    const makeBidId = (await order.makeBid(price * 0.9)).uuid
    const res = await order.takeBid()
    t.is(res.side, 'bid')
    t.is(res.ord_type, 'price')
    t.is(res.state, 'wait')
    const makeBidMsg = await order.updateOrderStatus(makeBidId)
    t.is(makeBidMsg.name, 'cancel_bid')
    t.is(makeBidMsg.description.uuid, makeBidId)
    await stop(2000)
    const takeBid = await order.updateOrderStatus(res.uuid)
    t.is(takeBid.name, 'bid')
    t.is(takeBid.description.ord_type, 'price')
    t.is(takeBid.description.state, 'cancel')
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeBid(): balance when bided', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri - (sum(s.trades.map(t => t.funds)) + s.locked + s.paid_fee), 3))
    t.is(floor(order.balanceDest, 7), floor(balanceDest + s.executed_volume, 7))
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeBid(): 돈이 없으면 null', async t => {
    const res = await order.takeBid()
    t.true(res === null)
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeBid(): 앞선 지정가 매도가 있을 시 매도를 취소한다.', async t => {
    const makeAskId = (await order.makeAsk(price * 1.1)).uuid
    const res = await order.takeBid()
    t.true(res === null)
    const makeAskMsg = await order.updateOrderStatus(makeAskId)
    t.is(makeAskMsg.name, 'cancel_ask')
    t.is(makeAskMsg.description.uuid, makeAskId)
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeAsk(): 앞선 지정가 매도가 있을 시 매도를 취소하고 시장가로 매도한다.', async t => {
    const makeAskId = (await order.makeAsk(price * 1.1)).uuid
    const res = await order.takeAsk()
    t.is(res.side, 'ask')
    t.is(res.ord_type, 'market')
    t.is(res.state, 'wait')
    const makeAsk = await order.updateOrderStatus(makeAskId)
    t.is(makeAsk.name, 'cancel_ask')
    t.is(makeAsk.description.uuid, makeAskId)
    await stop(2000)
    const takeAsk = await order.updateOrderStatus(res.uuid)
    t.is(takeAsk.name, 'ask')
    t.is(takeAsk.description.ord_type, 'market')
    t.is(takeAsk.description.state, 'done')
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeAsk(): balance when asked', async t => {
    console.log(`balanceOri: ${order.balanceOri}`)
    console.log(`balanceDest: ${order.balanceDest}`)
    const s = order.msg.order.description
    t.is(floor(order.balanceOri, 3), floor(balanceOri + sum(s.trades.map(t => t.funds)) - s.paid_fee, 3))
    t.is(floor(order.balanceDest, 7), 0)
    balanceOri = order.balanceOri
    balanceDest = order.balanceDest
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeAsk(): 돈없으면 null', async t => {
    const res = await order.takeAsk()
    t.true(res === null)
  })

  test.serial('UPbitCandleMock > SimpleOrder#takeAsk(): 앞선 지정가 매수가 있을 시 매수를 취소한다.', async t => {
    const makeBidId = (await order.makeBid(price * 0.9)).uuid
    const res = await order.takeAsk()
    t.true(res === null)
    const makeBidMsg = await order.updateOrderStatus(makeBidId)
    t.is(makeBidMsg.name, 'cancel_bid')
    t.is(makeBidMsg.description.uuid, makeBidId)
  })
}