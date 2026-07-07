const { getInventory,getExpireText } = require("../../services/inventory")

const inventory = getInventory()


Page({

    data: {
        inventory: [],
        displayList: [],
        categories: [
            "全部",
            "冷藏",
            "冷冻",
            "水果",
            "蔬菜",
            "肉类"
        ],

        currentCategory: "全部",
        keyword: ""
    },

    onShow() {
      const inventory = getInventory()
      this.setData({
        inventory,
        displayList: inventory
      })
      this.filterData()
    },

    filterData() {
        const { inventory, currentCategory, keyword } = this.data
        let list = inventory
        // 分类
        if (currentCategory !== "全部") {
            list = list.filter(item => {
                return item.storage === currentCategory ||
                       item.category === currentCategory
            })
        }

        // 搜索
        if (keyword) {
            list = list.filter(item =>
                item.name.includes(keyword)
            )
        }
        this.setData({
            displayList: list
        })
    },

    changeCategory(e) {
        this.setData({
            currentCategory: e.currentTarget.dataset.category
        })
        this.filterData()
    },
    setCategory(category) {
      this.setData({
        currentCategory: category
      }, () => {
        this.filterData()
      })
    },

    onSearch(e) {
        this.setData({
            keyword: e.detail.value
        })
        this.filterData()
    },

    onFoodTap(e) {
        wx.navigateTo({
            url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}`
        })
    }
})