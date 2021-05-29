import test from 'ava'
import {
  Order,
  // OrderMock,
  getConfig,
  UPbit,
  OrderMarket,
  OrderHistory,
} from '../src'
import {
  stop,
} from 'fourdollar'
import { RequestError } from 'cryptocurrency.api'
import { times } from 'lodash'

/**
 * 지정가 매수매도
 * -- 실제로 거래됨 주의 --
 */
if(true) {
  const config = getConfig('./config.json')
  const api = new UPbit(config.upbit_keys)
  const order = new Order(api)

  test.serial('order > #bid(): low price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid({
      market: 'KRW-BTC',
      price: trade.trade_price * 0.9,
      volume: 5000,
    })
    console.log(res)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel bid', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
  })

  test.serial('order > wait cancel bid', async t => {
    t.timeout(6000)
    const status = await order.wait(300, 20)
    t.is(status.side, 'bid')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #bid(): low price again', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid({
      market: 'KRW-BTC',
      price: trade.trade_price * 0.9,
      volume: 5000,
    })
    t.is(res.side, 'bid')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancelWaiting() bid', async t => {
    const status = await order.cancelWaiting()
    t.is(status.side, 'bid')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #bid()', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.bid({
      market: 'KRW-BTC',
      price: trade.trade_price,
      volume: 5000,
    })
    console.log(res)
    t.pass()
  })

  test.serial('order > wait done bid', async t => {
    t.timeout(120 * 1000)
    const status  = await order.wait(1000, 20)
    t.is(status.side, 'bid')
    t.is(status.state, 'done')
  })

  test.serial('order > can not cancel bid when done', async t => {
    const res = await order.cancel()
    t.is(res, null)
    console.log(order.error)
  })

  test.serial('order > #ask(): high price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask({price: trade.trade_price * 1.1})
    console.log(res)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel ask', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > wait cancel ask', async t => {
    t.timeout(6000)
    const status = await order.wait(300, 20)
    t.is(status.side, 'ask')
    t.is(status.state, 'cancel')

  })

  test.serial('order > #ask(): high price again', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask({price: trade.trade_price * 1.1})
    console.log(res)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancelWaiting() ask', async t => {
    const status = await order.cancelWaiting()
    t.is(status.side, 'ask')
    t.is(status.state, 'cancel')
  })

  test.serial('order > #ask()', async t => {
    const res = await order.ask({price: order.statusBid.price})
    console.log(res)
    t.is(res.side, 'ask')
    t.is(res.state, 'wait')
  })

  test.serial('order > wait done ask', async t => {
    t.timeout(120 * 1000)
    const status  = await order.wait(1000, 20)
    t.is(status.side, 'ask')
    t.is(status.state, 'done')
  })

  test.serial('order > can not cancel ask when done', async t => {
    const res = await order.cancel()
    t.is(res, null)
    console.log(order.error)
  })

  test.serial('order > history', async t => {
    const h = order.history
    console.log(h)
    const bid = h.bid
    t.is(bid.length, 6)
    t.is(bid[0].side, 'bid')
    t.is(bid[0].state, 'wait')
    t.is(bid[1].side, 'bid')
    t.is(bid[1].state, 'cancel')
    t.is(bid[0].uuid, bid[1].uuid)
    t.is(bid[2].side, 'bid')
    t.is(bid[2].state, 'wait')
    t.is(bid[3].side, 'bid')
    t.is(bid[3].state, 'cancel')
    t.is(bid[2].uuid, bid[3].uuid)
    t.is(bid[4].side, 'bid')
    t.is(bid[4].state, 'wait')
    t.is(bid[5].side, 'bid')
    t.is(bid[5].state, 'done')
    t.is(bid[4].uuid, bid[5].uuid)
    const ask = h.ask
    t.is(ask.length, 6)
    t.is(ask[0].side, 'ask')
    t.is(ask[0].state, 'wait')
    t.is(ask[1].side, 'ask')
    t.is(ask[1].state, 'cancel')
    t.is(ask[0].uuid, ask[1].uuid)
    t.is(ask[2].side, 'ask')
    t.is(ask[2].state, 'wait')
    t.is(ask[3].side, 'ask')
    t.is(ask[3].state, 'cancel')
    t.is(ask[2].uuid, ask[3].uuid)
    t.is(ask[4].side, 'ask')
    t.is(ask[4].state, 'wait')
    t.is(ask[5].side, 'ask')
    t.is(ask[5].state, 'done')
    t.is(ask[4].uuid, ask[5].uuid)
    t.is(h.errorBid.length, 1)
    t.is(h.errorAsk.length, 1)
    console.log(h.errorBid[0])
    console.log(h.errorAsk[0])
  })

  test.serial('order > history file', async t => {
    const history = new OrderHistory<{name: string}>('./history/test.txt')
    const h = await history.append(order.history, {name: 'test'})
    const hh = (await history.read()).pop()
    console.log(hh)
    t.deepEqual(h, hh)
    const bid = hh.bid
    t.is(bid.length, 6)
    t.is(bid[0].side, 'bid')
    t.is(bid[0].state, 'wait')
    t.is(bid[1].side, 'bid')
    t.is(bid[1].state, 'cancel')
    t.is(bid[0].uuid, bid[1].uuid)
    t.is(bid[2].side, 'bid')
    t.is(bid[2].state, 'wait')
    t.is(bid[3].side, 'bid')
    t.is(bid[3].state, 'cancel')
    t.is(bid[2].uuid, bid[3].uuid)
    t.is(bid[4].side, 'bid')
    t.is(bid[4].state, 'wait')
    t.is(bid[5].side, 'bid')
    t.is(bid[5].state, 'done')
    t.is(bid[4].uuid, bid[5].uuid)
    const ask = hh.ask
    t.is(ask.length, 6)
    t.is(ask[0].side, 'ask')
    t.is(ask[0].state, 'wait')
    t.is(ask[1].side, 'ask')
    t.is(ask[1].state, 'cancel')
    t.is(ask[0].uuid, ask[1].uuid)
    t.is(ask[2].side, 'ask')
    t.is(ask[2].state, 'wait')
    t.is(ask[3].side, 'ask')
    t.is(ask[3].state, 'cancel')
    t.is(ask[2].uuid, ask[3].uuid)
    t.is(ask[4].side, 'ask')
    t.is(ask[4].state, 'wait')
    t.is(ask[5].side, 'ask')
    t.is(ask[5].state, 'done')
    t.is(ask[4].uuid, ask[5].uuid)
    t.is(hh.errorBid.length, 1)
    t.is(hh.errorAsk.length, 1)
    console.log(hh.errorBid[0])
    console.log(hh.errorAsk[0])
    t.is(hh.comment.name, 'test')
  })
}


