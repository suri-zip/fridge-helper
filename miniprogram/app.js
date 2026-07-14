const { saveProfile, familyToLocalProfile, getEmptyLocalProfile } = require("./services/fridgeProfile")

App({

  globalData: {
    inventoryFilter: null,
    inventoryKeyword: ""
  },

  onLaunch() {

    wx.cloud.init({
      env: "cloud1-d4gzx5e3ab780de07",
      traceUser: true
    })

    wx.cloud.callFunction({
      name: "login"
    }).then(res => {
      const result = res.result || {}
      const loginState = {
        ready: true,
        openid: result.openid || "",
        user: result.user || null,
        family: result.family || null
      }

      wx.setStorageSync("TUNTUN_LOGIN_STATE", loginState)

      if (result.family) {
        wx.showTabBar()

        const localProfile = familyToLocalProfile(result.family, result.openid)

        if (localProfile) {
          saveProfile(localProfile)
        }
      } else {
        wx.hideTabBar()
        saveProfile(getEmptyLocalProfile())

        wx.reLaunch({
          url: "/pages/profile/profile"
        })
      }

      console.log("login result:", res.result)
    }).catch(err => {
      wx.setStorageSync("TUNTUN_LOGIN_STATE", {
        ready: true,
        openid: "",
        user: null,
        family: null
      })

      wx.hideTabBar()
      saveProfile(getEmptyLocalProfile())

      wx.reLaunch({
        url: "/pages/profile/profile"
      })

      console.error("login error:", err)
    })

  }
})
