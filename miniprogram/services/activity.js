function formatRelativeTime(dateValue) {
  const date = new Date(dateValue)
  const now = new Date()
  const diffMs = now - date
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return "刚刚"
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${month}-${day}`
}

async function getRecentLogs(limit = 5) {
  const res = await wx.cloud.callFunction({
    name: "inventory",
    data: {
      action: "recentLogs",
      limit
    }
  })

  const result = res.result

  if (!result || !result.success) {
    throw new Error(result?.message || "读取最近更新失败")
  }

  return result.logs.map(log => ({
    ...log,
    timeText: formatRelativeTime(log.createdAt)
  }))
}

module.exports = {
  getRecentLogs
}