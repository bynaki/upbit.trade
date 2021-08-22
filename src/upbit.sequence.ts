import {
  RequestError,
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import { format } from 'fecha'
import {
  stop,
} from 'fourdollar'



async function processError(func: Function, thisArgs: any, ...argArray: any[]) {
  try {
    const res = await func.call(thisArgs, ...argArray)
    return res
  } catch(e) {
    if(e instanceof RequestError) {
      if(e.status === 429) {
        await stop(1000)
        return processError(func, thisArgs, ...argArray)
      } else {
        throw e
      }
    }
  }
}


export class UPbitSequence {
  private api: UPbit

  constructor(opts: {
    accessKey: string
    secretKey: string
  }) {
    this.api = new UPbit(opts)
  }

  /**
   * 최근 체결 내역
   * daysAgo 별로 요청 가능하다.
   * count는 기본값은 최대 요청 데이터 수 이다. 기본으로 두자.
   */
  async * eachTradesTicks(params: {
    market: string,
    daysAgo?: number,
    count?: number,
    to?: string,
  }) {
    const {market, daysAgo, to} = params
    const count = params.count? Math.min(Math.max(params.count, 1), 500) : 500
    let res: Iu.TradeTickType[] = (await processError(this.api.getTradesTicks, this.api, {
      market, daysAgo, count, to
    })).data
    while(res.length !== 0) {
      for(let r of res) {
        yield r
      }
      res = (await processError(this.api.getTradesTicks, this.api, {
        market,
        daysAgo,
        count,
        cursor: res[res.length - 1].sequential_id
      })).data
    }
  }

  async * eachCandlesMinutes(min: 1|3|5|15|30|60|240, params: {
    market: string
    from: string
    to?: string
    count?: number
  }) {
    const {market} = params
    let to = params.to? format(new Date(params.to), 'isoDateTime') : params.to
    const from = new Date(params.from).getTime()
    const count = params.count? Math.min(Math.max(params.count, 1), 200) : 200
    let res: Iu.CandleMinuteType[]
    do {
      if(res) {
        to = res[res.length - 1].candle_date_time_utc + '+00:00'
      }
      res = (await processError(this.api.getCandlesMinutes, this.api, min, {
        market,
        count,
        to,
      })).data
      const d = new Date(res[res.length - 1].candle_date_time_utc + '+00:00').getTime()
      if(d < from) {
        res = res.filter(c => {
          const d = new Date(c.candle_date_time_utc + '+00:00').getTime()
          return d >= from
        })
      }
      for(let c of res) {
        yield c
      }
    } while(res.length === count)
  }
}