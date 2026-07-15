Page({
  goStockIn() {
    wx.navigateTo({
      url: "/pages/stock-in/stock-in"
    })
  },

  goConsume() {
    wx.navigateTo({
      url: "/pages/consume/consume"
    })
  },

  goAiAssistant() {
    wx.navigateTo({
      url: "/pages/ai-assistant/ai-assistant"
    })
  },

  goShoppingList() {
    wx.navigateTo({
      url: "/pages/shopping-list/shopping-list"
    })
  }
})