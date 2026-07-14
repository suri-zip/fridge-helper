const {
	getStoredProfile,
	saveProfile: persistProfile,
	getCurrentMember,
	familyToLocalProfile,
	getEmptyLocalProfile,
	getFridgeAreas,
	refreshFamilyProfileFromCloud,
	addArea: addAreaToProfile,
	updateArea,
	updateMember,
	removeArea
} = require("../../services/fridgeProfile")

const LOGIN_STATE_KEY = "TUNTUN_LOGIN_STATE"

Page({
	data: {
		authReady: false,
		hasFamily: false,
		familyName: "",
		inviteCode: "",
		currentMember: null,
		otherMembers: [],
		members: [],
		areas: [],
		activeAreaId: "",
		newAreaName: "",
		newAreaTypeIndex: 0,
		editingAreaId: "",
		editingAreaName: "",
		editingAreaTypeIndex: 0,
		isEditingProfile: false,
    	savingProfile: false,
		memberName: "",
		memberRoleIndex: 0,
		memberAvatarIndex: 0,
		joinInviteCode: "",
		areaTypes: ["冷藏", "冷冻", "变温", "门架", "抽屉", "自定义"],
		memberRoleOptions: ["户主", "家人", "长辈", "孩子", "访客"],
		memberAvatarOptions: ["👤", "👩", "👨", "🧑", "👵", "🧒", "👶", "🐶", "🐱"]
	},

	onShow() {
		this.loadPageState()
	},

	getLoginState() {
		return wx.getStorageSync(LOGIN_STATE_KEY)
	},

	storeLoginState(loginState) {
		wx.setStorageSync(LOGIN_STATE_KEY, loginState)
	},

	ensureLoginState() {
		return wx.cloud.callFunction({
			name: "login"
		})
	},

	async applyFamilyProfile(family, openid) {
		if (!family) {
			persistProfile(getEmptyLocalProfile())
			wx.hideTabBar()
			this.setData({
				authReady: true,
				hasFamily: false,
				familyName: "",
				inviteCode: "",
				currentMember: null,
				otherMembers: [],
				members: [],
				areas: [],
				activeAreaId: "",
				memberName: "",
				memberRoleIndex: 0,
				memberAvatarIndex: 0,
			})
			return
		}

		const profile = getStoredProfile()
		const currentMember = getCurrentMember(profile)
		const areas = await getFridgeAreas()
		wx.showTabBar()

		this.setData({
			authReady: true,
			hasFamily: true,
			familyName: profile.familyName,
			inviteCode: profile.inviteCode,
			currentMember,
			otherMembers: profile.members.filter(member => !currentMember || member.id !== currentMember.id),
			members: profile.members,
			areas,
			activeAreaId: profile.activeAreaId || (profile.areas[0] && profile.areas[0].id) || "",
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0,
			memberName: currentMember ? currentMember.name : "",
			memberRoleIndex: currentMember ? Math.max(0, this.data.memberRoleOptions.indexOf(currentMember.role)) : 0,
			memberAvatarIndex: currentMember ? Math.max(0, this.data.memberAvatarOptions.indexOf(currentMember.avatar)) : 0,
		})
	},

	async loadPageState() {
		try {
			const result = await refreshFamilyProfileFromCloud()
			this.storeLoginState(result.loginState)
			await this.applyFamilyProfile(result.loginState.family, result.loginState.openid)
		} catch (err) {
			this.storeLoginState({
				ready: true,
				openid: "",
				user: null,
				family: null
			})
			await this.applyFamilyProfile(null)
		}
	},

	syncCurrentMemberEditor(profile) {
		const currentMember = getCurrentMember(profile)
		const roleIndex = currentMember ? this.data.memberRoleOptions.indexOf(currentMember.role) : -1
		const avatarIndex = currentMember ? this.data.memberAvatarOptions.indexOf(currentMember.avatar) : -1

		this.setData({
			currentMember,
			otherMembers: profile.members.filter(member => !currentMember || member.id !== currentMember.id),
			memberName: currentMember ? currentMember.name : "",
			memberRoleIndex: roleIndex >= 0 ? roleIndex : 1,
			memberAvatarIndex: avatarIndex >= 0 ? avatarIndex : 0,
		})
	},

	async saveProfile(nextProfile) {
		persistProfile(nextProfile)
		const areas = await getFridgeAreas()
		this.setData({
			hasFamily: true,
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas,
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || "",
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0,
			memberName: "",
			memberRoleIndex: 0,
			memberAvatarIndex: 0,
		})

		this.syncCurrentMemberEditor(nextProfile)
	},

	applyLoginState(loginState) {
		this.storeLoginState(loginState)

		if (loginState.family) {
			const localProfile = familyToLocalProfile(loginState.family, loginState.openid)

			if (localProfile) {
				persistProfile(localProfile)
			}
		}

		return this.applyFamilyProfile(loginState.family, loginState.openid)
	},

	async refreshFamilyFromCloud(result) {
		const nextLoginState = {
			ready: true,
			openid: result.openid || "",
			user: result.user || null,
			family: result.family || null
		}

		await this.applyLoginState(nextLoginState)
	},

	copyInviteCode() {
		if (!this.data.hasFamily) {
			return
		}

		wx.setClipboardData({
			data: this.data.inviteCode,
			success: () => {
				wx.showToast({
					title: "邀请码已复制",
					icon: "success"
				})
			}
		})
	},

	leaveFamily() {
		wx.showModal({
			title: "退出家庭",
			content: "退出后这里会回到未加入家庭的状态。",
			confirmText: "退出",
			confirmColor: "#dc2626",
			success: res => {
				if (!res.confirm) {
					return
				}

				wx.cloud.callFunction({
					name: "leaveFamily"
				}).then(res => {
					const result = res.result || {}
					persistProfile(getEmptyLocalProfile())
					this.applyLoginState({
						ready: true,
						openid: result.openid || "",
						user: result.user || null,
						family: null
					})
					wx.showToast({
						title: "已退出家庭",
						icon: "success"
					})
				}).catch(() => {
					wx.showToast({
						title: "退出失败",
						icon: "none"
					})
				})
			}
		})
	},

	onJoinInviteInput(event) {
		this.setData({
			joinInviteCode: event.detail.value
		})
	},

	createFamily() {
		wx.showLoading({
			title: "创建中"
		})

		wx.cloud.callFunction({
			name: "createFamily"
		}).then(res => {
			wx.hideLoading()
			this.refreshFamilyFromCloud(res.result || {})
			wx.showToast({
				title: "家庭已创建",
				icon: "success"
			})
		}).catch(() => {
			wx.hideLoading()
			wx.showToast({
				title: "创建失败",
				icon: "none"
			})
		})
	},

	joinFamily() {
		const inviteCode = this.data.joinInviteCode.trim()

		if (!inviteCode) {
			wx.showToast({
				title: "请输入邀请码",
				icon: "none"
			})
			return
		}

		wx.showLoading({
			title: "加入中"
		})

		wx.cloud.callFunction({
			name: "joinFamily",
			data: {
				inviteCode
			}
		}).then(res => {
			wx.hideLoading()
			this.refreshFamilyFromCloud(res.result || {})
			this.setData({
				joinInviteCode: ""
			})
			wx.showToast({
				title: "已加入家庭",
				icon: "success"
			})
		}).catch(() => {
			wx.hideLoading()
			wx.showToast({
				title: "邀请码无效",
				icon: "none"
			})
		})
	},

	onAreaNameInput(event) {
		this.setData({
			newAreaName: event.detail.value
		})
	},

	onAreaTypeChange(event) {
		this.setData({
			newAreaTypeIndex: Number(event.detail.value)
		})
	},

	async addArea() {
		if (!this.data.hasFamily) {
			return
		}

		const areaName = this.data.newAreaName.trim()

		if (!areaName) {
			wx.showToast({
				title: "请输入区域名称",
				icon: "none"
			})
			return
		}

		const areaType = this.data.areaTypes[this.data.newAreaTypeIndex] || "自定义"
		const nextProfile = await addAreaToProfile({
			name: areaName,
			type: areaType,
			icon: areaType === "冷冻" ? "❄️" : areaType === "变温" ? "🌡️" : areaType === "门架" ? "🥛" : areaType === "抽屉" ? "🧺" : "🧊"
		})
		const areas = await getFridgeAreas()

		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas,
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || ""
		})

		this.setData({
			newAreaName: "",
			newAreaTypeIndex: 0
		})

		wx.showToast({
			title: "区域已添加",
			icon: "success"
		})
	},

	openAreaEditor(event) {
		if (!this.data.hasFamily) {
			return
		}

		const { id } = event.currentTarget.dataset
		const profile = getStoredProfile()
		const targetArea = profile.areas.find(area => area.id === id)

		if (!targetArea) {
			return
		}

		const areaTypeIndex = this.data.areaTypes.indexOf(targetArea.type)

		this.setData({
			editingAreaId: targetArea.id,
			editingAreaName: targetArea.name,
			editingAreaTypeIndex: areaTypeIndex >= 0 ? areaTypeIndex : this.data.areaTypes.length - 1
		})
	},

	resetCurrentMemberEditor() {
		if (!this.data.hasFamily) {
			return
		}

		this.syncCurrentMemberEditor(getStoredProfile())
	},

	onMemberNameInput(event) {
		this.setData({
			memberName: event.detail.value
		})
	},

	onMemberRoleChange(event) {
		this.setData({
			memberRoleIndex: Number(event.detail.value)
		})
	},

	onMemberAvatarChange(event) {
		this.setData({
			memberAvatarIndex: Number(event.detail.value)
		})
	},

	startEditProfile() {
  	if (!this.data.currentMember) return

  	this.setData({
    	isEditingProfile: true
  	})
	},

	cancelEditProfile() {
  	if (!this.data.hasFamily) return

  	this.syncCurrentMemberEditor(getStoredProfile())

  	this.setData({
    	isEditingProfile: false
  	})
	},startEditProfile() {
  	if (!this.data.currentMember) return

  	this.setData({
    isEditingProfile: true
  })
	},

	cancelEditProfile() {
  	if (!this.data.hasFamily) return

  	this.syncCurrentMemberEditor(getStoredProfile())

  	this.setData({
    	isEditingProfile: false
  	})
	},

	async saveMemberEdit() {
  if (!this.data.hasFamily || !this.data.currentMember) {
    return
  }

  const memberName = this.data.memberName.trim()

  if (!memberName) {
    wx.showToast({
      title: "请输入成员名称",
      icon: "none"
    })
    return
  }

  const role =
    this.data.memberRoleOptions[this.data.memberRoleIndex] ||
    "家人"

  const avatar =
    this.data.memberAvatarOptions[this.data.memberAvatarIndex] ||
    "👤"

  this.setData({
    savingProfile: true
  })

  try {
    const res = await wx.cloud.callFunction({
      name: "updateMemberProfile",
      data: {
        name: memberName,
        role,
        avatar
      }
    })

    const result = res.result || {}

    if (!result.success) {
      throw new Error(result.message || "保存失败")
    }

    await refreshFamilyProfileFromCloud()
    await this.applyFamilyProfile(
      result.family,
      this.getLoginState().openid
    )

    this.setData({
      isEditingProfile: false
    })

    wx.showToast({
      title: "资料已更新",
      icon: "success"
    })
  } catch (err) {
    console.error("保存成员资料失败：", err)

    wx.showToast({
      title: err.message || "保存失败",
      icon: "none"
    })
  } finally {
    this.setData({
      savingProfile: false
    })
  }
},

	onEditingAreaNameInput(event) {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			editingAreaName: event.detail.value
		})
	},

	onEditingAreaTypeChange(event) {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			editingAreaTypeIndex: Number(event.detail.value)
		})
	},

	cancelAreaEdit() {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})
	},

	async saveAreaEdit() {
		if (!this.data.hasFamily) {
			return
		}

		const areaName = this.data.editingAreaName.trim()

		if (!this.data.editingAreaId) {
			return
		}

		if (!areaName) {
			wx.showToast({
				title: "请输入区域名称",
				icon: "none"
			})
			return
		}

		const areaType = this.data.areaTypes[this.data.editingAreaTypeIndex] || "自定义"
		const nextProfile = await updateArea(this.data.editingAreaId, {
			name: areaName,
			type: areaType,
			icon: areaType === "冷冻" ? "❄️" : areaType === "变温" ? "🌡️" : areaType === "门架" ? "🥛" : areaType === "抽屉" ? "🧺" : "🧊"
		})
		const areas = await getFridgeAreas()

		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas,
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || "",
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})

		wx.showToast({
			title: "区域已更新",
			icon: "success"
		})
	},

	async deleteArea(event) {
		if (!this.data.hasFamily) {
			return
		}

		const { id } = event.currentTarget.dataset
		const profile = getStoredProfile()
		const targetArea = profile.areas.find(area => area.id === id)

		if (!targetArea) {
			return
		}

		wx.showModal({
			title: "删除冰箱区域",
			content: `确定删除「${targetArea.name}」吗？该区域里的食材也会一起删除。`,
			confirmText: "删除",
			confirmColor: "#dc2626",
				success: async res => {
				if (!res.confirm) {
					return
				}

					const nextProfile = await removeArea(id)

				if (!nextProfile) {
					wx.showToast({
						title: "至少保留一个区域",
						icon: "none"
					})
					return
				}

					const areas = await getFridgeAreas()

					this.setData({
					familyName: nextProfile.familyName,
					inviteCode: nextProfile.inviteCode,
					members: nextProfile.members,
						areas,
					activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || ""
				})

				wx.showToast({
					title: "区域已删除",
					icon: "success"
				})
			}
		})
	},

	
})