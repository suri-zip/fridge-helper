const { addFood, INVENTORY_CATEGORIES } = require("../../services/inventory")
const { getFridgeStorageOptions } = require("../../services/fridgeProfile")
const { getDaysLeft } = require("../../utils/date")

Page({
  data: {
    form: {
      name: "",
      emoji: "🍽️",
      category: "其他",
      storage: "",
      quantity: "",
      unit: "个",
      purchaseDate: "",
      expireDate: ""
    },
    emojiOptions: ["🥚", "🥛", "🍓", "🥬", "🥩", "🍗", "🐟", "🥟", "🍞", "🍰", "🍎", "🍌", "🥕", "🍅", "🥔", "🧀", "🥫", "🍽️"],
    storageOptions: [],
    storageIndex: 0,
    categoryOptions: INVENTORY_CATEGORIES,
    unitOptions: ["个", "盒", "袋", "瓶", "斤", "g", "kg"]
  },

  getToday() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  },

  syncStorageOptions() {
    const storageOptions = getFridgeStorageOptions()
    const currentStorage = this.data.form.storage || (storageOptions[0] && storageOptions[0].value) || ""
    let storageIndex = storageOptions.findIndex(option => option.value === currentStorage || option.type === currentStorage || option.name === currentStorage)

    if (storageIndex < 0) {
      storageIndex = 0
    }

    this.setData({
      storageOptions,
      storageIndex,
      "form.storage": currentStorage || (storageOptions[0] && storageOptions[0].value) || ""
    })
  },

  onLoad() {
    this.setData({
      "form.purchaseDate": this.getToday()
    })

    this.syncStorageOptions()
  },

  onShow() {
    this.syncStorageOptions()
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value

    this.setData({
      [`form.${field}`]: value
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

  onCategoryChange(e) {
    this.setData({
      "form.category": this.data.categoryOptions[e.detail.value]
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
    })
  },

  onSave() {
    const form = this.data.form

    if (!form.name.trim()) {
      wx.showToast({
        title: "请填写食材名",
        icon: "none"
      })
      return
    }

    if (!form.quantity) {
      wx.showToast({
        title: "请填写数量",
        icon: "none"
      })
      return
    }

    addFood({
      ...form,
      quantity: Number(form.quantity),
      purchaseDate: form.purchaseDate,
      expireDate: form.expireDate || ""
    })

    wx.showToast({
      title: "添加成功",
      icon: "success"
    })

    setTimeout(() => {
      wx.switchTab({
        url: "/pages/inventory/inventory"
      })
    }, 500)
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