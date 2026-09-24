const ACCESS_TOKEN_KEY = 'lambe.accessToken'

export const authSession = {
  getAccessToken() {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  saveAccessToken(accessToken: string) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  },

  clear() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  },
}
