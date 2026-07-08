const { getInventory, INVENTORY_CATEGORIES } = require("../../services/inventory")
const { getFridgeAreas, getStoredProfile, setActiveArea } = require("../../services/fridgeProfile")

Page({
    data: {
        inventory: [],
        displayList: [],
        fridgeAreas: [],
        activeAreaId: "",
        currentArea: "全部",
        categories: ["全部", ...INVENTORY_CATEGORIES],
        currentCategory: "全部",
        keyword: ""
    },

    onShow() {
        const inventory = getInventory()
        const profile = getStoredProfile()
        const fridgeAreas = getFridgeAreas()

        this.setData({
            inventory,
            displayList: inventory,
            fridgeAreas,
            activeAreaId: profile.activeAreaId || "",
            currentArea: profile.activeAreaId || "全部"
        })

        this.filterData()
    },

    filterData() {
        const { inventory, currentCategory, currentArea, keyword, fridgeAreas } = this.data
        let list = inventory

        if (currentArea !== "全部") {
            const selectedArea = fridgeAreas.find(area => area.id === currentArea)

            if (selectedArea) {
                list = list.filter(item => {
                    return item.storage === selectedArea.id || item.storage === selectedArea.type || item.storage === selectedArea.name
                })
            }
        }

        if (currentCategory !== "全部") {
            list = list.filter(item => {
                return item.storage === currentCategory || item.category === currentCategory
            })
        }

        if (keyword) {
            list = list.filter(item => item.name.includes(keyword))
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

    setArea(areaInfo) {
        const areaId = areaInfo && areaInfo.currentTarget ? areaInfo.currentTarget.dataset.areaId : areaInfo.areaId

        if (areaId) {
            setActiveArea(areaId)
        }

        this.setData({
            activeAreaId: areaId || "",
            currentArea: areaId || "全部"
        }, () => {
            this.filterData()
        })
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