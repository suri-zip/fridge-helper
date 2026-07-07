const { getInventory } = require("../../services/inventory")
const inventory = getInventory()

Page({
  data: {
    expiringItems: [],
    fridgeAreas: [],
    recentLogs: [
      "妈妈 买了草莓",
      "你 吃掉了 2 个鸡蛋"
    ]
  },

  onShow() {
    const inventory = getInventory()
    const expiringItems = inventory.filter(item => item.status === "warning" || item.status === "danger")

    const fridgeAreas = [
      { name: "冷藏", icon: "🧊", count: inventory.filter(item => item.storage === "冷藏").length },
      { name: "冷冻", icon: "❄️", count: inventory.filter(item => item.storage === "冷冻").length },
      { name: "常温", icon: "🥫", count: inventory.filter(item => item.storage === "常温").length },
      { name: "全部", icon: "📦", count: inventory.length }
    ]

    this.setData({
      expiringItems,
      fridgeAreas
    })
  },

  goInventory(e) {
    const category = e.currentTarget.dataset.category || "全部"
    wx.switchTab({
      url: "/pages/inventory/inventory",
      success() {
        const page = getCurrentPages().pop()
        if (page) {
          page.setCategory(category)
        }
      }
    })
  },

  onFoodTap(e) {
    const item = e.detail && e.detail.item
  
    if (!item || !item.id) {
      console.warn("没有拿到食材数据：", e)
      return
    }
  
    wx.navigateTo({
      url: `/pages/detail/detail?id=${item.id}`
    })
  }
})