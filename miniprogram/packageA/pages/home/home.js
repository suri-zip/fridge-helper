const { getInventory } = require("../../../services/inventory")
const { refreshFamilyProfileFromCloud, setActiveArea, getFridgeAreaItemCount } = require("../../../services/fridgeProfile")
const { getRecentLogs } = require("../../../services/activity")
const LOGIN_STATE_KEY = "TUNTUN_LOGIN_STATE"
const MIN_HOLD_MS = 220
const MIN_RECORD_DURATION_MS = 600
const STOCK_IN_KEYWORDS = ["买了", "新买", "刚买", "补货", "入库", "添加", "新增", "放进", "采购"]
const CONSUME_KEYWORDS = ["吃了", "吃掉", "用了", "用掉", "消耗", "减少", "做了", "煮了", "喝了", "用完"]

Page({
  data: {
    expiringItems: [],
    fridgeAreas: [],
    recentLogs: [],
    greetingText: "晚上好！",
    heroSubText: "今天冰箱很充实～",
    keyword: "",
    loading: false,
    isRecording: false,
    isRecognizing: false,
    voiceStatusText: "长按说话",
    voiceResultText: ""
  },

  onLoad() {
    this.initRecorder()
    this.systemInfo = wx.getSystemInfoSync()
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager()

    this.recorderManager.onStart(() => {
      this.recordStartedAt = Date.now()

      console.log("[voice] recorder started")

      this.setData({
        isRecording: true,
        voiceStatusText: "点击结束录音"
      })
    })

    this.recorderManager.onStop(async res => {
      const recordDuration = Math.max(0, Date.now() - Number(this.recordStartedAt || Date.now()))

      console.log("[voice] recorder stopped", {
        tempFilePath: res && res.tempFilePath,
        fileSize: res && res.fileSize,
        durationMs: recordDuration
      })

      this.setData({
        isRecording: false,
        isRecognizing: true,
        voiceStatusText: "识别中..."
      })

      try {
        if (!res || !res.tempFilePath) {
          throw new Error("录音文件为空，请重试")
        }

        if (recordDuration < MIN_RECORD_DURATION_MS) {
          throw new Error("说话时间太短，请长按 1 秒再松手")
        }

        const text = await this.recognizeSpeech(res.tempFilePath, res.fileSize)
        this.setData({
          voiceResultText: text,
          voiceStatusText: "长按开始录音"
        })
        this.routeVoiceText(text)
      } catch (err) {
        console.error("[voice] recognize failed", err)

        wx.showToast({
          title: err.message || "语音识别失败",
          icon: "none"
        })
        this.setData({
          voiceStatusText: "长按说话"
        })
      } finally {
        this.setData({
          isRecognizing: false
        })
      }
    })

    this.recorderManager.onError(err => {
      console.error("录音失败：", err)
      this.setData({
        isRecording: false,
        isRecognizing: false,
        voiceStatusText: "长按开始录音"
      })
      wx.showToast({
        title: "录音失败，请重试",
        icon: "none"
      })
    })
  },

  detectVoiceFormat(filePath) {
    const match = String(filePath || "").toLowerCase().match(/\.([a-z0-9]+)$/)
    const ext = match ? match[1] : ""

    if (ext === "m4a" || ext === "aac" || ext === "wav" || ext === "mp3") {
      return ext
    }

    return "mp3"
  },

  async getFileSize(filePath) {
    const fs = wx.getFileSystemManager()

    return new Promise(resolve => {
      fs.getFileInfo({
        filePath,
        success: res => resolve(Number(res.size || 0)),
        fail: () => resolve(0)
      })
    })
  },

  async recognizeSpeech(filePath, knownSize) {
    if (!filePath) {
      throw new Error("录音文件为空，请重试")
    }

    const voiceFormat = this.detectVoiceFormat(filePath)
    const fileSize = Number(knownSize || 0) || await this.getFileSize(filePath)

    console.log("[voice] prepare upload", {
      filePath,
      detectedFormat: voiceFormat,
      fileSize
    })

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error("audio data empty，请重试或改用真机")
    }

    const normalizedBase64 = await this.readVoiceFileAsBase64(filePath, fileSize)
    const inferredDataLen = this.getBase64ByteLength(normalizedBase64)

    console.log("[voice] base64 length", normalizedBase64.length)
    console.log("[voice] inferred dataLen", inferredDataLen)

    if (!normalizedBase64) {
      throw new Error("audio data empty，请重试或改用真机")
    }

    const cfRes = await wx.cloud.callFunction({
      name: "speechToText",
      data: {
        data: normalizedBase64,
        voiceFormat,
        dataLen: inferredDataLen || fileSize
      }
    })

    const result = (cfRes && cfRes.result) || {}

    if (!result.success) {
      const errorText = String(result.error || "")
      const errorCode = String(result.code || "")

      console.error("[voice] asr error result", {
        code: errorCode,
        error: errorText,
        voiceFormat,
        fileSize,
        inferredDataLen
      })

      if (/Audio decoding failed|decode|format/i.test(errorText)) {
        throw new Error("录音编码不兼容，请用真机测试语音识别")
      }

      throw new Error(errorText || "语音识别失败")
    }

    const text = String(result.text || "").trim()

    if (!text) {
      throw new Error("没有识别到内容，请再试一次")
    }

    return text
  },

  async readVoiceFileAsBase64(filePath, expectedByteSize = 0) {
    const fs = wx.getFileSystemManager()
    const expectedSize = Number(expectedByteSize || 0)
    const candidates = []
    const pushCandidate = (source, value) => {
      const normalized = this.normalizeBase64String(value)

      if (!normalized) {
        return
      }

      const inferredLen = this.getBase64ByteLength(normalized)

      candidates.push({
        source,
        value: normalized,
        inferredLen
      })
    }

    // 优先按二进制读取，再手动转 base64，避免部分环境对 encoding=base64 的兼容问题。
    const binaryResult = await new Promise(resolve => {
      fs.readFile({
        filePath,
        success: res => resolve({ ok: true, data: res.data }),
        fail: err => resolve({ ok: false, err })
      })
    })

    if (binaryResult.ok && binaryResult.data) {
      try {
        if (binaryResult.data instanceof ArrayBuffer) {
          const base64FromBuffer = wx.arrayBufferToBase64(binaryResult.data)
          pushCandidate("arrayBuffer", base64FromBuffer)
        }

        if (typeof binaryResult.data === "string") {
          pushCandidate("raw-string-base64", binaryResult.data)

          const repaired = this.binaryStringToBase64(binaryResult.data)
          pushCandidate("raw-string-repaired", repaired)
        }
      } catch (err) {
        console.warn("[voice] arrayBuffer to base64 failed", err)
      }
    }

    const encodedResult = await new Promise((resolve, reject) => {
      fs.readFile({
        filePath,
        encoding: "base64",
        success: res => resolve(res.data),
        fail: reject
      })
    })

    pushCandidate("encoding-base64", encodedResult)

    const repairedEncoded = this.binaryStringToBase64(encodedResult)
    pushCandidate("encoding-base64-repaired", repairedEncoded)

    if (!candidates.length) {
      return ""
    }

    const preferredCandidate = candidates.reduce((best, current) => {
      if (!best) {
        return current
      }

      const bestDiff = expectedSize > 0 ? Math.abs(best.inferredLen - expectedSize) : Number.MAX_SAFE_INTEGER
      const currentDiff = expectedSize > 0 ? Math.abs(current.inferredLen - expectedSize) : Number.MAX_SAFE_INTEGER

      if (currentDiff < bestDiff) {
        return current
      }

      if (currentDiff === bestDiff && current.value.length > best.value.length) {
        return current
      }

      return best
    }, null)

    if (preferredCandidate) {
      console.log("[voice] base64 source", preferredCandidate.source)
      console.log("[voice] candidate inferredLen", preferredCandidate.inferredLen)
      return preferredCandidate.value
    }

    return ""
  },

  normalizeBase64String(input) {
    const normalized = String(input || "")
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/\s+/g, "")
      .trim()

    if (!normalized || normalized.length < 32 || normalized.length % 4 !== 0) {
      return ""
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
      return ""
    }

    return normalized
  },

  binaryStringToBase64(input) {
    const str = String(input || "")

    if (!str) {
      return ""
    }

    try {
      const bytes = new Uint8Array(str.length)
      for (let i = 0; i < str.length; i += 1) {
        bytes[i] = str.charCodeAt(i) & 0xff
      }

      const converted = wx.arrayBufferToBase64(bytes.buffer)
      return this.normalizeBase64String(converted)
    } catch (err) {
      console.warn("[voice] binary string to base64 failed", err)
      return ""
    }
  },

  getBase64ByteLength(base64Value) {
    const normalized = this.normalizeBase64String(base64Value)

    if (!normalized) {
      return 0
    }

    return Math.floor(normalized.replace(/=*$/, "").length * 3 / 4)
  },

  getPreferredRecordFormat() {
    const platform = this.systemInfo && this.systemInfo.platform

    // 开发者工具里 m4a 更稳定，真机继续用 mp3。
    return platform === "devtools" ? "m4a" : "mp3"
  },

  getVoiceKeyword(text) {
    return String(text || "")
      .replace(/[，。！？、,.!?]/g, " ")
      .replace(/^(我要|帮我|请|把)?(买了|新买|补货|入库|添加|新增|吃了|吃掉|用了|用掉|消耗|减少)/, "")
      .replace(/\s+/g, " ")
      .trim()
  },

  getVoiceIntent(text) {
    const normalizedText = String(text || "").replace(/\s+/g, "")

    if (!normalizedText) {
      return "unknown"
    }

    const hasStockInKeyword = STOCK_IN_KEYWORDS.some(keyword => normalizedText.includes(keyword))
    const hasConsumeKeyword = CONSUME_KEYWORDS.some(keyword => normalizedText.includes(keyword))

    if (hasStockInKeyword && !hasConsumeKeyword) {
      return "stock-in"
    }

    if (hasConsumeKeyword && !hasStockInKeyword) {
      return "consume"
    }

    const stockInScore = STOCK_IN_KEYWORDS.reduce((score, keyword) => score + (normalizedText.includes(keyword) ? 1 : 0), 0)
    const consumeScore = CONSUME_KEYWORDS.reduce((score, keyword) => score + (normalizedText.includes(keyword) ? 1 : 0), 0)

    if (stockInScore > consumeScore) {
      return "stock-in"
    }

    if (consumeScore > stockInScore) {
      return "consume"
    }

    return "unknown"
  },

  navigateByIntent(intent, text) {
    const encodedText = encodeURIComponent(text)

    if (intent === "stock-in") {
      this.setData({
        voiceResultText: ""
      })

      wx.navigateTo({
        url: `/packageB/pages/stock-in/stock-in?voiceText=${encodedText}`
      })
      return true
    }

    if (intent === "consume") {
      this.setData({
        voiceResultText: ""
      })

      wx.navigateTo({
        url: `/packageB/pages/consume/consume?voiceText=${encodedText}`
      })
      return true
    }

    return false
  },

  routeVoiceText(text) {
    const keyword = this.getVoiceKeyword(text)
    const candidateText = keyword || text
    const intent = this.getVoiceIntent(text)

    if (this.navigateByIntent(intent, candidateText)) {
      wx.showToast({
        title: intent === "stock-in" ? "识别为补货" : "识别为消耗",
        icon: "none"
      })
      return
    }

    wx.showActionSheet({
      itemList: ["填入入库", "填入消耗"],
      success: res => {
        if (res.tapIndex === 0) {
          this.setData({
            voiceResultText: ""
          })

          wx.navigateTo({
            url: `/packageB/pages/stock-in/stock-in?voiceText=${encodeURIComponent(candidateText)}`
          })
          return
        }

        this.setData({
          voiceResultText: ""
        })

        wx.navigateTo({
          url: `/packageB/pages/consume/consume?voiceText=${encodeURIComponent(candidateText)}`
        })
      }
    })
  },

  startVoiceRecord() {
    if (this.data.isRecording || this.data.isRecognizing) {
      return
    }

    const format = this.getPreferredRecordFormat()

    this.recorderManager.start({
      duration: 15000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format
    })

    console.log("[voice] record format", format)
  },

  stopVoiceRecord() {
    if (!this.data.isRecording) {
      return
    }

    this.recorderManager.stop()
  },

  onVoiceTouchStart() {
    if (this.data.isRecognizing) {
      return
    }

    this.holdTimer = setTimeout(() => {
      this.startVoiceRecord()
    }, MIN_HOLD_MS)
  },

  onVoiceButtonTap() {
    if (!this.data.isRecording) {
      return
    }

    const now = Date.now()
    if (now - Number(this.recordStartedAt || 0) < 600) {
      return
    }

    this.stopVoiceRecord()
  },

  onVoiceTouchMove() {
    // 使用 catchtouchmove 防止页面滚动抢占触摸事件，减少 touchend 丢失。
  },

  onVoiceTouchEnd() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
  },

  onVoiceTouchCancel() {
    this.onVoiceTouchEnd()
  },

  getGreetingText() {
    const hour = new Date().getHours()

    if (hour < 6) {
      return "早上好！"
    }

    if (hour < 11) {
      return "上午好！"
    }

    if (hour < 14) {
      return "中午好！"
    }

    if (hour < 18) {
      return "下午好！"
    }

    return "晚上好！"
  },

  getHeroSubText(inventory = [], expiringItems = []) {
    const itemCount = inventory.length

    if (itemCount === 0) {
      return "冰箱里还没有食材，先补一点吧～"
    }

    if (expiringItems.length > 0) {
      return `有 ${expiringItems.length} 样食材快过期了，先处理一下吧～`
    }

    if (itemCount <= 5) {
      return "冰箱有点空，记得补货～"
    }

    if (itemCount >= 20) {
      return `冰箱里一共有 ${itemCount} 样食材，今天很充实～`
    }

    return `冰箱里有 ${itemCount} 样食材，状态不错～`
  },

  async onShow() {
    const loginState = wx.getStorageSync(LOGIN_STATE_KEY)

    if (!loginState || !loginState.family) {
      wx.hideTabBar()
      wx.reLaunch({
        url: "/packageA/pages/profile/profile"
      })
      return
    }

    wx.showTabBar()

    this.setData({
      loading: true,
      greetingText: this.getGreetingText(),
      keyword: "",
      voiceResultText: ""
    })

    try {
      const [inventory, profileResult, recentLogs] = await Promise.all([
        getInventory(),
        refreshFamilyProfileFromCloud(),
        getRecentLogs(5)
      ])

      const profile = profileResult.profile

      const expiringItems = inventory.filter(item => item.status === "warning" || item.status === "danger")
      const fridgeAreas = Array.isArray(profile.areas)
        ? profile.areas.map(area => ({
            ...area,
            count: getFridgeAreaItemCount(area, inventory)
          }))
        : []
      const heroSubText = this.getHeroSubText(inventory, expiringItems)

      this.setData({
        expiringItems,
        fridgeAreas,
        recentLogs,
        heroSubText
      })
    } catch (err) {
      console.error("读取首页数据失败：", err)

      wx.showToast({
        title: err.message || "读取首页数据失败",
        icon: "none"
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  goInventory(e) {
    const areaId = e.currentTarget.dataset.areaId
    const areaType = e.currentTarget.dataset.areaType || "全部"

    if (areaId) {
      setActiveArea(areaId)
    }

    wx.switchTab({
      url: "/packageA/pages/inventory/inventory",
      success() {
        const page = getCurrentPages().pop()
        if (page) {
          if (typeof page.setArea === "function") {
            page.setArea({ areaId, areaType })
          }
        }
      }
    })
  },

  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
},

clearSearch() {
  this.setData({
    keyword: ""
  })
},


  submitSearch() {
    const keyword = String(this.data.keyword || "").trim()


    if (!keyword) {
      wx.showToast({
        title: "请输入搜索关键词",
        icon: "none"
      })
      return
    }
    
    getApp().globalData.inventoryKeyword = keyword
    getApp().globalData.inventoryFilter = "all"

    wx.switchTab({
      url: "/packageA/pages/inventory/inventory"
  })
  },


  onFoodTap(e) {
    const item = e.detail && e.detail.item
  
    if (!item || !item.id) {
      console.warn("没有拿到食材数据：", e)
      return
    }
  
    wx.navigateTo({
      url: `/packageB/pages/detail/detail?id=${item.id}`
    })
  },

  onUnload() {
    this.stopVoiceRecord()

    if (this.holdTimer) {
      clearTimeout(this.holdTimer)
      this.holdTimer = null
    }
  },

  onHide() {
    this.stopVoiceRecord()

    this.setData({
      voiceResultText: "",
      voiceStatusText: "长按开始录音"
    })
  }
})