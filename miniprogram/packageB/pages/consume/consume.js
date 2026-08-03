const {
  getInventory,
  consumeFood
} = require("../../../services/inventory")

Page({
  data: {
    inventory: [],
    filteredInventory: [],
    itemOptions: [],
    sortMode: "purchase-desc",
    sortLabel: "最近购买",
    sortOptions: [
      { label: "最近购买", value: "purchase-desc" },
      { label: "最早购买", value: "purchase-asc" },
      { label: "优先临期", value: "expire-asc" }
    ],

    itemIndex: 0,
    selectedItem: null,

    searchKeyword: "",
    searchDraft: "",
    showAllItems: false,

    amount: 1,
    saving: false,
    loading: true
  },

  async onLoad() {
    await this.loadInventory()
  },

  async onShow() {
    await this.loadInventory()
  },

  buildItemLabel(item) {
    return `${item.emoji || "🍽️"} ${item.name} · 剩余 ${item.quantity}${item.unit}`
  },

  getSortDateValue(item, field) {
    const rawValue = item && item[field] ? String(item[field]).trim() : ""
    const timestamp = Date.parse(rawValue)

    return Number.isFinite(timestamp) ? timestamp : 0
  },

  sortInventory(items) {
    const sortMode = this.data.sortMode || "none"

    if (sortMode === "none") {
      return items
    }

    const sortedItems = [...items]

    sortedItems.sort((left, right) => {
      const leftPurchase = this.getSortDateValue(left, "purchaseDate")
      const rightPurchase = this.getSortDateValue(right, "purchaseDate")
      const leftExpire = this.getSortDateValue(left, "expireDate")
      const rightExpire = this.getSortDateValue(right, "expireDate")

      switch (sortMode) {
        case "purchase-desc":
          return rightPurchase - leftPurchase
        case "purchase-asc":
          return leftPurchase - rightPurchase
        case "expire-asc":
          return leftExpire - rightExpire
        default:
          return 0
      }
    })

    return sortedItems
  },

  applyFilters() {
    const keyword = String(this.data.searchKeyword || "").trim().toLowerCase()
    const filteredInventory = this.sortInventory(this.data.inventory.filter(item => {
      if (!keyword) {
        return true
      }

      const searchableText = [
        item.name,
        item.storageName,
        item.category,
        item.unit
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchableText.includes(keyword)
    }))

    const itemOptions = this.data.showAllItems
      ? filteredInventory
      : filteredInventory.slice(0, 5)

    const selectedItem = itemOptions.find(item => item._id === this.data.selectedItem?._id) || null

    this.setData({
      filteredInventory,
      itemOptions,
      selectedItem,
      itemIndex: selectedItem ? itemOptions.findIndex(item => item._id === selectedItem._id) : 0,
      amount: selectedItem ? this.data.amount : 1
    })
  },

  async loadInventory() {
    this.setData({
      loading: true
    })

    try {
      const inventory = await getInventory()

      const itemOptions = inventory
        .filter(item => Number(item.quantity) > 0)
        .map(item => ({
          ...item,
          displayLabel: this.buildItemLabel(item)
        }))

      this.setData({
        inventory: itemOptions,
        selectedItem: null,
        itemIndex: 0,
        amount: 1
      }, () => {
        this.applyFilters()
      })
    } catch (err) {
      console.error("读取库存失败：", err)

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

  onSearchInput(e) {
    this.setData({
      searchDraft: e.detail.value,
      searchKeyword: e.detail.value,
      showAllItems: false
    }, () => {
      this.applyFilters()
    })
  },

  confirmSearch() {
    this.setData({
      searchKeyword: this.data.searchDraft,
      showAllItems: false
    }, () => {
      this.applyFilters()
    })
  },

  clearSearch() {
    this.setData({
      searchKeyword: "",
      searchDraft: "",
      showAllItems: false
    }, () => {
      this.applyFilters()
    })
  },

  showMoreItems() {
    this.setData({
      showAllItems: true
    }, () => {
      this.applyFilters()
    })
  },

  onSortChange(e) {
    const selectedSort = this.data.sortOptions[Number(e.detail.value)] || this.data.sortOptions[0]

    this.setData({
      sortMode: selectedSort.value,
      sortLabel: selectedSort.label,
      showAllItems: false
    }, () => {
      this.applyFilters()
    })
  },

  onItemChange(e) {
    const itemIndex = Number(e.detail.value)
    const selectedItem = this.data.itemOptions[itemIndex]

    this.setData({
      itemIndex,
      selectedItem,
      amount: selectedItem ? 1 : 0
    })
  },

  onAmountInput(e) {
    this.setData({
      amount: e.detail.value
    })
  },

  increaseAmount() {
    const selectedItem = this.data.selectedItem

    if (!selectedItem) return

    const currentAmount = Number(this.data.amount || 0)
    const maxAmount = Number(selectedItem.quantity)

    this.setData({
      amount: Math.min(currentAmount + 1, maxAmount)
    })
  },

  decreaseAmount() {
    const currentAmount = Number(this.data.amount || 0)

    this.setData({
      amount: Math.max(currentAmount - 1, 0)
    })
  },

  selectFood(e){

    const index=e.currentTarget.dataset.index

    this.setData({
        itemIndex:index,
      selectedItem:this.data.itemOptions[index],
      amount: this.data.itemOptions[index] ? 1 : 0
    })

},



  async submitConsume() {
    const item = this.data.selectedItem
    const amount = Number(this.data.amount)

    if (!item) {
      wx.showToast({
        title: "请选择食材",
        icon: "none"
      })
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      wx.showToast({
        title: "请输入消耗数量",
        icon: "none"
      })
      return
    }

    if (amount > Number(item.quantity)) {
      wx.showToast({
        title: "消耗数量不能超过库存",
        icon: "none"
      })
      return
    }

    const modalResult = await new Promise(resolve => {
      wx.showModal({
        title: "确认消耗",
        content:
          `确定消耗 ${amount}${item.unit}${item.name} 吗？`,
        confirmText: "确认",
        success: resolve
      })
    })

    if (!modalResult.confirm) return

    this.setData({
      saving: true
    })

    try {
      await consumeFood(item._id || item.id, amount)

      wx.showToast({
        title: "已记录消耗",
        icon: "success"
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    } catch (err) {
      console.error("记录消耗失败：", err)

      wx.showToast({
        title: err.message || "记录失败",
        icon: "none"
      })
    } finally {
      this.setData({
        saving: false
      })
    }
  }
})