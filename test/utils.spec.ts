import test from 'ava'
import {
  allMarketCode,
  tickers,
  safeApi,
  api,
} from '../src'


test('allMarketCode()', async t => {
  const markets = await allMarketCode()
  while(markets.length !== 0) {
    console.log(JSON.stringify(markets.splice(0, 10), null, 2))
  }
  t.pass()
})

test('tickers(): sort market name', async t => {
  const codes = await allMarketCode()
  const tks = await tickers(codes, 'market')
  console.log(tks.map(tk => tk.market))
  t.pass()
})

test('tickers(): sort acc_trade_price_24h', async t => {
  const codes = await allMarketCode()
  const tks = await tickers(codes, 'acc_trade_price_24h')
  console.log(tks.map(tk => Math.floor(tk.acc_trade_price_24h)))
  t.pass()
})

test('tickers(): sort acc_trade_price_24h (splice)', async t => {
  const codes = await allMarketCode()
  const tks = await tickers(codes, 'acc_trade_price_24h')
  while(tks.length !== 0) {
    console.log(JSON.stringify(tks.splice(0, 10).map(tk => tk.market), null, 2))
  }
  t.pass()
})

test.only('safeApi#getMarket()', async t => {
  const ress = []
  for(let i = 0; i < 200; i++) {
    ress.push((async () => {
      const m = await safeApi.getMarket(true)
      console.log(m.remainingReq)
      console.log(m.status)
      console.log(m.data[0])
    })())
  }
  const rr = await Promise.all(ress)
  t.pass()
})