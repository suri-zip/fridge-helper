const tencentcloud = require("tencentcloud-sdk-nodejs")
const AsrClient = tencentcloud.asr.v20190614.Client


exports.main = async (event, context) => {

  const base64Data = String((event && event.data) || "").trim()

  if (!base64Data) {
    return {
      success: false,
      error: "缺少音频数据 data（base64）"
    }
  }

  const inputVoiceFormat = String((event && event.voiceFormat) || "mp3").toLowerCase()
  const voiceFormat = inputVoiceFormat === "aac" ? "m4a" : inputVoiceFormat

  // base64 => 原始字节长度（去掉末尾填充符后估算）
  const inferredDataLen = Math.floor(base64Data.replace(/=*$/, "").length * 3 / 4)
  const inputDataLen = Number(event && event.dataLen)
  const dataLen = Number.isFinite(inputDataLen) && inputDataLen > 0 && Math.abs(inputDataLen - inferredDataLen) <= 1024
    ? inputDataLen
    : inferredDataLen

  const secretId = process.env.SECRET_ID || process.env.TENCENTCLOUD_SECRETID
  const secretKey = process.env.SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY

  const clientConfig = {
    region: "ap-shanghai",
    profile: {
      httpProfile: {
        endpoint: "asr.tencentcloudapi.com"
      }
    }
  }

  if (secretId && secretKey) {
    clientConfig.credential = {
      secretId,
      secretKey
    }
  }

  try {

    const client = new AsrClient(clientConfig)


    const params = {

      // 引擎类型
      EngSerViceType: "16k_zh",

      // 音频格式
      VoiceFormat: voiceFormat,

      // 本地音频上传
      SourceType: 1,

      // base64后的音频
      Data: base64Data,

      // 原始音频大小，单位 byte
      DataLen: dataLen

    }


    const result =
      await client.SentenceRecognition(params)


    console.log(
      "识别结果:",
      result
    )


    return {

      success: true,

      text: result.Result || ""

    }


  } catch(err) {


    console.error(
      "ASR error:",
      err
    )


    return {

      success: false,

      error: err.message,
      code: err.code || "ASR_ERROR",
      debug: {
        voiceFormat,
        dataLen,
        inferredDataLen
      }

    }

  }

}