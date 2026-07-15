const { getInventory } = require("../../services/inventory")
const { refreshFamilyProfileFromCloud, setActiveArea, getFridgeAreaItemCount } = require("../../services/fridgeProfile")
const { getRecentLogs } = require("../../services/activity")
const LOGIN_STATE_KEY = "TUNTUN_LOGIN_STATE"

Page({
  data: {
    expiringItems: [],
    fridgeAreas: [],
    recentLogs: [],
    greetingText: "晚上好！",
    heroSubText: "今天冰箱很充实～",
    keyword: "",
    loading: false
  },

  getGreetingText() {
    const hour = new Date().getHours()

    if (hour < 6) {
      return "早上好！"
    }

    if (hour < 11) {
      return "上午好！"
    }

    if (hour < 14) {
      return "中午好！"
    }

    if (hour < 18) {
      return "下午好！"
    }

    return "晚上好！"
  },

  getHeroSubText(inventory = [], expiringItems = []) {
    const itemCount = inventory.length

    if (itemCount === 0) {
      return "冰箱里还没有食材，先补一点吧～"
    }

    if (expiringItems.length > 0) {
      return `有 ${expiringItems.length} 样食材快过期了，先处理一下吧～`
    }

    if (itemCount <= 5) {
      return "冰箱有点空，记得补货～"
    }

    if (itemCount >= 20) {
      return `冰箱里一共有 ${itemCount} 样食材，今天很充实～`
    }

    return `冰箱里有 ${itemCount} 样食材，状态不错～`
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
      greetingText: this.getGreetingText(),
      keyword: ""
    })

    try {
      const [inventory, profileResult, recentLogs] = await Promise.all([
        getInventory(),
        refreshFamilyProfileFromCloud(),
        getRecentLogs(5)
      ])

      const profile = profileResult.profile

      const expiringItems = inventory.filter(item => item.status === "warning" || item.status === "danger")
      const fridgeAreas = Array.isArray(profile.areas)
        ? profile.areas.map(area => ({
            ...area,
            count: getFridgeAreaItemCount(area, inventory)
          }))
        : []
      const heroSubText = this.getHeroSubText(inventory, expiringItems)

      this.setData({
        expiringItems,
        fridgeAreas,
        recentLogs,
        heroSubText
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
          if (typeof page.setArea === "function") {
            page.setArea({ areaId, areaType })
          }
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