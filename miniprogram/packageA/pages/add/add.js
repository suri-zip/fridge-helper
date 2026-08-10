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

  goShoppingList() {
    wx.navigateTo({
      url: "/packageB/pages/shopping-list/shopping-list"
    })
  }
})