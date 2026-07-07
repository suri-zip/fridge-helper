const { getFoodById, updateFood } = require("../../services/inventory")

Page({
  data: {
    id: "",
    item: null,
    form: {},
    isEditing: false,

    storageOptions: ["冷藏", "冷冻", "常温"],
    categoryOptions: ["水果", "蔬菜", "肉类", "蛋类", "饮料", "速食", "甜品", "其他"],
    unitOptions: ["个", "盒", "袋", "瓶", "斤", "g", "kg"],
    emojiOptions: ["🥚", "🥛", "🍓", "🥬", "🥩", "🍗", "🐟", "🥟", "🍞", "🍰", "🍎", "🍌", "🥕", "🍅", "🥔", "🧀", "🥫", "🍽️"]
  },

  onLoad(options) {
    const id = options.id
    this.setData({ id })
    this.loadFood(id)
  },

  loadFood(id) {
    const item = getFoodById(id)

    if (!item) {
      wx.showToast({
        title: "没找到食材",
        icon: "none"
      })
      return
    }

    this.setData({
      item,
      form: { ...item }
    })
  },

  startEdit() {
    this.setData({
      isEditing: true,
      form: { ...this.data.item }
    })
  },

  cancelEdit() {
    this.setData({
      isEditing: false,
      form: { ...this.data.item }
    })
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
    this.setData({
      "form.storage": this.data.storageOptions[e.detail.value]
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

  increaseQuantity() {
    this.setData({
      "form.quantity": Number(this.data.form.quantity || 0) + 1
    })
  },

  decreaseQuantity() {
    const next = Math.max(0, Number(this.data.form.quantity || 0) - 1)

    this.setData({
      "form.quantity": next
    })
  },

  saveEdit() {
    const form = this.data.form

    if (!form.name.trim()) {
      wx.showToast({
        title: "食材名不能为空",
        icon: "none"
      })
      return
    }

    const updated = updateFood(this.data.id, {
      ...form,
      quantity: Number(form.quantity),
      expireDate: form.expireDate || ""
    })

    this.setData({
      item: updated,
      form: { ...updated },
      isEditing: false
    })

    wx.showToast({
      title: "已保存",
      icon: "success"
    })
  }
})