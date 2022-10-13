/**
 * Types
 */

import {
  ErrorEvent,
  CloseEvent,
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
  Event,
} from 'ws'
import {
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  Observable,
} from 'fourdollar'


export {
  Event,
  ErrorEvent,
  CloseEvent,
}

export enum ReqType {
  Trade = 'trade',
  Orderbook = 'orderbook',
  Ticker = 'ticker',
}

export enum EventType {
  Trade = 'trade',
  Orderbook = 'orderbook',
  Ticker = 'ticker',
  Candle = 'candle',
  Start = 'start',
  Finish = 'finish',
}

export enum SocketState {
  Connecting = CONNECTING,
  Open = OPEN,
  Closing = CLOSING,
  Closed = CLOSED,
}

export interface ResType {
  // ty 타입  String
  type: ReqType.Trade|ReqType.Orderbook|ReqType.Ticker
  // cd	마켓 코드 (ex. KRW-BTC)	String	
  code: string
}

/**
 * 체결(Trade) 응답
**/
export interface TradeType extends ResType {
  type: ReqType.Trade           // ty	타입	String	trade : 체결
  code: string                  // cd	마켓 코드 (ex. KRW-BTC)	String	
  trade_price: number           // tp	체결 가격	Double	
  trade_volume: number          // tv	체결량	Double	
  ask_bid: string               // ab	매수/매도 구분	String	ASK : 매도 BID : 매수
  prev_closing_price: number    // pcp	전일 종가	Double	
  change: string                // c	전일 대비	String	RISE : 상승 EVEN : 보합 FALL : 하락
  change_price: number          // cp	부호 없는 전일 대비 값	Double	
  trade_date: string            // td	체결 일자(UTC 기준)	String	yyyy-MM-dd
  trade_time: string            // ttm	체결 시각(UTC 기준)	String	HH:mm:ss
  trade_timestamp: number       // ttms	체결 타임스탬프 (millisecond)	Long	
  timestamp: number             // tms	타임스탬프 (millisecond)	Long	
  sequential_id: number         // sid	체결 번호 (Unique)	Long	
  stream_type: string           // st	스트림 타입	String	SNAPSHOT : 스냅샷 REALTIME : 실시간
}

/**
 * 호가(Orderbook) 응답
**/
export interface OrderbookType extends ResType {
  type: ReqType.Orderbook                 // ty	타입	String	orderbook : 호가
  code: string                            // cd	마켓 코드 (ex. KRW-BTC)	String	
  total_ask_size: number                  // tas	호가 매도 총 잔량	Double	
  total_bid_size: number                  // tbs	호가 매수 총 잔량	Double	
  orderbook_units: OrderbookUnitType[]    // obu	호가	List of Objects 
  timestamp: number                       // tms	타임스탬프 (millisecond)	Long	
  stream_type: string                     // st	스트림 타입	String	SNAPSHOT : 스냅샷 REALTIME : 실시간
}

/**
 * 호가 Unit
**/
export interface OrderbookUnitType {
  ask_price: number   // ap	매도 호가	Double	
  bid_price: number   // bp	매수 호가	Double	
  ask_size: number    // as	매도 잔량	Double	
  bid_size: number    // bs	매수 잔량	Double	
}

