const { getInventory } = require("../../services/inventory")
const { getFridgeAreas, setActiveArea } = require("../../services/fridgeProfile")

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
    const fridgeAreas = getFridgeAreas()

    this.setData({
      expiringItems,
      fridgeAreas
    })
  },

  goInventory(e) {
    const areaId = e.currentTarget.dataset.areaId
    const areaType = e.currentTarget.dataset.areaType || "全部"

    if (areaId) {
      setActiveArea(areaId)
    }

    wx.switchTab({
      url: "/pages/inventory/inventory",
      success() {
        const page = getCurrentPages().pop()
        if (page) {
          page.setArea({ areaId, areaType })
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