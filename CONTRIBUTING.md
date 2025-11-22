# 贡献指南

首先，感谢您对 [yami-rpg-editor 社区版](https://github.com/Open-Yami-Community/yami-rpg-editor) 的贡献！

## 贡献方式

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 将您的改动记录提交到远程仓库 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 开发规范

尽量不要改动原来的代码，当然，如果实现起来更简单，可以改动。

因为我们要尽量保持原有的东西不变，以便在`原作者`更新时更好的进行合并更新操作。

`Project\Script\module`是模块文件，我们的改动一般都放在这。

其次，`css`尽量在`index.css`中添加，内联样式尽量少用。

注释尽量不要每行或者每几行就一个注释，只在有需要的地方注释即可。

css的配色是需要支持`亮色`和`暗色`的，所以尽量使用`var(--color)`来表示颜色。

然后就是社区版是要维护`中文`和`english`两个语言的版本，所以提交前，请确保`中文`和`english`两个语言版本都正确。

PS：更改了`Template`文件夹下的文件，就要`buildres`更新资源后提交

## 目录详解

`main.js`: 编辑器electron主进程脚本

`apk.js`: 导出APK主进程脚本

`Runtime`: electron导出模板，以分包的形式存放（github有上传文件大小的限制）

`Project`: 编辑器目录

`Project\Apk`: APK导出需要用到的工具集

`Project\Fonts`: 字体

`Project\Locales`: 多语言

`Project\Images`: 图片资源

`Project\Script`: 主体代码

`Project\Templates`: 游戏模板

`Project\vs`: monaco集成

`Project\commands.json`: 指令配置文件

`Project\default.json`: 默认编辑器配置

`Project\index.css`: 样式

`Project\index.html`: 编辑器渲染页面