/**
 * 현재가(Ticker) 응답
**/
export interface TickerType extends ResType {
  type: ReqType.Ticker            // ty 타입 String ticker : 현재가
  code: string                    // cd 마켓 코드 (ex. KRW-BTC)	String
  opening_price: number           // op	시가	Double	
  high_price: number              // hp	고가	Double	
  low_price: number               // lp	저가	Double	
  trade_price: number             // tp	현재가	Double	
  prev_closing_price: number      // pcp	전일 종가	Double	
  change: string                  // c	전일 대비	String	RISE : 상승 EVEN : 보합 FALL : 하락
  change_price: number            // cp	부호 없는 전일 대비 값	Double	
  signed_change_price: number     // scp	전일 대비 값	Double	
  change_rate: number             // cr	부호 없는 전일 대비 등락율	Double	
  signed_change_rate: number      // scr	전일 대비 등락율	Double	
  trade_volume: number            // tv	가장 최근 거래량	Double	
  acc_trade_volume: number        // atv	누적 거래량(UTC 0시 기준)	Double	
  acc_trade_volume_24h: number    // atv24h	24시간 누적 거래량	Double	
  acc_trade_price: number         // atp	누적 거래대금(UTC 0시 기준)	Double	
  acc_trade_price_24h: number     // atp24h	24시간 누적 거래대금	Double	
  trade_date: string              // tdt	최근 거래 일자(UTC)	String	yyyyMMdd
  trade_time: string              // ttm	최근 거래 시각(UTC)	String	HHmmss
  trade_timestamp: number         // ttms	체결 타임스탬프 (milliseconds)	Long	
  ask_bid: string                 // ab	매수/매도 구분	String	ASK : 매도 BID : 매수
  acc_ask_volume: number          // aav	누적 매도량	Double	
  acc_bid_volume: number          // abv	누적 매수량	Double	
  highest_52_week_price: number   // h52wp	52주 최고가	Double	
  highest_52_week_date: string    // h52wdt	52주 최고가 달성일	String	yyyy-MM-dd
  lowest_52_week_price: number    // l52wp	52주 최저가	Double	
  lowest_52_week_date: string     // l52wdt	52주 최저가 달성일	String	yyyy-MM-dd
  // trade_status: string            // ts	거래상태 *deprecated	String	
  market_state: string            // ms	거래상태	String	PREVIEW : 입금지원 ACTIVE : 거래지원가능 DELISTED : 거래지원종료
  // market_state_for_ios: string    // msfi	거래 상태 *deprecated	String	
  is_trading_suspended: boolean   // its	거래 정지 여부	Boolean	
  delisting_date: string          // dd	상장폐지일	Date	
  market_warning: string          // mw	유의 종목 여부	String	NONE : 해당없음 CAUTION : 투자유의
  timestamp: number               // tms	타임스탬프 (milliseconds)	Long	
  stream_type: string             // st	스트림 타입	String	SNAPSHOT : 스냅샷 REALTIME : 실시간
}

export interface Config {
  upbit_keys: {
    accessKey: string
    secretKey: string
  }
  order: {
    atime_price: number
  }
  markets: string[]
}

export interface HistoryType {
  bid: (Iu.OrderDetailType)[]
  ask: (Iu.OrderDetailType)[]
  errorBid: any[]
  errorAsk: any[]
}

export interface HistoryFileType<B> extends HistoryType {
  time_stamp: number
  time: string
  brief: B
}

export interface OHLCType {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface PriceTimeType {
  price: number
  timestamp: number
}

export interface Message<S> {
  where: string
  name: string
  timestamp: number
  time: string
  description: S
}

export interface OrderMessage extends Message<Iu.OrderDetailType> {
  name: 'bid' | 'ask' | 'cancel_bid' | 'cancel_ask'
}

export interface ErrorMessage extends Message<unknown> {
  name: 'error'
}


export interface OrderType extends Iu.OrderType {}
export interface OrderDetailType extends Iu.OrderDetailType {}
export interface OrderChanceType extends Iu.OrderChanceType {}
export interface OrderLimitParam extends Iu.OrderLimitParam {}
export interface OrderPriceParam extends Iu.OrderPriceParam {}
export interface OrderMarketParam extends Iu.OrderMarketParam {}


export interface WrapAPI {
  market: string
  setTrade(tr: TradeType): Promise<void>
  setCandle(ohlc: OHLCType): Promise<void>
  getPrice(bid_ask?: 'BID'|'ASK'): number
  getTime(bid_ask?: 'BID'|'ASK'): number
  getOrdersChance(): Promise<OrderChanceType>
  getOrderDetail(uuid: string): Promise<OrderDetailType>
  cancel(uuid: string): Promise<OrderType>
  order(params: OrderLimitParam | OrderPriceParam | OrderMarketParam): Promise<OrderType>
  observer(bid_ask?: 'BID'|'ASK'|'BOTH'): Observable<number>
}

