/**
 * bundle socket 的时候，这个文件是 tsc 的一个 entry
 * import 一下需要的 Rx 操作符
 */
import '../apis/user/get'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/toPromise'
import 'rxjs/add/operator/concatMap'
import 'rxjs/add/operator/take'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { Database } from 'reactivedb'
import { SDKFetch } from '../SDKFetch'
import { socketHandler } from './EventMaps'
import * as Consumer from 'snapper-consumer'
import { UserMe } from '../schemas/UserMe'

declare const global: any

const ctx = typeof global === 'undefined' ? window : global

export class SocketClient {
  private _isDebug = false

  private _client: Consumer

  private _socketUrl = 'wss://push.teambition.com'

  private _consumerId: string

  private _getUserMeStream =  new ReplaySubject<UserMe>(1)

  private _joinedRoom = new Set<string>()
  private _leavedRoom = new Set<string>()

  constructor(
    private database: Database,
    private fetch: SDKFetch
  ) { }

  destroy() {
    this._getUserMeStream.complete()
  }

  debug(): void {
    this._isDebug = true
    ctx['console']['log']('socket debug start')
  }

  setSocketUrl(url: string): void {
    this._socketUrl = url
  }

  async initClient(client: Consumer, userMe?: UserMe): Promise<void> {
    if (!userMe) {
      await this._getToken()
    } else {
      this._getUserMeStream.next(userMe)
    }
    this._client = client
    this._client._join = this._join.bind(this)
    this._client.onmessage = this._onmessage.bind(this)
    this._client.onopen = this._onopen.bind(this)
    this._getUserMeStream.subscribe(u => {
      this._client.getToken = () => {
        return u.snapperToken as string
      }
    })
  }

  async connect(): Promise<void> {
    const userMe = await this._getUserMeStream
      .take(1)
      .toPromise()
    const auth = userMe.snapperToken.split('.')[1]
    const token: {
      exp: number
      userId: string
      source: 'teambition'
    } = JSON.parse(window.atob(auth))
    const expire = token.exp * 1000 - 3600000
    // token.exp * 1000 - 1 * 60 * 60 * 1000
    if (expire < Date.now()) {
      await this._getToken()
    }
    return this._connect()
  }

  /**
   * uri 格式: :type/:id
   * eg: projects, organizations/554c83b1b2c809b4715d17b0
   */
  join(uri: string): Consumer {
    if (this._joinedRoom.has(uri)) {
      return this._client
    }
    return this._client.join.call(this._client, uri)
  }

  leave(uri: string): Promise<void> {
    if (!this._consumerId) {
      return Promise.reject(new Error(`leave room failed, no consumerId`))
    }
    if (this._leavedRoom.has(uri)) {
      return Promise.resolve()
    }
    return this.fetch.leaveRoom(uri, this._consumerId)
      .then(() => {
        if (this._joinedRoom) {
          this._joinedRoom.delete(uri)
        }
        this._leavedRoom.add(uri)
      })
      .catch((e: any) => {
        console.error(e)
      })
  }

  // override Consumer onopen
  private _onopen(): void {
    this._joinedRoom.forEach(r => {
      this.fetch.joinRoom(r, this._consumerId)
    })
  }

  private _connect(): Promise<void> {
    return this._getUserMeStream
      .take(1)
      .toPromise()
      .then(userMe => {
        this._client
          .connect(this._socketUrl, {
            path: '/websocket',
            token: userMe.snapperToken as string
          })
      })
  }

  private _onmessage(event: Consumer.RequestEvent) {
    if (this._isDebug) {
      // 避免被插件清除掉
      ctx['console']['log'](JSON.stringify(event, null, 2))
    }
    return socketHandler(this.database, event)
      .toPromise()
      .then(null, (err: any) => ctx['console']['error'](err))
  }

  private _getToken() {
    return this.fetch.getUserMe()
      .toPromise()
      .then(r => {
        this._getUserMeStream.next(r)
      })
  }

  private _join (room: string, consumerId: string): Promise<any> {
    this._consumerId = consumerId
    return this.fetch.joinRoom(room, consumerId)
      .then(() => {
        this._joinedRoom.add(room)
      })
      .catch(e => {
        console.error(e)
      })
  }
}

export function leaveRoom (
  this: SDKFetch,
  room: string,
  consumerId: string
) {
  return (<any>this.delete)(`/${room}/subscribe`, {
    consumerId
  })
    .toPromise()
}

export function joinRoom (
  this: SDKFetch,
  room: string,
  consumerId: string
) {
  return this.post<void>(`/${room}/subscribe`, {
    consumerId: consumerId
  })
    .toPromise()
}

SDKFetch.prototype.leaveRoom = leaveRoom
SDKFetch.prototype.joinRoom = joinRoom

declare module '../SDKFetch' {
  interface SDKFetch {
    joinRoom: typeof joinRoom
    leaveRoom: typeof leaveRoom
  }
}
