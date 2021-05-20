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

/**
 * 지정가 매수매도
 * -- 실제로 거래됨 주의 --
 */
if(false) {
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
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel bid', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait cancel bid', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = order.status
      const update = await order.updateStatus()
      if(update.state === 'cancel') {
        console.log(update)
        t.is(update.uuid, status.uuid)
        t.end()
        clearInterval(id)
      }
    }, 3000)
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

  test.serial.cb('order > wait done bid', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'done') {
        console.log(status)
        t.is(status.side, 'bid')
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > #ask(): high price', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask({price: trade.trade_price * 1.1})
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial('order > #cancel(): cancel ask', async t => {
    const status = order.status
    const res = await order.cancel()
    console.log(res)
    t.is(res.uuid, status.uuid)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait cancel ask', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = order.status
      const update = await order.updateStatus()
      if(update.state === 'cancel') {
        console.log(update)
        t.is(update.uuid, status.uuid)
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > #ask()', async t => {
    const trade = (await api.getTradesTicks({market: 'KRW-BTC'})).data[0]
    const res = await order.ask({price: trade.trade_price})
    console.log(res)
    t.is(res.state, 'wait')
  })

  test.serial.cb('order > wait done ask', t => {
    t.timeout(60 * 1000)
    const id = setInterval(async () => {
      const status = await order.updateStatus()
      if(status.state === 'done') {
        console.log(status)
        t.is(status.side, 'ask')
        t.end()
        clearInterval(id)
      }
    }, 3000)
  })

  test.serial('order > history', async t => {
    const history = new OrderHistory<{name: string}>('./history/test.txt')
    const h = await history.append(order, {name: 'test'})
    console.log(h)
    const hh = await history.read()
    console.log(hh[hh.length - 1])
    console.log(hh[hh.length - 1].bid)
    console.log(hh[hh.length - 1].ask)
    t.deepEqual(h, hh[hh.length - 1])
  })
}


/**
 * 사장가 매수매도
 */
if(true) {
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
    const h = await history.append(order, {name: 'test'})
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