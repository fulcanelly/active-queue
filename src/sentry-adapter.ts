


export type SentryLike = {
  startSpan<T>(params: { name: string }, cb: () => T): T
  captureException(exception: unknown, param: { extra: any }): string
}

export const sentryStub: SentryLike = {
  startSpan(_, cb) {
    return cb()
  },

  captureException(_, __) {
    return ''
  }
}
