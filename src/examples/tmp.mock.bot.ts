import {
  BaseBot,
  UPbitTradeMock,
  types as I,
} from '../index'
import {
  join,
} from 'path'
import $4 from 'fourdollar'



class MockBot extends BaseBot {
  pasts: I.TradeType[] = []
  futures: I.TradeType[] = []

  constructor(code: string) {
    super(code)
  }

  async onTrade(tr: I.TradeType) {
    while(this.pasts.length !== 0 
      && this.pasts[this.pasts.length - 1].trade_timestamp < tr.trade_timestamp - (1000 * 60 * 60)) {
      this.pasts.pop()
    }
    this.pasts.unshift(tr)
    if(this.futures.length === 0) {
      const min = Math.min(...this.pasts.map(tr => tr.trade_price))
      const pro = (tr.trade_price - min) / tr.trade_price
      if(pro >= 0.03) {
        this.futures.unshift(tr)
      }
    } else {
      const f0 = this.futures[this.futures.length - 1]
      const f1 = this.futures[0]
      if(f0.trade_timestamp + (1000 * 60 * 60) < f1.trade_timestamp) {
        const max = Math.max(...this.futures.map(tr => tr.trade_price))
        const up = (max - f0.trade_price) / f0.trade_price
        const min = Math.min(...this.futures.map(tr => tr.trade_price))
        const down = (min - f0.trade_price) / f0.trade_price
        this.log(`${this.code} >> up: ${Math.floor(up * 100 * 100) / 100}%, down: ${Math.floor(down * 100 * 100) / 100}%`)
        this.futures = []
      } else {
        this.futures.unshift(tr)
      }
    }
  }

  onOrderbook = null
  onTicker = null
  start = null
  finish = null
}
MockBot.writer = new $4.FileWriter(join(__dirname, 'log', 'test_mock.log'), '1d')



const socket = new UPbitTradeMock(join(__dirname, 'example.db'), 'test_mock', {
  daysAgo: 6,
})
socket.addBotClass(MockBot, [
  "KRW-XTZ",
  "KRW-ATOM",
  "KRW-ADA",
  "KRW-XRP",
  "KRW-ETH",
  "KRW-BTC",
  "KRW-DOT",
  "KRW-OMG",
  "KRW-BCHA",
  "KRW-AXS",
])
socket.open()