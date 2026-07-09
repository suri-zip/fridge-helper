const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const users = db.collection("users")
  const families = db.collection("family")

  const userRes = await users.where({ openid }).get()

  if (userRes.data.length > 0) {
    const user = userRes.data[0]

    let family = null

    if (user.familyId) {
      try {
        const familyRes = await families.doc(user.familyId).get()
        family = familyRes.data
      } catch (err) {
        family = null
      }
    }

    return {
      openid,
      user,
      family
    }
  }

  const userAddRes = await users.add({
    data: {
      openid,
      familyId: "",
      role: "",
      createdAt: new Date()
    }
  })

  return {
    openid,
    user: {
      _id: userAddRes._id,
      openid,
      familyId: "",
      role: ""
    },
    family: null
  }
}