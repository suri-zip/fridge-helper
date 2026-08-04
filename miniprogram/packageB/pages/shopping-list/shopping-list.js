const {
  addShoppingListItem,
  deleteShoppingListItem,
  getShoppingList,
  markShoppingListItemBought,
  markShoppingListItemPending
} = require("../../../services/shoppingList")

const unitOptions = ["个", "盒", "袋", "碗", "瓶", "杯", "斤", "g", "kg"]
const REVEAL_THRESHOLD = -60
const DELETE_CONFIRM_THRESHOLD = -130
const BUY_THRESHOLD = 80
const UNBUY_THRESHOLD = 80

Page({
  data: {
    nameInput: "",
    quantityInput: "1",
    unitOptions,
    unitIndex: 0,
    loading: false,
    pendingItems: [],
    boughtItems: [],
    submitting: false
  },

  onLoad() {},

  onShow() {
    this.loadShoppingList()
  },

  onNameInput(e) {
    this.setData({
      nameInput: e.detail.value
    })
  },

  onQuantityInput(e) {
    this.setData({
      quantityInput: e.detail.value
    })
  },

  onUnitChange(e) {
    this.setData({
      unitIndex: Number(e.detail.value)
    })
  },

  async loadShoppingList() {
    this.setData({
      loading: true
    })

    try {
      const items = await getShoppingList()
      const sortedItems = items
        .slice()
        .sort((left, right) => {
          const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
          const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime()

          return rightTime - leftTime
        })

      this.setData({
        pendingItems: sortedItems.filter(item => !item.bought),
        boughtItems: sortedItems.filter(item => item.bought)
      })
    } catch (error) {
      console.error("读取购物清单失败：", error)

      wx.showToast({
        title: error.message || "读取失败",
        icon: "none"
      })
    } finally {
      this.setData({
        loading: false
      })

      wx.stopPullDownRefresh()
    }
  },

  async addItem() {
    if (this.data.submitting) {
      return
    }

    const name = String(this.data.nameInput || "").trim()
    const quantity = Number(this.data.quantityInput)

    if (!name) {
      wx.showToast({
        title: "请输入物品名称",
        icon: "none"
      })

      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      wx.showToast({
        title: "请输入正确数量",
        icon: "none"
      })

      return
    }

    this.setData({
      submitting: true
    })

    try {
      await addShoppingListItem({
        name,
        quantity,
        unit: this.data.unitOptions[this.data.unitIndex] || "个",
        source: "manual"
      })

      this.setData({
        nameInput: "",
        quantityInput: "1",
        unitIndex: 0
      })

      wx.showToast({
        title: "已添加",
        icon: "success"
      })

      await this.loadShoppingList()
    } catch (error) {
      console.error("添加购物项失败：", error)

      wx.showToast({
        title: error.message || "添加失败",
        icon: "none"
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  onItemTouchStart(e) {
    const { id, list } = e.currentTarget.dataset
    const touch = e.touches[0]

    if (!id || !touch) {
      return
    }

    this.touchState = {
      id,
      list,
      startX: touch.clientX,
      offsetX: 0
    }

    this.resetOtherOffsets(id, list)
  },

  onItemTouchMove(e) {
    const session = this.touchState
    const touch = e.touches[0]

    if (!session || !touch) {
      return
    }

    const deltaX = touch.clientX - session.startX
    const offsetX = session.list === "bought"
      ? Math.max(0, Math.min(110, deltaX))
      : Math.max(-160, Math.min(110, deltaX))

    session.offsetX = offsetX
    this.updateItemOffset(session.list, session.id, offsetX)
  },

  async onItemTouchEnd() {
    const session = this.touchState

    if (!session) {
      return
    }

    const { id, list, offsetX } = session

    this.touchState = null

    if (list === "bought") {
      if (offsetX >= UNBUY_THRESHOLD) {
        try {
          await markShoppingListItemPending(id)

          wx.showToast({
            title: "已取消买到",
            icon: "success"
          })

          await this.loadShoppingList()
        } catch (error) {
          console.error("取消已买失败：", error)

          wx.showToast({
            title: error.message || "操作失败",
            icon: "none"
          })

          this.updateItemOffset(list, id, 0)
        }

        return
      }

      this.updateItemOffset(list, id, 0)
      return
    }

    if (offsetX >= BUY_THRESHOLD) {
      try {
        await markShoppingListItemBought(id)

        wx.showToast({
          title: "已标记买到",
          icon: "success"
        })

        await this.loadShoppingList()
      } catch (error) {
        console.error("标记已买失败：", error)

        wx.showToast({
          title: error.message || "操作失败",
          icon: "none"
        })

        this.updateItemOffset(list, id, 0)
      }

      return
    }

    if (offsetX <= DELETE_CONFIRM_THRESHOLD) {
      const item = this.findItemById(id)

      if (!item) {
        this.loadShoppingList()
        return
      }

      const result = await new Promise(resolve => {
        wx.showModal({
          title: "删除物品",
          content: `确定删除「${item.name}」吗？`,
          confirmText: "删除",
          confirmColor: "#dc2626",
          success: resolve,
          fail: () => resolve({ confirm: false })
        })
      })

      if (!result.confirm) {
        this.updateItemOffset(list, id, 0)
        return
      }

      try {
        await deleteShoppingListItem(id)

        wx.showToast({
          title: "已删除",
          icon: "success"
        })

        await this.loadShoppingList()
      } catch (error) {
        console.error("删除购物项失败：", error)

        wx.showToast({
          title: error.message || "删除失败",
          icon: "none"
        })

        this.updateItemOffset(list, id, 0)
      }

      return
    }

    if (offsetX <= REVEAL_THRESHOLD) {
      this.updateItemOffset(list, id, -88)
      return
    }

    this.updateItemOffset(list, id, 0)
  },

  onItemTouchCancel() {
    const session = this.touchState

    if (!session) {
      return
    }

    this.updateItemOffset(session.list, session.id, 0)
    this.touchState = null
  },

  onPullDownRefresh() {
    this.loadShoppingList()
  },

  findItemById(itemId) {
    const allItems = [...this.data.pendingItems, ...this.data.boughtItems]

    return allItems.find(item => String(item.id) === String(itemId)) || null
  },

  resetOtherOffsets(activeId, activeList) {
    const resetList = list => list.map(item => ({
      ...item,
      offsetX: 0
    }))

    this.setData({
      pendingItems: resetList(this.data.pendingItems),
      boughtItems: resetList(this.data.boughtItems)
    })
  },

  updateItemOffset(listName, itemId, offsetX) {
    const dataKey = listName === "bought" ? "boughtItems" : "pendingItems"
    const list = this.data[dataKey].map(item => {
      if (String(item.id) !== String(itemId)) {
        return {
          ...item,
          offsetX: 0
        }
      }

      return {
        ...item,
        offsetX
      }
    })

    this.setData({
      pendingItems: dataKey === "pendingItems" ? list : this.data.pendingItems,
      boughtItems: dataKey === "boughtItems" ? list : this.data.boughtItems
    })
  }
})