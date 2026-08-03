const { addFood } = require("../../../services/inventory")
const { FOOD_CATEGORIES } = require("../../../services/foodCategories")
const { getFridgeStorageOptions, refreshFamilyProfileFromCloud } = require("../../../services/fridgeProfile")
const { getDaysLeft } = require("../../../utils/date")

const LOGIN_STATE_KEY = "TUNTUN_LOGIN_STATE"

Page({
  data: {
    saving: false,
    form: {},
    emojiOptions: ["🥚", "🥛", "🧀",  "🥩", "🍗", "🐟", "🦐", "🍞", "🍰", "🍎","🍓", "🍌", "🥬", "🥕", "🍅", "🥔", "🥫", "🍚", "🍜", "🍲",  "🥟", "🍽️"],
    storageOptions: [],
    storageIndex: 0,
    categoryOptions: FOOD_CATEGORIES,
    categoryIndex: 13,
    unitOptions: ["个", "盒", "袋", "碗", "瓶", "杯", "斤", "g", "kg"],
    quickShelfLifeValue: "1",
    quickShelfLifeUnit: "周",
    quickShelfLifeUnitOptions: ["周", "月", "年"]
  },

  getInitialForm() {
    return {
      name: "",
      emoji: "🍽️",
      category: "其他",
      storage: "",
      quantity: "",
      unit: "个",
      purchaseDate: this.getToday(),
      expireDate: ""
    }
  },

  resetForm() {
    const categoryIndex = this.data.categoryOptions.indexOf("其他")

    this.setData({
      form: this.getInitialForm(),
      storageIndex: 0,
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
    }, () => {
      this.updateExpireDateByQuickShelfLife()
    })
  },

  async loadStorageOptions() {
    try {
      await refreshFamilyProfileFromCloud()
    } catch (err) {
      console.error("刷新家庭区域失败：", err)
    }

    const storageOptions = getFridgeStorageOptions()
    const storageIndex = 0
    const storage = storageOptions[storageIndex] ? storageOptions[storageIndex].value : ""

    this.setData({
      storageOptions,
      storageIndex,
      "form.storage": storage || this.data.form.storage
    })
  },

  getToday() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  },

  padNumber(value) {
    return String(value).padStart(2, "0")
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = this.padNumber(date.getMonth() + 1)
    const day = this.padNumber(date.getDate())

    return `${year}-${month}-${day}`
  },

  addDuration(date, amount, unit) {
    const nextDate = new Date(date)

    if (unit === "周") {
      nextDate.setDate(nextDate.getDate() + amount * 7)
    } else if (unit === "月") {
      nextDate.setMonth(nextDate.getMonth() + amount)
    } else if (unit === "年") {
      nextDate.setFullYear(nextDate.getFullYear() + amount)
    }

    return nextDate
  },

  updateExpireDateByQuickShelfLife() {
    const purchaseDate = this.data.form.purchaseDate || this.getToday()
    const value = Number(this.data.quickShelfLifeValue)
    const unit = this.data.quickShelfLifeUnit

    if (!Number.isFinite(value) || value <= 0) {
      return
    }

    const baseDate = new Date(`${purchaseDate}T00:00:00`)
    if (Number.isNaN(baseDate.getTime())) {
      return
    }

    const expireDate = this.addDuration(baseDate, value, unit)

    this.setData({
      "form.expireDate": this.formatDate(expireDate)
    })
  },

  async onSave() {
    const form = this.data.form

    if (!form.name.trim()) {
      wx.showToast({
        title: "请输入食材名称",
        icon: "none"
      })
      return
    }

    if (
      form.quantity === "" ||
      Number(form.quantity) < 0
    ) {
      wx.showToast({
        title: "请输入正确数量",
        icon: "none"
      })
      return
    }

    this.setData({
      saving: true
    })

    try {
      await addFood({
        name: form.name.trim(),
        emoji: form.emoji || "🍽️",
        category: form.category,
        storage: form.storage,
        quantity: Number(form.quantity),
        unit: form.unit,
        purchaseDate: form.purchaseDate,
        expireDate: form.expireDate || "",
        note: form.note || ""
      })

      wx.showToast({
        title: "添加成功",
        icon: "success"
      })

      setTimeout(() => {
        wx.switchTab({
          url: "/packageA/pages/inventory/inventory"
        })
      }, 500)
    } catch (err) {
      console.error("添加食材失败：", err)

      wx.showToast({
        title: err.message || "添加失败",
        icon: "none"
      })
    } finally {
      this.setData({
        saving: false
      })
    }
  },


  onLoad() {
    this.resetForm()
  },

  onShow() {
    const loginState = wx.getStorageSync(LOGIN_STATE_KEY)

    if (!loginState || !loginState.family) {
      wx.hideTabBar()
      wx.reLaunch({
        url: "/packageA/pages/profile/profile"
      })
      return
    }

    wx.showTabBar()

    this.resetForm()
    this.loadStorageOptions()
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value

    this.setData({
      [`form.${field}`]: value
    }, () => {
      if (field === "purchaseDate") {
        this.updateExpireDateByQuickShelfLife()
      }
    })
  },

  selectEmoji(e) {
    this.setData({
      "form.emoji": e.currentTarget.dataset.emoji
    })
  },

  onStorageChange(e) {
    const storageIndex = Number(e.detail.value)
    const selectedStorage = this.data.storageOptions[storageIndex]

    if (!selectedStorage) {
      return
    }

    this.setData({
      storageIndex,
      "form.storage": selectedStorage.value
    })
  },

  selectCategory(e) {
    const categoryIndex = Number(e.currentTarget.dataset.index)
    const category = this.data.categoryOptions[categoryIndex]

    if (!category) {
      return
    }

    this.setData({
      categoryIndex,
      "form.category": category
    })
  },

  onUnitChange(e) {
    this.setData({
      "form.unit": this.data.unitOptions[e.detail.value]
    })
  },

  onExpireDateChange(e) {
    this.setData({
      "form.expireDate": e.detail.value
    })
  },

  onPurchaseDateChange(e) {
    this.setData({
      "form.purchaseDate": e.detail.value
    }, () => {
      this.updateExpireDateByQuickShelfLife()
    })
  },

  onQuickShelfLifeValueInput(e) {
    this.setData({
      quickShelfLifeValue: e.detail.value
    }, () => {
      this.updateExpireDateByQuickShelfLife()
    })
  },

  onQuickShelfLifeUnitChange(e) {
    const unitIndex = Number(e.detail.value)
    const quickShelfLifeUnit = this.data.quickShelfLifeUnitOptions[unitIndex] || "周"

    this.setData({
      quickShelfLifeUnit
    }, () => {
      this.updateExpireDateByQuickShelfLife()
    })
  },


  getStatus(expireDate) {
    if (!expireDate) return "fresh"
    const days = getDaysLeft(expireDate)
    if (days <= 0) return "danger"
    if (days <= 2) return "warning"
    return "fresh"
  },

  increaseQuantity() {
    this.setData({
      "form.quantity": Number(this.data.form.quantity || 0) + 1
    })
  },

  decreaseQuantity() {
    const quantity = Math.max(0, Number(this.data.form.quantity || 0) - 1)

    this.setData({
      "form.quantity": quantity
    })
  }
})