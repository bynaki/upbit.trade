// todo:
// /**
//  * 이동평균을 이용한 주문
//  * 분붕에서 최근 봉이 이동평균 위로 돌파하면 매수
//  * 최근 봉이 이동평균 아래로 돌파하면 매도
//  * 실제로 거래됨 주의
//  */

// import {
//   BaseBot,
//   types as I,
//   OrderMarket,
//   OrderHistory,
//   UPbitSocket,
// } from '../index'



// function ma(ohlcs: I.OHLCType[]) {
//   const ma = (ohlcs.map(o => o.close)
//   .reduce((sum, c) => {
//     sum += c
//     return sum
//   }, 0)) / ohlcs.length
//   return ma
// }



// class TestOrderBot extends BaseBot {
//   private order: OrderMarket = null

//   constructor(code: string) {
//     super(code)
//   }

//   @addCandleListener(5, 22)
//   async Minutes5(ohlcs: I.OHLCType[]) {
//     if(ohlcs.length === 22) {
//       const m1 = ma(ohlcs.slice(1, 21))
//       const m2 = ma(ohlcs.slice(2, 22))
//       if(ohlcs[1].close > m1 && ohlcs[2].close <= m2 && ohlcs[0].close > m1) {
//         await this.bid(10000)
//       }
//       if(ohlcs[1].close < m1 && ohlcs[2].close >= m2 && ohlcs[0].close < m1) {
//         await this.ask()
//       }
//     }
//   }

//   async bid(price: number): Promise<void> {
//     if(!this.order) {
//       this.order = this.newOrderMarket()
//       try {
//         await this.order.bid(price)
//         this.order.wait(null, async status => {
//           if(status.state !== 'cancel') {
//             const history = new OrderHistory('./history/order.bot.txt')
//             await history.append(this.order.history)
//             this.order = null
//           }
//         })
//       } catch(e) {
//         this.log(e)
//         const history = new OrderHistory('./history/order.bot.txt')
//         await history.append(this.order.history)
//         this.order = null
//       }
//     }
//   }

//   async ask(): Promise<void> {
//     if(!this.order) {
//       return null
//     }
//     if(this.order.status.side === 'bid' && this.order.status.state === 'cancel') {
//       try {
//         await this.order.ask()
//         this.order.wait(null, async status => {
//           const history = new OrderHistory('./history/order.bot.txt')
//           await history.append(this.order.history)
//           this.order = null
//         })
//       } catch(e) {
//         this.log(e)
//         const history = new OrderHistory('./history/order.bot.txt')
//         await history.append(this.order.history)
//         this.order = null
//       }
//     }
//   }

//   onTrade = null
//   onOrderbook = null
//   onTicker = null
//   start = null
//   finish = null
// }


// const socket = new UPbitSocket()
// socket.addBotClass(TestOrderBot, ['KRW-BTC'])
// socket.open()