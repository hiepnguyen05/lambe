import { useEffect, useState } from 'react'

export function useClock(timeZone = 'Asia/Ho_Chi_Minh') {
  const [localTime, setLocalTime] = useState('')

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const updateClock = () => {
      setLocalTime(`UTC+7 ${formatter.format(new Date())}`)
    }

    updateClock()
    const intervalId = window.setInterval(updateClock, 1000)

    return () => window.clearInterval(intervalId)
  }, [timeZone])

  return localTime
}
