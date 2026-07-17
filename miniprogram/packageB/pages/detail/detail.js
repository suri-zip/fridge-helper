const { getFoodById, updateFood, deleteFood } = require("../../../services/inventory")
const { getFridgeStorageOptions } = require("../../../services/fridgeProfile")
const { FOOD_CATEGORIES } = require("../../../services/foodCategories")

Page({
  data: {
    id: "",
    item: null,
    form: {},
    isEditing: false,
    loading: true,
    storageOptions: [],
    storageIndex: 0,
    categoryOptions: FOOD_CATEGORIES,
    unitOptions: ["个", "盒", "袋", "瓶", "斤", "g", "kg"],
    emojiOptions: ["🥚", "🥛", "🍓", "🥬", "🥩", "🍗", "🐟", "🥟", "🍞", "🍰", "🍎", "🍌", "🥕", "🍅", "🥔", "🧀", "🥫", "🍽️"]
  },

  async onLoad(options) {
    const id = options.id
    this.setData({ id })
    await this.loadFood()
  },

  async loadFood() {
  this.setData({
    loading: true
  })

  try {
    const item = await getFoodById(this.data.id)

    if (!item) {
      wx.showToast({
        title: "没找到食材",
        icon: "none"
      })
      return
    }

    const storageOptions = getFridgeStorageOptions()

    const storageIndex = storageOptions.findIndex(
      option => String(option.value) === String(item.storage)
    )

    this.setData({
      item,
      form: { ...item },
      storageOptions,
      storageIndex: storageIndex >= 0 ? storageIndex : 0
    })
  } catch (err) {
    console.error("读取详情失败：", err)

    wx.showToast({
      title: err.message || "读取失败",
      icon: "none"
    })
  } finally {
    this.setData({
      loading: false
    })
  }
},


  startEdit() {
    this.setData(
      {
        isEditing: true,
        form: { ...this.data.item }
      }
    )
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
    const storageIndex = Number(e.detail.value)
    const selectedStorage = this.data.storageOptions[storageIndex]

    if (!selectedStorage) {
      return
    }

    this.setData({
      storageIndex,
      "form.storage": selectedStorage ? selectedStorage.value : ""
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

  async saveEdit() {
    const form = this.data.form

    if (!form.name.trim()) {
      wx.showToast({
        title: "食材名不能为空",
        icon: "none"
      })
      return
    }

    const updated = await updateFood(this.data.id, {
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
  },

  async deleteItem() {
    const item = this.data.item

    if (!item) {
      return
    }

    const result = await new Promise(resolve => {
      wx.showModal({
        title: "删除食材",
        content: `确定删除「${item.name}」吗？删除后无法恢复。`,
        confirmText: "删除",
        confirmColor: "#dc2626",
        success: resolve
      })
    })

    if (!result.confirm) {
      return
    }

    try {
      await deleteFood(this.data.id)

      wx.showToast({
        title: "已删除",
        icon: "success"
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    } catch (err) {
      console.error("删除食材失败：", err)

      wx.showToast({
        title: err.message || "删除失败",
        icon: "none"
      })
    }
  }
})