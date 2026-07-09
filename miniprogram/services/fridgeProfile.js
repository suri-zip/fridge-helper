const { getInventory, removeFoodByStorage } = require("./inventory")

const PROFILE_STORAGE_KEY = "TUNTUN_PROFILE"

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "HH-"

  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }

  return code
}

function getDefaultProfile() {
  return {
    familyName: "我的家庭",
    inviteCode: createInviteCode(),
    currentMemberId: "member-1",
    members: [
      {
        id: "member-1",
        name: "我",
        role: "户主",
        avatar: "👤",
        status: "在线"
      },
      {
        id: "member-2",
        name: "小雅",
        role: "家人",
        avatar: "👩",
        status: "已加入 3 天"
      },
      {
        id: "member-3",
        name: "乐乐",
        role: "家人",
        avatar: "🧒",
        status: "已加入 1 天"
      }
    ],
    areas: [
      {
        id: "area-1",
        name: "冷藏室",
        type: "冷藏",
        icon: "🧊"
      },
      {
        id: "area-2",
        name: "冷冻室",
        type: "冷冻",
        icon: "❄️"
      },
      {
        id: "area-3",
        name: "门架",
        type: "门架",
        icon: "🥛"
      }
    ],
    activeAreaId: "area-1"
  }
}

function getCurrentMember(profile) {
  if (!profile || !Array.isArray(profile.members) || !profile.members.length) {
    return null
  }

  return profile.members.find(member => member.id === profile.currentMemberId) || profile.members[0]
}

function getStoredProfile() {
  const storedProfile = wx.getStorageSync(PROFILE_STORAGE_KEY)

  if (!storedProfile || !Array.isArray(storedProfile.members) || !Array.isArray(storedProfile.areas)) {
    const defaultProfile = getDefaultProfile()
    wx.setStorageSync(PROFILE_STORAGE_KEY, defaultProfile)
    return defaultProfile
  }

  if (!storedProfile.currentMemberId) {
    const nextProfile = {
      ...storedProfile,
      currentMemberId: storedProfile.members[0] && storedProfile.members[0].id ? storedProfile.members[0].id : ""
    }

    wx.setStorageSync(PROFILE_STORAGE_KEY, nextProfile)
    return nextProfile
  }

  if (!storedProfile.members.find(member => member.id === storedProfile.currentMemberId)) {
    const nextProfile = {
      ...storedProfile,
      currentMemberId: storedProfile.members[0] && storedProfile.members[0].id ? storedProfile.members[0].id : ""
    }

    wx.setStorageSync(PROFILE_STORAGE_KEY, nextProfile)
    return nextProfile
  }

  return storedProfile
}

function saveProfile(profile) {
  wx.setStorageSync(PROFILE_STORAGE_KEY, profile)
  return profile
}

function getEmptyLocalProfile() {
  return {
    familyName: "",
    inviteCode: "",
    currentMemberId: "",
    members: [],
    areas: [],
    activeAreaId: ""
  }
}

function familyToLocalProfile(family, currentMemberId) {
  if (!family) {
    return null
  }

  const areas = Array.isArray(family.areas) ? family.areas : []
  const members = Array.isArray(family.members) ? family.members : []

  return {
    familyName: family.familyName || "我的家庭",
    inviteCode: family.inviteCode || createInviteCode(),
    currentMemberId: currentMemberId || family.currentMemberId || (members[0] && members[0].id) || "",
    members,
    areas,
    activeAreaId: family.activeAreaId || (areas[0] && areas[0].id) || ""
  }
}

function getFridgeAreas() {
  const profile = getStoredProfile()
  const inventory = getInventory()

  return profile.areas.map(area => ({
    ...area,
    count: inventory.filter(item => {
      return item.storage === area.id || item.storage === area.type || item.storage === area.name
    }).length
  }))
}

function getFridgeStorageOptions() {
  return getFridgeAreas().map(area => ({
    label: `${area.name}${area.type && area.type !== area.name ? `（${area.type}）` : ""}`,
    value: area.id,
    name: area.name,
    type: area.type
  }))
}

function addArea(areaInput) {
  const profile = getStoredProfile()
  const nextArea = {
    id: `area-${Date.now()}`,
    name: areaInput.name,
    type: areaInput.type,
    icon: areaInput.icon || "🧊"
  }

  return saveProfile({
    ...profile,
    areas: [...profile.areas, nextArea],
    activeAreaId: profile.activeAreaId || nextArea.id
  })
}

function updateArea(areaId, updates) {
  const profile = getStoredProfile()
  const nextAreas = profile.areas.map(area => {
    if (area.id !== areaId) {
      return area
    }

    return {
      ...area,
      ...updates
    }
  })

  return saveProfile({
    ...profile,
    areas: nextAreas
  })
}

function updateMember(memberId, updates) {
  const profile = getStoredProfile()
  const nextMembers = profile.members.map(member => {
    if (member.id !== memberId) {
      return member
    }

    return {
      ...member,
      ...updates
    }
  })

  return saveProfile({
    ...profile,
    members: nextMembers
  })
}

function updateCurrentMember(updates) {
  const profile = getStoredProfile()
  const currentMember = getCurrentMember(profile)

  if (!currentMember) {
    return profile
  }

  return updateMember(currentMember.id, updates)
}

function leaveFamily() {
  const profile = getStoredProfile()
  const currentMember = getCurrentMember(profile)

  if (!currentMember) {
    return profile
  }

  return saveProfile({
    ...profile,
    familyName: profile.familyName || "我的家庭",
    inviteCode: createInviteCode(),
    currentMemberId: currentMember.id,
    members: [
      {
        ...currentMember,
        role: "户主",
        status: "当前账号"
      }
    ]
  })
}

function removeArea(areaId) {
  const profile = getStoredProfile()
  const targetArea = profile.areas.find(area => area.id === areaId)

  if (!targetArea) {
    return null
  }

  const nextAreas = profile.areas.filter(area => area.id !== areaId)

  if (!nextAreas.length) {
    return null
  }

  removeFoodByStorage(targetArea.id)
  removeFoodByStorage(targetArea.type)
  if (targetArea.name !== targetArea.type) {
    removeFoodByStorage(targetArea.name)
  }

  return saveProfile({
    ...profile,
    areas: nextAreas,
    activeAreaId: profile.activeAreaId === areaId ? nextAreas[0].id : profile.activeAreaId
  })
}

function setActiveArea(areaId) {
  const profile = getStoredProfile()
  return saveProfile({
    ...profile,
    activeAreaId: areaId
  })
}

module.exports = {
  createInviteCode,
  getDefaultProfile,
  getStoredProfile,
  saveProfile,
  getEmptyLocalProfile,
  getCurrentMember,
  familyToLocalProfile,
  getFridgeAreas,
  getFridgeStorageOptions,
  addArea,
  updateArea,
  updateMember,
  updateCurrentMember,
  leaveFamily,
  removeArea,
  setActiveArea
}