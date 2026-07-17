Page({
  goStockIn() {
    wx.navigateTo({
      url: "/packageB/pages/stock-in/stock-in"
    })
  },

  goConsume() {
    wx.navigateTo({
      url: "/packageB/pages/consume/consume"
    })
  },

  goAiAssistant() {
    wx.navigateTo({
      url: "/packageB/pages/ai-assistant/ai-assistant"
    })
  },

  goShoppingList() {
    wx.navigateTo({
      url: "/packageB/pages/shopping-list/shopping-list"
    })
  }
})