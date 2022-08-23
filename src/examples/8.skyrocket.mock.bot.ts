// todo:
// /**
//  * UPbitCandleMock 을 이용한
//  * 최근 3일동안 급등주 검색
//  */

// import $4 from 'fourdollar'
// import {
//   join,
// } from 'path'
// import {
//   allMarketCode,
//   UPbitCandleMock,
//   addCandleListener,
//   BaseBot,
//   types as I,
// } from '..';



// const rates: {
//   code: string
//   high: number
//   high_time: string
//   low: number
//   low_time: string
//   rate: number
// }[] = []

// class SkyrocketBot extends BaseBot {
//   last: I.OHLCType[]

//   constructor(code: string) {
//     super(code)
//   }

//   @addCandleListener(60, 72)
//   aHour(ohlcs: I.OHLCType[]) {
//     if(this.code === 'KRW-AAVE' || this.code === 'KRW-1INCH') {
//       console.log(ohlcs[0])
//       console.log(ohlcs.length)
//     }
//     if(ohlcs.length === 72) {
//       this.last = ohlcs
//     }
//   }

//   async finish() {
//     if(!this.last) {
//       return
//     }
//     const low = this.last.reduce((pre, ohlc) => {
//       if(pre === null) {
//         return ohlc
//       }
//       if(ohlc.low <= pre.low) {
//         return ohlc
//       }
//       return pre
//     }, null)
//     const high = this.last.filter(o => o.timestamp >= low.timestamp)
//     .reduce((pre, ohlc) => {
//       if(pre === null) {
//         return ohlc
//       }
//       if(ohlc.high >= pre.high) {
//         return ohlc
//       }
//       return pre
//     }, null)
//     rates.push({
//       code: this.code,
//       high: high.high,
//       high_time: new Date(high.timestamp).toLocaleString(),
//       low: low.low,
//       low_time: new Date(low.timestamp).toLocaleString(),
//       rate: Math.floor(((high.high - low.low) / low.low) * 100) / 100,
//     })
//   }
  

//   start = null
//   onTrade = null
//   onTicker = null
//   onOrderbook = null
// }
// SkyrocketBot.writer.link = new $4.FileWriter(join(__dirname, 'log', 'skyrocket.log'));


// function zero(n: number): string {
//   return (n < 10)? `0${n}` : n.toString()
// }

// (async () => {
//   const allCodes = await allMarketCode()
//   const now = new Date(Date.now() - (1000 * 60 * 60 * 24 * 4))
//   const from = `${now.getFullYear()}-${zero(now.getMonth() + 1)}-${zero(now.getDate())}T${zero(now.getHours())}:00:00+09:00`
//   const socket = new UPbitCandleMock(join(__dirname, 'example.db'), 'skyrocket', {
//     from,
//   })
//   socket.addBotClass(SkyrocketBot, allCodes)
//   await socket.open()
//   console.log(rates.sort((a, b) => b.rate - a.rate).slice(0, 10))
// })()