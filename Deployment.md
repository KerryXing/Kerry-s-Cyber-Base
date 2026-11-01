# 发布网站

## 方式一：GitHub Pages（推荐，永久免费）

1. 在 GitHub 创建一个空仓库。
2. 将当前目录推送为仓库的 `main` 或 `master` 分支。
3. 打开仓库的 `Settings → Pages`。
4. 在 `Build and deployment` 中选择 `GitHub Actions`。
5. 推送后，工作流会自动发布网站，并生成一个类似
   `https://你的用户名.github.io/仓库名/` 的网址。

仓库已经包含 `.github/workflows/pages.yml`，不需要手动构建。

## 同一局域网访问

双击 `start-local.cmd`，或运行：

```powershell
node server.mjs
```

终端会显示 `Local` 和 `Network` 地址。同一 Wi-Fi 下的其他电脑可使用
`Network` 地址访问。第一次运行时 Windows 可能询问是否允许防火墙访问。

## 共享数据说明

- 访客只读取仓库中的 `content.json` 与 `shared` 素材。
- 管理员登录后，通过网页上传的相册、Report、头像和背景会自动提交到该仓库。
- 不同设备访问相同网址时，会读取相同内容。
- 如果没有管理员 Token，网页端无法修改共享内容。
