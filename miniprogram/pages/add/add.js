const { addFood } = require("../../services/inventory")
const {getDaysLeft} = require("../../utils/date")

Page({
  data: {
    form: {
      name: "",
      emoji: "🍽️",
  
      category: "其他",
      storage: "冷藏",
      quantity: "",
      unit: "个",
      purchaseDate: "",
      expireDate: ""
    },
    emojiOptions: ["🥚", "🥛", "🍓", "🥬", "🥩", "🍗", "🐟", "🥟", "🍞", "🍰", "🍎", "🍌", "🥕", "🍅", "🥔", "🧀", "🥫", "🍽️"],
    storageOptions: ["冷藏", "冷冻", "常温"],
    categoryOptions: ["水果", "蔬菜", "肉类", "蛋类", "饮料", "速食", "甜品", "其他"],
    unitOptions: ["个", "盒", "袋", "瓶", "斤", "g", "kg"]
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value

    this.setData({
      [`form.${field}`]: value
    })
  },
  getToday() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  },
  selectEmoji(e) {
    this.setData({
      "form.emoji": e.currentTarget.dataset.emoji
    })
  },
  onLoad() {
    this.setData({
      "form.purchaseDate": this.getToday()
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
      expireDate: form.expireDate || "",
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
  let quantity = Number(this.data.form.quantity || 0)
  quantity--
  if (quantity < 0) {
      quantity = 0
  }
  this.setData({
      "form.quantity": quantity
  })
}
})