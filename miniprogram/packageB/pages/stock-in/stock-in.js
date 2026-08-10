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

  parseShelfLifeInfo(voiceText) {
    const text = String(voiceText || "")
    const now = new Date()

    const toDateString = date => {
      const d = new Date(date)
      if (Number.isNaN(d.getTime())) {
        return ""
      }
      return this.formatDate(d)
    }

    const normalizeFutureMonthDay = (month, day) => {
      const year = now.getFullYear()
      const candidate = new Date(year, month - 1, day)

      if (candidate.getTime() < new Date(year, now.getMonth(), now.getDate()).getTime()) {
        candidate.setFullYear(year + 1)
      }

      return candidate
    }

    const absoluteDateMatch = text.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日号]?/)
    if (absoluteDateMatch) {
      const year = Number(absoluteDateMatch[1])
      const month = Number(absoluteDateMatch[2])
      const day = Number(absoluteDateMatch[3])
      return {
        expireDate: toDateString(new Date(year, month - 1, day)),
        matchedText: absoluteDateMatch[0]
      }
    }

    const monthDayMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/)
    if (monthDayMatch) {
      const month = Number(monthDayMatch[1])
      const day = Number(monthDayMatch[2])
      return {
        expireDate: toDateString(normalizeFutureMonthDay(month, day)),
        matchedText: monthDayMatch[0]
      }
    }

    const dayOnlyMatch = text.match(/到\s*(\d{1,2})[日号]/)
    if (dayOnlyMatch) {
      const day = Number(dayOnlyMatch[1])
      const base = new Date(now.getFullYear(), now.getMonth(), day)
      if (base.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        base.setMonth(base.getMonth() + 1)
      }
      return {
        expireDate: toDateString(base),
        matchedText: dayOnlyMatch[0]
      }
    }

    if (text.includes("大后天")) {
      const date = new Date(now)
      date.setDate(date.getDate() + 3)
      return {
        expireDate: toDateString(date),
        matchedText: "大后天"
      }
    }

    if (text.includes("后天")) {
      const date = new Date(now)
      date.setDate(date.getDate() + 2)
      return {
        expireDate: toDateString(date),
        matchedText: "后天"
      }
    }

    if (text.includes("明天")) {
      const date = new Date(now)
      date.setDate(date.getDate() + 1)
      return {
        expireDate: toDateString(date),
        matchedText: "明天"
      }
    }

    if (text.includes("今天")) {
      return {
        expireDate: toDateString(now),
        matchedText: "今天"
      }
    }

    const durationMatch = text.match(/(保质期|到期)?\s*(有|是|到)?\s*(\d+|半|[零一二两三四五六七八九十百千]+)\s*(天|周|星期|个月|月|年)/)
    if (durationMatch) {
      const durationValue = this.parseNumberValue(durationMatch[3])
      const durationUnitRaw = durationMatch[4]

      if (Number.isFinite(durationValue) && durationValue > 0) {
        const baseDate = new Date(`${this.data.form.purchaseDate || this.getToday()}T00:00:00`)
        const targetDate = new Date(baseDate)

        if (durationUnitRaw === "天") {
          targetDate.setDate(targetDate.getDate() + durationValue)
        } else if (durationUnitRaw === "周" || durationUnitRaw === "星期") {
          targetDate.setDate(targetDate.getDate() + durationValue * 7)
        } else if (durationUnitRaw === "个月" || durationUnitRaw === "月") {
          targetDate.setMonth(targetDate.getMonth() + durationValue)
        } else if (durationUnitRaw === "年") {
          targetDate.setFullYear(targetDate.getFullYear() + durationValue)
        }

        const quickUnit = durationUnitRaw === "周" || durationUnitRaw === "星期"
          ? "周"
          : (durationUnitRaw === "个月" || durationUnitRaw === "月" ? "月" : (durationUnitRaw === "年" ? "年" : ""))

        return {
          expireDate: toDateString(targetDate),
          matchedText: durationMatch[0],
          quickShelfLifeValue: quickUnit ? String(durationValue) : "",
          quickShelfLifeUnit: quickUnit || ""
        }
      }
    }

    return {
      expireDate: "",
      matchedText: ""
    }
  },

  parseQuantityAndUnit(voiceText) {
    const text = String(voiceText || "")
    const quantityMatch = text.match(/(\d+(?:\.\d+)?|半|[零一二两三四五六七八九十百千]+)\s*(个|只|盒|袋|碗|瓶|杯|斤|g|kg|克|千克)?/i)

    if (!quantityMatch) {
      return {
        quantity: "",
        unit: "",
        matchedText: ""
      }
    }

    const parsedValue = this.parseNumberValue(quantityMatch[1])

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return {
        quantity: "",
        unit: "",
        matchedText: ""
      }
    }

    return {
      quantity: parsedValue,
      unit: this.normalizeUnit(quantityMatch[2] || ""),
      matchedText: quantityMatch[0]
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

  getVoiceFoodName(voiceText) {
    return String(voiceText || "")
      .replace(/[，。！？、,.!?]/g, " ")
      .replace(/(我|我们|咱们|今天|昨天|前天|后天|大后天|刚刚|刚才|现在|上午|中午|下午|晚上|早上|这次|这回|这会儿|本来|刚)/g, " ")
      .replace(/(要|想|帮我|请|把|给我|麻烦|可以|能不能)/g, " ")
      .replace(/(买了|买过|新买|补货|入库|添加|新增|放进|放入|采购|买|弄了|带了|带来|带回|带回来了)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  },

  applyVoicePrefill() {
    const voiceText = this.pendingVoiceText || ""

    if (!voiceText) {
      return
    }

    const shelfLifeInfo = this.parseShelfLifeInfo(voiceText)
    const quantityInfo = this.parseQuantityAndUnit(voiceText.replace(shelfLifeInfo.matchedText || "", " "))

    let foodNameText = voiceText
      .replace(shelfLifeInfo.matchedText || "", " ")
      .replace(quantityInfo.matchedText || "", " ")

    const foodName = this.getVoiceFoodName(foodNameText)

    if (!foodName) {
      wx.showToast({
        title: "没听清，请再说一遍",
        icon: "none"
      })
      this.pendingVoiceText = ""
      return
    }

    const nextData = {
      "form.name": foodName
    }

    if (quantityInfo.quantity !== "") {
      nextData["form.quantity"] = quantityInfo.quantity
    } else if (this.data.form.quantity === "" || this.data.form.quantity === undefined || this.data.form.quantity === null) {
      nextData["form.quantity"] = 1
    }

    if (quantityInfo.unit) {
      nextData["form.unit"] = quantityInfo.unit
    }

    if (shelfLifeInfo.expireDate) {
      nextData["form.expireDate"] = shelfLifeInfo.expireDate
    } else if (!this.data.form.expireDate) {
      nextData["form.expireDate"] = ""
    }

    if (shelfLifeInfo.quickShelfLifeValue && shelfLifeInfo.quickShelfLifeUnit) {
      nextData.quickShelfLifeValue = shelfLifeInfo.quickShelfLifeValue
      nextData.quickShelfLifeUnit = shelfLifeInfo.quickShelfLifeUnit
    }

    this.setData(nextData, () => {
      if (!shelfLifeInfo.expireDate && !this.data.form.expireDate) {
        // 没识别到保质期时，回退到页面默认的快速保质期规则。
        this.updateExpireDateByQuickShelfLife()
      }
    })

    wx.showToast({
      title: "已解析语音表单",
      icon: "none"
    })

    this.pendingVoiceText = ""
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


  onLoad(options) {
    this.pendingVoiceText = this.decodeVoiceText(options && options.voiceText)
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
    this.loadStorageOptions().then(() => {
      this.applyVoicePrefill()
    })
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