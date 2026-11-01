# Kerry's Cyber Base

一个纯 HTML / CSS / JavaScript 的个人主页，当前包含：

- 全宽首页图片预留位
- 角色属性表
- 可上传、可翻页的“日常Report”
- 可自由创建、命名和调整展示宽度的私人相册
- JPG / HEIC / LIVP / 视频本地导入
- 访客只读、管理员通过 GitHub Token 发布共享内容
- 桌面与移动端响应式布局

## 打开网站

直接双击 `index.html`，或使用任意静态文件服务器打开。

局域网访问可双击 `start-local.cmd`。完整配置与发布方法见
[Config Tuturial.docx](Config%20Tuturial.docx)。

## 替换首页图片与头像

管理员登录后，点击首页右上角“更换”可上传新背景或从背景列表中选择。
头像旁的 `+` 也可以上传头像。发布后的内容会写入 GitHub 仓库。

也可以把文件放进 `assets/avatar/` 或 `assets/hero/`，然后在
`site-data.js` 中填写：

```js
profile: {
  avatar: "assets/avatar/your-avatar.heic",
  heroMedia: "assets/hero/your-cover.heic"
}
```

通过 GitHub Pages 或本地静态服务器访问时，路径中的 HEIC 可以自动转换。

## 日常 Report

点击“生活总结放映厅”左侧的上传区域：

1. 管理员登录后，点击左上角“< 总结册”打开抽屉。
2. 上传一个 `.pptx`，或一次选择多张按顺序命名的页面图片。
3. 上传后会自动提交到 GitHub，并发布给所有访客。
4. 可通过左右按钮翻页；在页码框中输入数字后点击“跳转”或按回车即可跳页。

浏览器无法原生播放 PowerPoint 文件，因此 PPTX 会在本地被渲染并保存为逐页 PNG 图片：

- 每个页面以一张完整图片展示，不再输出文字区块
- 保留页面顺序、图片和基本版面
- 不会保留 PPT 自带的切换动画

若需要 100% 保留 PPT 的视觉设计，建议在 PowerPoint 或 WPS 中将每页导出为 PNG、JPG、GIF 或 HEIC，再一起上传这些页面图片。GIF 会保持动画效果。

## Gallery 相册

1. 管理员登录后，点击“创建相册”并填写名称。
2. 进入相册后上传 JPG、PNG、WebP、AVIF、GIF、HEIC、HEIF、MP4、WebM 或 Apple `.livp`。
3. 点击照片下方的“设为封面”，这张照片会成为主页面置顶封面。
4. 在相册详情中使用“展示大小”滑块调整它在 Gallery 主页面的宽度。

相册内容会通过 GitHub API 保存到 `content.json` 和
`shared/`，因此所有访客读取相同内容。

GIF、动态 WebP 和 APNG 会以原始图片形式播放；LIVP 中的动态视频会静音自动循环播放。视频能否解码仍取决于浏览器本身支持的编码格式。

## LIVP 说明

`.livp` 会在浏览器端作为 ZIP 包解析，并尝试提取静态照片与动态 MOV/MP4。能否直接播放 MOV 取决于浏览器对 HEVC/H.264 的支持；无法播放时仍可以在照片详情中下载提取出的原始文件。

## HEIC 说明

HEIC 和 HEIF 会在首次使用时按需加载本地转换组件，并转换为 JPEG 后显示。管理员发布后，转换结果会写入 GitHub 仓库的共享素材目录。

## 管理员与共享数据

- 访客只能查看，不能上传或删除内容。
- 点击右上角“管理”，使用拥有仓库管理员权限的 GitHub Token 登录后才显示编辑控件。
- Token 只保存在当前标签页的会话存储中，不写入源码。
- 所有发布内容由 GitHub 仓库统一提供，不同设备访问时会显示相同结果。
- 旧版本保存在浏览器 IndexedDB 中的数据可通过“导入本机旧内容”发布。
