function getDaysLeft(expireDate) {

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expire = new Date(expireDate)
  expire.setHours(0, 0, 0, 0)

  return Math.ceil(
      ((expire - today) / (1000 * 60 * 60 * 24))
  )

}
function getExpireText(expireDate) {

  if (!expireDate) return "暂无保质期"
  const days = getDaysLeft(expireDate)
  if (days < 0) {
      return `已过期 ${Math.abs(days)} 天`
  }
  if (days === 0) {
      return "今天过期"
  }
  if (days === 1) {
      return "明天过期"
  }
  return `${days} 天后过期`
}

function getStatus(expireDate) {
  const days = getDaysLeft(expireDate)

  if (days === null) return "fresh"
  if (days <= 0) return "danger"
  if (days <= 2) return "warning"

  return "fresh"
}

module.exports = {
  getDaysLeft,
  getExpireText,
  getStatus

}