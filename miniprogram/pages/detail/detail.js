const { getFoodById, updateFood, deleteFood } = require("../../services/inventory")
const { FOOD_CATEGORIES } = require("../../services/foodCategories")
const { getFridgeStorageOptions, refreshFamilyProfileFromCloud } = require("../../services/fridgeProfile")

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

  onShow() {
    this.syncStorageOptions()
  },

  async loadFood() {
  this.setData({
    loading: true
  })

  try {
    await refreshFamilyProfileFromCloud()

    const storageOptions = getFridgeStorageOptions()
    const item = await getFoodById(this.data.id)

    if (!item) {
      wx.showToast({
        title: "没找到食材",
        icon: "none"
      })
      return
    }

    const storageIndex = storageOptions.findIndex(option =>
      String(option.value) === String(item.storage)
    )

    const storageLabel =
      storageIndex >= 0
        ? storageOptions[storageIndex].label
        : item.storage

    this.setData({
      storageOptions,
      storageIndex: storageIndex >= 0 ? storageIndex : 0,
      item: {
        ...item,
        storageLabel
      },
      form: {
        ...item
      }
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

  getStorageLabel(storageValue, storageOptions = this.data.storageOptions) {
    const match = storageOptions.find(option => option.value === storageValue || option.type === storageValue || option.name === storageValue)
    return match ? match.label : storageValue || "暂无"
  },

  syncStorageOptions() {
    const storageOptions = getFridgeStorageOptions()
    const currentStorage = this.data.form.storage || (this.data.item && this.data.item.storage) || (storageOptions[0] && storageOptions[0].value) || ""
    let storageIndex = storageOptions.findIndex(option => option.value === currentStorage || option.type === currentStorage || option.name === currentStorage)

    if (storageIndex < 0) {
      storageIndex = 0
    }

    this.setData({
      storageOptions,
      storageIndex,
      "form.storage": currentStorage,
      item: this.data.item
        ? {
            ...this.data.item,
            storageLabel: this.getStorageLabel(currentStorage, storageOptions)
          }
        : this.data.item
    })
  },

  startEdit() {
    this.setData(
      {
        isEditing: true,
        form: { ...this.data.item }
      },
      () => {
        this.syncStorageOptions()
      }
    )
  },

  cancelEdit() {
    this.setData({
      isEditing: false,
      form: { ...this.data.item }
    }, () => {
      this.syncStorageOptions()
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
      "form.storage": selectedStorage.value,
      "item.storageLabel": selectedStorage.label
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
      item: {
        ...updated,
        storageLabel: this.getStorageLabel(updated.storage, this.data.storageOptions)
      },
      form: { ...updated },
      isEditing: false
    })

    wx.showToast({
      title: "已保存",
      icon: "success"
    })
  }
})