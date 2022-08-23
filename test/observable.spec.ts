/*
import Observable from 'zen-observable'
import test from 'ava'
import {
  stop,
} from 'fourdollar'



class TestObservable {
  obss: {
    [id: string]: {
      obs: Observable<{
        value: number
        complete: () => void
      }>
      subs: ZenObservable.SubscriptionObserver<{
        value: number
        complete: () => void
      }> []
    }
  } = {}


  listen(id: string) {
    this.obss[id] = this.obss[id] || {
      obs: new Observable(sub => {
        this.obss[id].subs.push(sub)
        const length = this.obss[id].subs.length
        console.log(`subscribe ${length}'s of ${id}`)
        return () => {
          this.obss[id].subs = this.obss[id].subs.filter(s => {
            if(s === sub) {
              console.log(`closed ${length}st subscription of ${id}`)
              return false
            }
            return true
          })
        }
      }),
      subs: []
    }
    return this.obss[id].obs
  }

  trriger() {
    let cc = 0
    const t = setInterval(() => {
      cc++
      const ids = Object.keys(this.obss)
      ids.forEach(id => {
        this.obss[id].subs.forEach(sub => {
          sub.next({
            value: cc,
            complete: () => sub.complete()
          })
        })
      })
      if(cc === 6) {
        clearInterval(t)
        ids.forEach(id => {
          const observer = this.obss[id]
          observer.subs.forEach(sub => {
            sub.complete()
          })
        })
      }
    }, 100)
  }
}



test('test Observable', t => {
  t.plan(14)
  const tt = new TestObservable()
  let c1 = 0
  const obs1 = tt.listen('foobar')
  obs1.subscribe({
    next(msg) {
      t.is(msg.value, ++c1)
      console.log(`1st foobar ${msg.value}`)
    },
    complete() {
      t.pass()
      console.log('1st foobar completed!')
    },
  })
  obs1.subscribe({
    next(msg) {
      t.is(msg.value, c1)
      console.log(`2st foobar ${msg.value}`)
      if(msg.value === 2) {
        msg.complete()
      }
    },
    complete() {
      t.pass()
      console.log('2st foobar completed!')
    },
  })
  let c2 = 0
  const obs2 = tt.listen('hello')
  obs2.subscribe({
    next(msg) {
      t.is(msg.value, ++c2)
      console.log(`hello ${msg.value}`)
      if(msg.value === 3) {
        msg.complete()
      }
    },
    complete() {
      t.pass()
      console.log('hello completed!')
    }
  })
  tt.trriger()
  return obs2
})




class TestAsyncObservable {
  obss: {
    [id: string]: {
      obs: Observable<{
        value: number
        complete: () => void
      }>
      subs: ZenObservable.SubscriptionObserver<{
        value: number
        complete: () => void
      }> []
    }
  } = {}

  listen(id: string) {
    this.obss[id] = this.obss[id] || {
      obs: new Observable(sub => {
        this.obss[id].subs.push(sub)
        const length = this.obss[id].subs.length
        console.log(`subscribe ${length}'s of ${id}`)
        return () => {
          this.obss[id].subs = this.obss[id].subs.filter(s => {
            if(s === sub) {
              console.log(`closed ${length}st subscription of ${id}`)
              return false
            }
            return true
          })
        }
      }),
      subs: []
    }
    return this.obss[id].obs
  }

  async trriger(): Promise<void> {
    for(let i = 0; i < 6; i++) {
      const ids = Object.keys(this.obss)
      const nexts: Promise<void>[] = []
      ids.forEach(id => {
        const ns = this.obss[id].subs.map(async sub => {
          return sub.next({
            value: i + 1,
            complete: () => sub.complete()
          })
        })
        nexts.concat(ns)
      })
      await Promise.all(nexts)
    }
    await stop(3000)
  }
}


test.only('test async Observable', async t => {
  t.plan(14)
  const tt = new TestAsyncObservable()
  let c1 = 0
  const obs1 = tt.listen('foobar')
  obs1.subscribe({
    async next(msg) {
      t.is(msg.value, ++c1)
      await stop(200)
      console.log(`1st foobar ${msg.value}`)
    },
    complete() {
      t.pass()
      console.log('1st foobar completed!')
    },
  })
  let c1_1 = 0
  obs1.subscribe({
    async next(msg) {
      t.is(msg.value, ++c1_1)
      await stop(100)
      console.log(`2st foobar ${msg.value}`)
      if(msg.value === 2) {
        msg.complete()
      }
    },
    complete() {
      t.pass()
      console.log('2st foobar completed!')
    },
  })
  let c2 = 0
  const obs2 = tt.listen('hello')
  obs2.subscribe({
    async next(msg) {
      t.is(msg.value, ++c2)
      await stop(300)
      console.log(`hello ${msg.value}`)
      if(msg.value === 3) {
        msg.complete()
      }
    },
    complete() {
      t.pass()
      console.log('hello completed!')
    }
  })
  await tt.trriger()
})
*/