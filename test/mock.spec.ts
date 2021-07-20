// import test, {
//   ExecutionContext,
// } from 'ava'
// import {
//   UPbit,
//   upbit_types as Iu,
// } from 'cryptocurrency.api'
// import {
//   UPbitSocketMock,
//   getConfig,
//   BaseSocketBot,
//   types as I,
// } from '../src'


// const config = getConfig('./config.json')


// test.serial('trade', async t => {
//   const api = new UPbit(config.upbit_keys)
//   const res = await api.getTradesTicks({
//     market: 'KRW-BTC',
//     count: 1000,
//   })
//   console.log(res.status)
//   console.log(res.remainingReq)
//   console.log(res.data.length)
//   console.log(res.data[0])
//   const res2 = await api.getTradesTicks({
//     market: 'KRW-BTC',
//     count: 1000,
//     cursor: res.data[res.data.length - 1].sequential_id,
//   })
//   console.log(res2.status)
//   console.log(res2.remainingReq)
//   console.log(res2.data.length)
//   console.log(res2.data[0])
//   t.pass()
// })




// class TestBot extends BaseSocketBot {
//   private pre: I.TradeType = null
//   private count = 0

//   constructor(code: string, private readonly t: ExecutionContext) {
//     super(code)
//   }

//   async start() {
//     this.log('started')
//   }

//   async finish() {
//     this.t.is(this.count, 30000)
//     this.log('finished')
//   }

//   async onTrade(tr: I.TradeType) {
//     this.count++
//     if(this.pre === null) {
//       this.pre = tr
//       return
//     }
//     this.t.true(tr.sequential_id > this.pre.sequential_id)
//     this.pre = tr
//     return false
//   }

//   onOrderbook = null
//   onTicker = null
// }



// {
//   const api = new UPbit(config.upbit_keys)
//   const us = new UPbitSocketMock(['KRW-BTC', 'KRW-XRP'], 30000, api)

//   test.serial('TestBot', async t => {
//     us.addBot(new TestBot('KRW-BTC', t))
//     await us.open()
//     await us.close()
//   })
// }