/**
 * 사장가 매수매도
 */
if(false) {
  const config = getConfig('./config.json')
  const api = new UPbit(config.upbit_keys)
  const order = new OrderMarket(api)
  let statusBid = null
  let statusAsk = null
  
  test.serial('order market > #bid()', async t => {
    const res = await order.bid({
      market: 'KRW-BTC',
      price: 5000,
    }, null, status => statusBid = status)
    console.log(res)
    t.is(res.state, 'wait')
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial('order market > #cancel(): can not cancel bid', async t => {
    const res = await order.cancel()
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order market > wait done bid', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'cancel' && statusBid) {
        console.log(status)
        t.is(status.side, 'bid')
        t.deepEqual(status, statusBid)
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order market > #ask()', async t => {
    const res = await order.ask(null, status => statusAsk = status)
    console.log(res)
    t.is(res.state, 'wait')
  })

  // 시장가 거래는 cancel 안됨 주의.
  test.serial('order market > #cancel(): can not cancel ask', async t => {
    const res = await order.cancel()
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order market > wait done ask', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'done' && statusAsk) {
        console.log(status)
        t.is(status.side, 'ask')
        t.deepEqual(status, statusAsk)
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order market > history', async t => {
    const history = new OrderHistory<{name: string}>('./history/test.txt')
    const h = await history.append(order.history, {name: 'test'})
    console.log(h)
    const hh = await history.read()
    console.log(hh[hh.length - 1])
    console.log(hh[hh.length - 1].bid)
    console.log(hh[hh.length - 1].ask)
    t.deepEqual(h, hh[hh.length - 1])
  })
}


/**
 * 가상 매매
 */
// if(true) {
//   const config = getConfig('./config.json')
//   const api = new UPbit(config.upbit_keys)
//   const order = new OrderMock(api)

//   test.serial('ordermock > #bidMarket()', async t => {
//     const res = await order.bidMarket({
//       market: 'KRW-BTC',
//       price: 5000,
//     })
//     console.log(res)
//     console.log(await order.updateStatus())
//     t.pass()
//   })

//   test.serial('ordermock > #cancel(): can not cancel', async t => {
//     const res = await order.cancel()
//     console.log(res)
//     console.log(await order.updateStatus())
//     t.pass()
//   })

//   test.serial('ordermock > #askMarket()', async t => {
//     const res = await order.askMarket()
//     console.log(res)
//     console.log(await order.updateStatus())
//     t.pass()
//   })
// }
