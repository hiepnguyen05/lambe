const ACCESS_TOKEN_KEY = 'lambe.accessToken'

export const authSession = {
  getAccessToken() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  },

  saveAccessToken(accessToken: string) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  },

  clear() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  },
}
