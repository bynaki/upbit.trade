import { values } from 'lodash'
import {
  types as I,
} from '.'



type ValueIndicatorType = (periods: number, ...args: unknown[]) => (value?: number, modify?: boolean) => number


function ValueIndicator(indicator: (value?: number, modify?: boolean) => number): (ohlc?: I.OHLCType) => number {
  let pre: I.OHLCType = null
  return (ohlc: I.OHLCType = null): number => {
    if(ohlc === null) {
      return indicator()
    }
    if(pre !== null && pre.timestamp === ohlc.timestamp) {
      return indicator(ohlc.close, true)
    }
    pre = ohlc
    return indicator(ohlc.close)
  }
}



/**
 * 단순이동평균(Simple Moving Average, SMA)
 * @param periods 기간
 * @returns SMA Indicator 함수 (value: number = null, modify: boolean = false) => number
 */
export function SMA(periods: number): (value?: number, modify?: boolean) => number {
  const values: number[] = []
  const indicator = (value: number = null, modify = false): number => {
    if(values.length === 0 || modify === false) {
      values.unshift(value)
      if(values.length > periods) {
        values.pop()
      }
    } else {
      values[0] = value
    }
    return (values.length === periods)?
    values.reduce((pre, val) => pre + val, 0) / periods
    : null
  }
  let returned = null
  // value가 null이면 방금전 이동평균을 반환한다.
  // modify === false 이면 다음 시간에 계산, true이면 지금 시간 값으로 수정
  return (value: number = null, modify = false): number => {
    if(value === null) {
      return returned
    }
    returned = indicator(value, modify)
    return returned
  }
}

/**
 * 단순이동평균 ohlc (Simple Moving Average, SMA)
 * @param periods 기간
 * @returns SMA Indicator 함수 (value: number = null, modify: boolean = false) => number
 */
export function SMA_OHLC(periods: number): (ohlc: I.OHLCType) => number {
  return ValueIndicator(SMA(periods))
}



/**
 * 지수이동평균 (Exponential Moving Average, EMA)
 * @param periods 기간
 * @param multiplier 승수(가중치)
 * @returns EMA Indicator 함수 (value: number = null, modify: boolean = false) => number
 */
export function EMA(periods: number, multiplier: number = 2 / (periods + 1)): (value?: number, modify?: boolean) => number {
  const smaf = SMA(periods)
  let pre: number = null
  let ema: number = null
  const indicator = (value: number = null, modify = false): number => {
    if(ema === null) {
      ema = smaf(value, modify)
      return ema
    }
    if(pre === null) {
      if(modify === true) {
        ema = smaf(value, modify)
        return ema
      }
    }
    if(modify === false) {
      pre = ema
    }
    ema = (value - pre) * multiplier + pre
    // ema = ((1 - multiplier) * pre) + multiplier * value
    return ema
  }
  let returned = null
  // value가 null이면 방금전 이동평균을 반환한다.
  // modify === false 이면 다음 시간에 계산, true이면 지금 시간 값으로 수정
  return (value: number = null, modify = false): number => {
    if(value === null) {
      return returned
    }
    returned = indicator(value, modify)
    return returned
  }
}

/**
 * 지수이동평균 ohlc (Exponential Moving Average, EMA)
 * @param periods 기간
 * @param multiplier 승수(가중치)
 * @returns EMA Indicator 함수 (ohlc?: I.OHLCType) => number
 */
export function EMA_OHLC(periods: number): (ohlc?: I.OHLCType) => number {
  return ValueIndicator(EMA(periods))
}


/**
 * RSI (Relative Strength Index)
 * @param periods 기간
 * @returns RSI Indicator 함수 (value: number = null, modify = false): number
 */
export function RSI(periods: number)
: (value?: number, modify?: boolean) => number
/**
 * RSI (Relative Strength Index)
 * @param periods 기간
 * @param MA 이동평균 Indicator 생성자 (SMA, EMA, ..)
 * @param maArgs 이동평균 Indicator 생성자 인수
 * @returns RSI Indicator 함수 (value: number = null, modify = false): number
 */
export function RSI(periods: number, MA: ValueIndicatorType, ...maArgs: unknown[])
: (value?: number, modify?: boolean) => number
export function RSI(periods: number, MA?: ValueIndicatorType, ...maArgs: unknown[])
: (value?: number, modify?: boolean) => number {
  const avgGainF: (value?: number, modify?: boolean) => number
    = (MA)? MA(periods, ...maArgs) : EMA(periods, 1 / periods)
  const avgLossF: (value?: number, modify?: boolean) => number
    = (MA)? MA(periods, ...maArgs) : EMA(periods, 1 / periods)
  let preTimeVal = null
  let val = null
  const indicator = (value: number = null, modify = false): number => {
    if(val === null) {
      val = value
      return null
    }
    if(modify === false) {
      preTimeVal = val
    }
    val = value
    if(preTimeVal === null) {
      return null
    }
    const gain = (value > preTimeVal)? value - preTimeVal : 0
    const loss = (value < preTimeVal)? preTimeVal - value : 0
    const avgGain = avgGainF(gain, modify)
    const avgLoss = avgLossF(loss, modify)
    if(avgGain === null) {
      return null
    }
    const rs = avgGain / avgLoss
    if(rs === NaN) {
      return 50
    }
    const rsi = 100 - (100 / (1 + rs))
    return rsi
  }
  let returned = null
  // value가 null이면 방금전 이동평균을 반환한다.
  // modify === false 이면 다음 시간에 계산, true이면 지금 시간 값으로 수정
  return (value: number = null, modify = false): number => {
    if(value === null) {
      return returned
    }
    returned = indicator(value, modify)
    return returned
  }
}

/**
 * RSI ohlc (Relative Strength Index)
 * @param periods 기간
 * @returns RSI Indicator 함수 (ohlc: I.OHLCType = null): number
 */
export function RSI_OHLC(periods: number)
: (ohlc?: I.OHLCType) => number
/**
 * RSI ohlc (Relative Strength Index)
 * @param periods 기간
 * @param MA 이동평균 Indicator 생성자 (SMA, EMA, ..)
 * @param maArgs 이동평균 Indicator 생성자 인수
 * @returns RSI Indicator 함수 (ohlc: I.OHLCType = null): number
 */
export function RSI_OHLC(periods: number, MA: ValueIndicatorType, ...maArgs: unknown[])
: (ohlc?: I.OHLCType) => number
export function RSI_OHLC(periods: number, MA?: ValueIndicatorType, ...maArgs: unknown[])
: (ohlc?: I.OHLCType) => number {
  return ValueIndicator(RSI(periods, MA, ...maArgs))
}
