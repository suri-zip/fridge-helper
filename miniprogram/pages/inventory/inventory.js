const { getInventory } = require("../../services/inventory")
const { refreshFamilyProfileFromCloud, getFridgeAreaItemCount, isAreaStorage } = require("../../services/fridgeProfile")
const { FOOD_CATEGORIES } = require("../../services/foodCategories")

Page({
  data: {
    inventory: [],
    displayList: [],
    fridgeAreas: [],
    categories: [],
    categoryMode: "area",
    currentCategory: "all",
    keyword: "",
    loading: false
  },

  async onShow() {
    const app = getApp()

  const passedKeyword = app.globalData.inventoryKeyword || ""
  const passedCategory = app.globalData.inventoryFilter || null
  const updates = {}

  if (passedKeyword) {
    updates.keyword = passedKeyword
    app.globalData.inventoryKeyword = ""
  }

  if (passedCategory) {
    updates.currentCategory = passedCategory
    app.globalData.inventoryFilter = null
  }

  if (Object.keys(updates).length > 0) {
    this.setData(updates)
  }
    await this.loadInventory()
  },

  buildCategories(mode, fridgeAreas = []) {
    if (mode === "food") {
      return [
        { label: "全部", value: "all" },
        ...FOOD_CATEGORIES.map(category => ({
          label: category,
          value: category
        }))
      ]
    }

    return [
      { label: "全部", value: "all" },
      ...fridgeAreas.map(area => ({
        label: area.name,
        value: area.id,
        count: area.count
      }))
    ]
  },

  async loadInventory() {
    this.setData({
      loading: true
    })

    try {
      const [inventory, profileResult] = await Promise.all([
        getInventory(),
        refreshFamilyProfileFromCloud()
      ])

      const profile = profileResult.profile || { areas: [] }
      const fridgeAreas = Array.isArray(profile.areas)
        ? profile.areas.map(area => ({
            ...area,
            count: getFridgeAreaItemCount(area, inventory)
          }))
        : []

      const categories = this.buildCategories("area", fridgeAreas)

      this.setData({
        inventory,
        fridgeAreas,
        categories,
        categoryMode: this.data.categoryMode,
        currentCategory: this.data.currentCategory
      }, () => {
        this.filterData()
      })
    } catch (err) {
      console.error("读取库存失败：", err)

      wx.showToast({
        title: err.message || "读取库存失败",
        icon: "none"
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  switchCategoryMode(e) {
    const categoryMode = e.currentTarget.dataset.mode
    const categories = this.buildCategories(categoryMode, this.data.fridgeAreas)

    this.setData({
      categoryMode,
      categories,
      currentCategory: "all"
    }, () => {
      this.filterData()
    })
  },

  filterData() {
    const {
      inventory,
      currentCategory,
      keyword,
      categoryMode,
      fridgeAreas
    } = this.data

    let list = [...inventory]

    if (currentCategory !== "all") {
      if (categoryMode === "food") {
        list = list.filter(item => item.category === currentCategory)
      } else {
        const selectedArea = fridgeAreas.find(area => area.id === currentCategory)

        list = list.filter(item => {
          if (!selectedArea) {
            return false
          }

          return isAreaStorage(selectedArea, item.storage)
        })
      }
    }

    const normalizedKeyword = keyword.trim()

    if (normalizedKeyword) {
      list = list.filter(item =>
        item.name.includes(normalizedKeyword)
      )
    }

    this.setData({
      displayList: list
    })
  },

  changeCategory(e) {
    this.setData({
      currentCategory: e.currentTarget.dataset.category
    }, () => {
      this.filterData()
    })
  },

  onSearch(e) {
    this.setData({
      keyword: e.detail.value
    }, () => {
      this.filterData()
    })
  },

  clearSearch() {
    this.setData({
      keyword: ""
    }, () => {
      this.filterData()
    })
  },

  setArea({ areaId, areaType }) {
    if (!areaId) {
      return
    }

    const categories = this.buildCategories("area", this.data.fridgeAreas)

    this.setData({
      categoryMode: "area",
      categories,
      currentCategory: areaId,
      keyword: ""
    }, () => {
      this.filterData()
    })
  },

  onFoodTap(e) {
    const id = e.currentTarget.dataset.id

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    })
  }
})