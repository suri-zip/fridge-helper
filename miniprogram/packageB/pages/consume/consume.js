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
    voiceHintText: "",

    amount: 1,
    saving: false,
    loading: true
  },

  parseChineseNumber(rawValue) {
    const value = String(rawValue || "").trim()

    if (!value) {
      return NaN
    }

    if (value === "半") {
      return 0.5
    }

    const digitMap = {
      "零": 0,
      "一": 1,
      "二": 2,
      "两": 2,
      "三": 3,
      "四": 4,
      "五": 5,
      "六": 6,
      "七": 7,
      "八": 8,
      "九": 9
    }
    const unitMap = {
      "十": 10,
      "百": 100,
      "千": 1000
    }

    let total = 0
    let current = 0

    for (let i = 0; i < value.length; i += 1) {
      const char = value[i]

      if (Object.prototype.hasOwnProperty.call(digitMap, char)) {
        current = digitMap[char]
        continue
      }

      if (Object.prototype.hasOwnProperty.call(unitMap, char)) {
        const unit = unitMap[char]
        total += (current || 1) * unit
        current = 0
        continue
      }

      return NaN
    }

    return total + current
  },

  parseNumberValue(rawValue) {
    const value = String(rawValue || "").trim()

    if (!value) {
      return NaN
    }

    if (/^\d+(\.\d+)?$/.test(value)) {
      return Number(value)
    }

    return this.parseChineseNumber(value)
  },

  normalizeUnit(rawUnit) {
    const unit = String(rawUnit || "").trim().toLowerCase()
    const unitAliasMap = {
      "个": "个",
      "只": "个",
      "盒": "盒",
      "袋": "袋",
      "碗": "碗",
      "瓶": "瓶",
      "杯": "杯",
      "斤": "斤",
      "g": "g",
      "克": "g",
      "kg": "kg",
      "千克": "kg"
    }

    return unitAliasMap[unit] || ""
  },

  parseAmountAndUnit(voiceText) {
    const text = String(voiceText || "")
    const amountMatch = text.match(/(\d+(?:\.\d+)?|半|[零一二两三四五六七八九十百千]+)\s*(个|只|盒|袋|碗|瓶|杯|斤|g|kg|克|千克)?/i)

    if (!amountMatch) {
      return {
        amount: "",
        unit: "",
        matchedText: ""
      }
    }

    const parsedAmount = this.parseNumberValue(amountMatch[1])

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return {
        amount: "",
        unit: "",
        matchedText: ""
      }
    }

    return {
      amount: parsedAmount,
      unit: this.normalizeUnit(amountMatch[2] || ""),
      matchedText: amountMatch[0]
    }
  },

  decodeVoiceText(rawValue) {
    const input = String(rawValue || "").trim()

    if (!input) {
      return ""
    }

    try {
      return decodeURIComponent(input)
    } catch (err) {
      return input
    }
  },

  getVoiceKeyword(voiceText) {
    const normalizedText = String(voiceText || "")
      .replace(/[，。！？、,.!?]/g, " ")
      .replace(/(今天|昨天|前天|刚刚|刚才|刚刚好|中午|早上|上午|下午|晚上|夜里|现在|刚)/g, " ")
      .replace(/(我要|帮我|请|把|我|我们|已经|一下|一下子|这个|那个|这份|那份)/g, " ")
      .replace(/(消耗了?|吃掉了?|吃了|用了|用掉了?|减少了?|做了|煮了|喝了|干掉了?)/g, " ")
      .replace(/[的地得了着过吧呀啊呢哦嘛]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const firstSegment = normalizedText.split(/和|跟|还有|以及|及|并且|然后|再|并/)[0] || ""

    return firstSegment
      .replace(/\s+/g, " ")
      .trim()
  },

  applyVoicePrefill() {
    const rawVoiceText = this.pendingVoiceText || ""

    if (!rawVoiceText) {
      return
    }

    const amountInfo = this.parseAmountAndUnit(rawVoiceText)
    const keyword = this.getVoiceKeyword(rawVoiceText.replace(amountInfo.matchedText || "", " "))

    if (!keyword) {
      wx.showToast({
        title: "没听清，请再说一遍",
        icon: "none"
      })
      this.pendingVoiceText = ""
      return
    }

    this.setData({
      searchDraft: keyword,
      searchKeyword: keyword,
      showAllItems: true,
      voiceHintText: ""
    }, () => {
      this.applyFilters()

      const lowerKeyword = keyword.toLowerCase()
      const exactItem = this.data.itemOptions.find(item => String(item.name || "").toLowerCase() === lowerKeyword)
      const unitMatchedItem = amountInfo.unit
        ? this.data.itemOptions.find(item => {
            const itemName = String(item.name || "").toLowerCase()
            const itemUnit = String(item.unit || "").toLowerCase()
            return itemName.includes(lowerKeyword) && itemUnit === amountInfo.unit.toLowerCase()
          })
        : null
      const fuzzyItem = this.data.itemOptions.find(item => String(item.name || "").toLowerCase().includes(lowerKeyword))
      const selectedItem = exactItem || unitMatchedItem || fuzzyItem || null

      if (selectedItem) {
        const resolvedAmount = amountInfo.amount !== ""
          ? Math.min(amountInfo.amount, Number(selectedItem.quantity || 0) || amountInfo.amount)
          : 1

        this.setData({
          selectedItem,
          itemIndex: this.data.itemOptions.findIndex(item => item._id === selectedItem._id),
          amount: resolvedAmount,
          voiceHintText: "已自动匹配食材，可直接确认或微调数量"
        })
      } else {
        const fallbackOptions = this.sortInventory(this.data.inventory).slice(0, 5)

        this.setData({
          itemOptions: fallbackOptions,
          selectedItem: null,
          itemIndex: 0,
          amount: 1,
          voiceHintText: `未找到“${keyword}”，请手动选择最接近的食材`
        })

        wx.showToast({
          title: "未精确匹配，请手动选择",
          icon: "none"
        })
      }
    })

    if (amountInfo.amount !== "") {
      wx.showToast({
        title: "已解析语音并填入数量",
        icon: "none"
      })
    }

    this.pendingVoiceText = ""
  },

  async onLoad(options) {
    this.pendingVoiceText = this.decodeVoiceText(options && options.voiceText)
    await this.loadInventory()
    this.applyVoicePrefill()
  },

  async onShow() {
    await this.loadInventory()
    this.applyVoicePrefill()
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
      showAllItems: false,
      voiceHintText: ""
    }, () => {
      this.applyFilters()
    })
  },

  confirmSearch() {
    this.setData({
      searchKeyword: this.data.searchDraft,
      showAllItems: false,
      voiceHintText: ""
    }, () => {
      this.applyFilters()
    })
  },

  clearSearch() {
    this.setData({
      searchKeyword: "",
      searchDraft: "",
      showAllItems: false,
      voiceHintText: ""
    }, () => {
      this.applyFilters()
    })
  },

  showMoreItems() {
    this.setData({
      showAllItems: true,
      voiceHintText: ""
    }, () => {
      this.applyFilters()
    })
  },

  onSortChange(e) {
    const selectedSort = this.data.sortOptions[Number(e.detail.value)] || this.data.sortOptions[0]

    this.setData({
      sortMode: selectedSort.value,
      sortLabel: selectedSort.label,
      showAllItems: false,
      voiceHintText: ""
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