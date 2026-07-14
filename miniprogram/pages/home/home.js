const { getInventory } = require("../../services/inventory")
const { refreshFamilyProfileFromCloud, setActiveArea } = require("../../services/fridgeProfile")

const LOGIN_STATE_KEY = "TUNTUN_LOGIN_STATE"

Page({
  data: {
    expiringItems: [],
    fridgeAreas: [],
    recentLogs: [],
    keyword: "",
    loading: false
  },

  async onShow() {
    const loginState = wx.getStorageSync(LOGIN_STATE_KEY)

    if (!loginState || !loginState.family) {
      wx.hideTabBar()
      wx.reLaunch({
        url: "/pages/profile/profile"
      })
      return
    }

    wx.showTabBar()

    this.setData({
      loading: true,
      keyword: ""
    })

    try {
      const [inventory, profileResult] = await Promise.all([
        getInventory(),
        refreshFamilyProfileFromCloud()
      ])

      const profile = profileResult.profile

      const expiringItems = inventory.filter(item => item.status === "warning" || item.status === "danger")
      const fridgeAreas = Array.isArray(profile.areas)
        ? profile.areas.map(area => ({
            ...area,
            count: inventory.filter(item => {
              return item.storage === area.id || item.storage === area.type || item.storage === area.name
            }).length
          }))
        : []

      this.setData({
        expiringItems,
        fridgeAreas
      })
    } catch (err) {
      console.error("读取首页数据失败：", err)

      wx.showToast({
        title: err.message || "读取首页数据失败",
        icon: "none"
      })
    } finally {
      this.setData({
        loading: false
      })
    }
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

  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
},

clearSearch() {
  this.setData({
    keyword: ""
  })
},


  submitSearch() {
    const keyword = String(this.data.keyword || "").trim()


    if (!keyword) {
      wx.showToast({
        title: "请输入搜索关键词",
        icon: "none"
      })
      return
    }
    
    getApp().globalData.inventoryKeyword = keyword
    getApp().globalData.inventoryFilter = "all"

    wx.switchTab({
    url: "/pages/inventory/inventory"
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