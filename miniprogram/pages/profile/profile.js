const {
	createInviteCode,
	getStoredProfile,
	saveProfile: persistProfile,
	getFridgeAreas,
	addArea,
	updateArea,
	removeArea
} = require("../../services/fridgeProfile")

Page({
	data: {
		familyName: "",
		inviteCode: "",
		members: [],
		areas: [],
		activeAreaId: "",
		newAreaName: "",
		newAreaTypeIndex: 0,
		editingAreaId: "",
		editingAreaName: "",
		editingAreaTypeIndex: 0,
		areaTypes: ["冷藏", "冷冻", "变温", "门架", "抽屉", "自定义"]
	},

	onLoad() {
		this.loadProfile()
	},

	onShow() {
		this.loadProfile()
	},

	loadProfile() {
		const profile = getStoredProfile()

		this.setData({
			familyName: profile.familyName,
			inviteCode: profile.inviteCode,
			members: profile.members,
			areas: getFridgeAreas(),
			activeAreaId: profile.activeAreaId || (profile.areas[0] && profile.areas[0].id) || "",
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})
	},

	saveProfile(nextProfile) {
		persistProfile(nextProfile)
		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas: getFridgeAreas(),
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || "",
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})
	},

	copyInviteCode() {
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

	regenerateInviteCode() {
		const nextProfile = {
			...getStoredProfile(),
			inviteCode: createInviteCode()
		}

		this.saveProfile(nextProfile)

		wx.showToast({
			title: "已生成新邀请码",
			icon: "success"
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

	addArea() {
		const areaName = this.data.newAreaName.trim()

		if (!areaName) {
			wx.showToast({
				title: "请输入区域名称",
				icon: "none"
			})
			return
		}

		const areaType = this.data.areaTypes[this.data.newAreaTypeIndex] || "自定义"
		const nextProfile = addArea({
			name: areaName,
			type: areaType,
			icon: areaType === "冷冻" ? "❄️" : areaType === "变温" ? "🌡️" : areaType === "门架" ? "🥛" : areaType === "抽屉" ? "🧺" : "🧊"
		})

		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas: getFridgeAreas(),
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

	onEditingAreaNameInput(event) {
		this.setData({
			editingAreaName: event.detail.value
		})
	},

	onEditingAreaTypeChange(event) {
		this.setData({
			editingAreaTypeIndex: Number(event.detail.value)
		})
	},

	cancelAreaEdit() {
		this.setData({
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})
	},

	saveAreaEdit() {
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
		const nextProfile = updateArea(this.data.editingAreaId, {
			name: areaName,
			type: areaType,
			icon: areaType === "冷冻" ? "❄️" : areaType === "变温" ? "🌡️" : areaType === "门架" ? "🥛" : areaType === "抽屉" ? "🧺" : "🧊"
		})

		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas: getFridgeAreas(),
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

	deleteArea(event) {
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
			success: res => {
				if (!res.confirm) {
					return
				}

				const nextProfile = removeArea(id)

				if (!nextProfile) {
					wx.showToast({
						title: "至少保留一个区域",
						icon: "none"
					})
					return
				}

				this.setData({
					familyName: nextProfile.familyName,
					inviteCode: nextProfile.inviteCode,
					members: nextProfile.members,
					areas: getFridgeAreas(),
					activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || ""
				})

				wx.showToast({
					title: "区域已删除",
					icon: "success"
				})
			}
		})
	}
})