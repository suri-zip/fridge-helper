const { getInventory, removeFoodByStorage } = require("./inventory")

const PROFILE_STORAGE_KEY = "TUNTUN_PROFILE"

function getDefaultMemberName(index) {
  return `家庭成员${index + 1}`
}

function normalizeMembers(members = []) {
  return members.map((member, index) => {
    const { status, ...rest } = member || {}
    const name = typeof member.name === "string" ? member.name.trim() : ""

    return {
      ...rest,
      name: name && name !== "我" ? name : getDefaultMemberName(index)
    }
  })
}

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
    members: normalizeMembers([
      {
        id: "member-1",
        name: getDefaultMemberName(0),
        role: "户主",
        avatar: "👤",
      },
    ]),
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

  const normalizedProfile = {
    ...storedProfile,
    members: normalizeMembers(storedProfile.members)
  }

  if (normalizedProfile.members.some((member, index) => member.name !== storedProfile.members[index].name)) {
    wx.setStorageSync(PROFILE_STORAGE_KEY, normalizedProfile)
  }

  return normalizedProfile
}

function saveProfile(profile) {
  wx.setStorageSync(PROFILE_STORAGE_KEY, profile)
  return profile
}

async function refreshFamilyProfileFromCloud() {
  const res = await wx.cloud.callFunction({
    name: "login"
  })

  const result = res.result || {}
  const loginState = {
    ready: true,
    openid: result.openid || "",
    user: result.user || null,
    family: result.family || null
  }

  if (!result.family) {
    return {
      loginState,
      profile: saveProfile(getEmptyLocalProfile())
    }
  }

  const profile = familyToLocalProfile(result.family, result.openid) || getEmptyLocalProfile()

  return {
    loginState,
    profile: saveProfile(profile)
  }
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
    members: normalizeMembers(members),
    areas,
    activeAreaId: family.activeAreaId || (areas[0] && areas[0].id) || ""
  }
}

async function getFridgeAreas() {
  const profile = getStoredProfile()
  const inventory = await getInventory()

  return profile.areas.map(area => ({
    ...area,
    count: getFridgeAreaItemCount(area, inventory)
  }))
}

function getFridgeStorageOptions() {
  const profile = getStoredProfile()

  return profile.areas.map(area => ({
    label: `${area.name}${area.type && area.type !== area.name ? `（${area.type}）` : ""}`,
    value: area.id,
    name: area.name,
    type: area.type
  }))
}

function normalizeStorageValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
}

function getStorageLabelByValue(storageValue) {
  const normalizedStorageValue = normalizeStorageValue(storageValue)

  if (!normalizedStorageValue) {
    return ""
  }

  const matchedOption = getFridgeStorageOptions().find(option => normalizeStorageValue(option.value) === normalizedStorageValue)

  return matchedOption ? matchedOption.label : normalizedStorageValue
}

function isAreaStorage(area, storageValue) {
  if (!area) {
    return false
  }

  const normalizedStorageValue = normalizeStorageValue(storageValue)

  return normalizedStorageValue === normalizeStorageValue(area.id) ||
    normalizedStorageValue === normalizeStorageValue(area.type) ||
    normalizedStorageValue === normalizeStorageValue(area.name)
}

function getFridgeAreaItemCount(area, inventory = []) {
  return inventory.filter(item => isAreaStorage(area, item.storage)).length
}

async function updateFamilyAreasOnCloud(areas, activeAreaId) {
  const res = await wx.cloud.callFunction({
    name: "updateFamilyAreas",
    data: {
      areas,
      activeAreaId
    }
  })

  const result = res.result || {}

  if (!result.success) {
    throw new Error(result.message || "家庭区域更新失败")
  }

  return result.family || null
}

async function updateFamilyName(familyName) {
  const profile = getStoredProfile()
  const nextFamilyName = String(familyName || "").trim()

  if (!nextFamilyName) {
    throw new Error("家庭名称不能为空")
  }

  const res = await wx.cloud.callFunction({
    name: "updateFamilyName",
    data: {
      familyName: nextFamilyName
    }
  })

  const result = res.result || {}

  if (!result.success) {
    throw new Error(result.message || "家庭名称更新失败")
  }

  const family = result.family || null
  const syncedProfile = family ? familyToLocalProfile(family, profile.currentMemberId) : {
    ...profile,
    familyName: nextFamilyName
  }

  return saveProfile(syncedProfile)
}

async function addArea(areaInput) {
  const profile = getStoredProfile()
  const nextArea = {
    id: `area-${Date.now()}`,
    name: areaInput.name,
    type: areaInput.type,
    icon: areaInput.icon || "🧊"
  }

  const nextProfile = {
    ...profile,
    areas: [...profile.areas, nextArea],
    activeAreaId: profile.activeAreaId || nextArea.id
  }

  const family = await updateFamilyAreasOnCloud(nextProfile.areas, nextProfile.activeAreaId)
  const syncedProfile = family ? familyToLocalProfile(family, nextProfile.currentMemberId) : nextProfile

  return saveProfile(syncedProfile)
}

async function updateArea(areaId, updates) {
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

  const nextProfile = {
    ...profile,
    areas: nextAreas
  }

  const family = await updateFamilyAreasOnCloud(nextProfile.areas, nextProfile.activeAreaId)
  const syncedProfile = family ? familyToLocalProfile(family, nextProfile.currentMemberId) : nextProfile

  return saveProfile(syncedProfile)
}

function updateMember(memberId, updates) {
  const profile = getStoredProfile()
  const nextMembers = profile.members.map(member => {
    if (member.id !== memberId) {
      return member
    }

    const { status, ...rest } = member

    return {
      ...rest,
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
      }
    ]
  })
}

async function removeArea(areaId) {
  const profile = getStoredProfile()
  const targetArea = profile.areas.find(area => area.id === areaId)

  if (!targetArea) {
    return null
  }

  const nextAreas = profile.areas.filter(area => area.id !== areaId)

  if (!nextAreas.length) {
    return null
  }

  const nextActiveAreaId = profile.activeAreaId === areaId ? nextAreas[0].id : profile.activeAreaId

  await updateFamilyAreasOnCloud(nextAreas, nextActiveAreaId)
  await removeFoodByStorage([targetArea.id, targetArea.type, targetArea.name])

  return saveProfile({
    ...profile,
    areas: nextAreas,
    activeAreaId: nextActiveAreaId
  })
}

async function setActiveArea(areaId) {
  const profile = getStoredProfile()
  const nextProfile = {
    ...profile,
    activeAreaId: areaId
  }

  const family = await updateFamilyAreasOnCloud(nextProfile.areas, nextProfile.activeAreaId)
  const syncedProfile = family ? familyToLocalProfile(family, nextProfile.currentMemberId) : nextProfile

  return saveProfile(syncedProfile)
}

module.exports = {
  createInviteCode,
  getDefaultProfile,
  getStoredProfile,
  saveProfile,
  refreshFamilyProfileFromCloud,
  getEmptyLocalProfile,
  getCurrentMember,
  familyToLocalProfile,
  getFridgeAreas,
  getFridgeStorageOptions,
  getStorageLabelByValue,
  getFridgeAreaItemCount,
  isAreaStorage,
  addArea,
  updateArea,
  updateFamilyName,
  updateMember,
  updateCurrentMember,
  leaveFamily,
  removeArea,
  setActiveArea
}